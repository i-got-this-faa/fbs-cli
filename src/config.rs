use anyhow::{Context, Result, anyhow, bail};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

const CONFIG_FILE_NAME: &str = "config.json";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Config {
    pub server: String,
    pub token: String,
    #[serde(default)]
    pub sigv4_access_key: String,
    #[serde(default)]
    pub sigv4_secret_key: String,
}

pub fn load() -> Result<Config> {
    load_from(&config_path()?)
}

pub fn load_with_env() -> Result<Config> {
    let saved = load().ok();
    let server = env::var("FBS_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| saved.as_ref().map(|config| config.server.clone()));
    let token = env::var("FBS_TOKEN")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| saved.as_ref().map(|config| config.token.clone()));
    let sigv4_access_key = env::var("FBS_SIGV4_ACCESS_KEY")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| saved.as_ref().map(|config| config.sigv4_access_key.clone()));
    let sigv4_secret_key = env::var("FBS_SIGV4_SECRET_KEY")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| saved.as_ref().map(|config| config.sigv4_secret_key.clone()));

    match (server, token, sigv4_access_key, sigv4_secret_key) {
        (Some(server), Some(token), Some(sigv4_access_key), Some(sigv4_secret_key)) => Ok(Config {
            server,
            token,
            sigv4_access_key,
            sigv4_secret_key,
        }),
        _ => bail!(
            "not authenticated; run `fbs login` or set FBS_URL, FBS_TOKEN, FBS_SIGV4_ACCESS_KEY, and FBS_SIGV4_SECRET_KEY"
        ),
    }
}

pub fn save(config: &Config) -> Result<PathBuf> {
    let path = config_path()?;
    save_to(&path, config)?;
    Ok(path)
}

pub fn remove() -> Result<bool> {
    let path = config_path()?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error).with_context(|| format!("failed to remove {}", path.display())),
    }
}

pub fn config_path() -> Result<PathBuf> {
    if let Some(path) = env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(path).join("fbs").join(CONFIG_FILE_NAME));
    }

    let home = env::var_os("HOME").ok_or_else(|| anyhow!("HOME is not set"))?;
    Ok(PathBuf::from(home)
        .join(".config")
        .join("fbs")
        .join(CONFIG_FILE_NAME))
}

fn load_from(path: &Path) -> Result<Config> {
    let contents = fs::read_to_string(path)
        .with_context(|| format!("failed to read credentials from {}", path.display()))?;
    let config: Config = serde_json::from_str(&contents)
        .with_context(|| format!("invalid credentials file at {}", path.display()))?;

    if config.server.trim().is_empty()
        || config.token.trim().is_empty()
        || config.sigv4_access_key.trim().is_empty()
        || config.sigv4_secret_key.trim().is_empty()
    {
        bail!("credentials file is incomplete; run `fbs login` again");
    }

    Ok(config)
}

fn save_to(path: &Path, config: &Config) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow!("credentials path has no parent directory"))?;
    fs::create_dir_all(parent).with_context(|| format!("failed to create {}", parent.display()))?;

    #[cfg(unix)]
    fs::set_permissions(parent, fs::Permissions::from_mode(0o700))
        .with_context(|| format!("failed to secure {}", parent.display()))?;

    let serialized = serde_json::to_vec_pretty(config).context("failed to encode credentials")?;
    let temporary_path = path.with_extension("json.tmp");

    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    options.mode(0o600);

    let mut file = options
        .open(&temporary_path)
        .with_context(|| format!("failed to write {}", temporary_path.display()))?;
    std::io::Write::write_all(&mut file, &serialized)
        .with_context(|| format!("failed to write {}", temporary_path.display()))?;
    file.sync_all()
        .with_context(|| format!("failed to sync {}", temporary_path.display()))?;
    fs::rename(&temporary_path, path)
        .with_context(|| format!("failed to replace {}", path.display()))?;

    #[cfg(unix)]
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .with_context(|| format!("failed to secure {}", path.display()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_path() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock before unix epoch")
            .as_nanos();
        env::temp_dir().join(format!("fbs-cli-config-{unique}/config.json"))
    }

    #[test]
    fn config_round_trips() {
        let path = temporary_path();
        let expected = Config {
            server: "https://storage.example.com".into(),
            token: "fbsa_example.secret".into(),
            sigv4_access_key: "fbsv4_example".into(),
            sigv4_secret_key: "example-secret".into(),
        };

        save_to(&path, &expected).expect("save config");
        let actual = load_from(&path).expect("load config");

        assert_eq!(actual.server, expected.server);
        assert_eq!(actual.token, expected.token);
        assert_eq!(actual.sigv4_access_key, expected.sigv4_access_key);
        assert_eq!(actual.sigv4_secret_key, expected.sigv4_secret_key);

        #[cfg(unix)]
        assert_eq!(
            fs::metadata(&path)
                .expect("config metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );

        fs::remove_dir_all(path.parent().expect("parent")).expect("cleanup temp config");
    }

    #[test]
    fn incomplete_config_is_rejected() {
        let path = temporary_path();
        fs::create_dir_all(path.parent().expect("parent")).expect("create parent");
        fs::write(&path, r#"{"server":"","token":"token"}"#).expect("write config");

        let error = load_from(&path).expect_err("incomplete config should fail");
        assert!(error.to_string().contains("incomplete"));

        fs::remove_dir_all(path.parent().expect("parent")).expect("cleanup temp config");
    }
}
