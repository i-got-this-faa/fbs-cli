use crate::api::FbsClient;
use crate::config::{self, Config};
use anyhow::{Context, Result, bail};
use std::io::{self, IsTerminal, Write};
use std::path::PathBuf;

const DEFAULT_SERVER: &str = "http://127.0.0.1:9000";

pub struct UploadArgs {
    pub file: PathBuf,
    pub bucket: String,
    pub key: Option<String>,
    pub expires: u64,
    pub content_type: Option<String>,
    pub json: bool,
}

pub fn login(
    server: Option<String>,
    token: Option<String>,
    sigv4_access_key: Option<String>,
    sigv4_secret_key: Option<String>,
) -> Result<()> {
    let server = match server {
        Some(server) => server,
        None if io::stdin().is_terminal() => prompt("FBS server", Some(DEFAULT_SERVER))?,
        None => DEFAULT_SERVER.to_owned(),
    };
    let token = match token {
        Some(token) => token,
        None if io::stdin().is_terminal() => {
            rpassword::prompt_password("Bearer token: ").context("failed to read Bearer token")?
        }
        None => bail!("--token is required when login is not running in a terminal"),
    };
    let sigv4_access_key =
        read_secret(sigv4_access_key, "SigV4 access key: ", "--sigv4-access-key")?;
    let sigv4_secret_key =
        read_secret(sigv4_secret_key, "SigV4 secret key: ", "--sigv4-secret-key")?;

    let config = Config {
        server: normalize_server(&server),
        token: token.trim().to_owned(),
        sigv4_access_key: sigv4_access_key.trim().to_owned(),
        sigv4_secret_key: sigv4_secret_key.trim().to_owned(),
    };
    if config.token.is_empty()
        || config.sigv4_access_key.is_empty()
        || config.sigv4_secret_key.is_empty()
    {
        bail!("credentials cannot be empty");
    }

    eprintln!("Checking credentials...");
    FbsClient::new(&config)?.validate_access()?;
    let path = config::save(&config)?;
    eprintln!("Authenticated. Credentials saved to {}", path.display());
    Ok(())
}

pub fn upload(args: UploadArgs) -> Result<()> {
    if !args.file.is_file() {
        bail!("{} is not a file", args.file.display());
    }

    let key = match args.key {
        Some(key) => key,
        None => args
            .file
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_owned)
            .context("file name is not valid UTF-8; pass --key explicitly")?,
    };
    let content_type = args.content_type.unwrap_or_else(|| {
        mime_guess::from_path(&args.file)
            .first_or_octet_stream()
            .essence_str()
            .to_owned()
    });

    let config = config::load_with_env()?;
    let client = FbsClient::new(&config)?;
    eprintln!(
        "Uploading {} to {}/{}...",
        args.file.display(),
        args.bucket,
        key
    );
    let result = client.upload(&args.file, &args.bucket, &key, &content_type, args.expires)?;

    if args.json {
        println!(
            "{}",
            serde_json::to_string(&result).context("failed to encode upload result")?
        );
    } else {
        println!("{}", result.url);
    }
    Ok(())
}

pub fn list(bucket: String, prefix: Option<String>, json: bool) -> Result<()> {
    let config = config::load_with_env()?;
    let objects = FbsClient::new(&config)?.list_objects(&bucket, prefix.as_deref())?;

    if json {
        println!(
            "{}",
            serde_json::to_string(&objects).context("failed to encode object listing")?
        );
        return Ok(());
    }

    println!("KEY\tUPLOADED_AT\tSIZE_BYTES\tCONTENT_TYPE");
    for object in objects {
        println!(
            "{}\t{}\t{}\t{}",
            object.key, object.uploaded_at, object.size_bytes, object.content_type
        );
    }
    Ok(())
}

pub fn link(bucket: String, key: String, expires: u64, json: bool) -> Result<()> {
    let config = config::load_with_env()?;
    let result = FbsClient::new(&config)?.create_link(&bucket, &key, expires)?;

    if json {
        println!(
            "{}",
            serde_json::to_string(&result).context("failed to encode link result")?
        );
    } else {
        println!("{}", result.url);
    }
    Ok(())
}

pub fn status() -> Result<()> {
    let config = config::load_with_env()?;
    FbsClient::new(&config)?.validate_access()?;
    println!("Authenticated");
    println!("Server: {}", normalize_server(&config.server));
    Ok(())
}

pub fn logout() -> Result<()> {
    if config::remove()? {
        eprintln!("Removed saved FBS credentials.");
    } else {
        eprintln!("No saved FBS credentials found.");
    }
    Ok(())
}

fn normalize_server(server: &str) -> String {
    server.trim().trim_end_matches('/').to_owned()
}

fn read_secret(value: Option<String>, prompt: &str, flag: &str) -> Result<String> {
    match value {
        Some(value) => Ok(value),
        None if io::stdin().is_terminal() => {
            rpassword::prompt_password(prompt).context("failed to read credential")
        }
        None => bail!("{flag} is required when login is not running in a terminal"),
    }
}

fn prompt(label: &str, default: Option<&str>) -> Result<String> {
    match default {
        Some(default) => eprint!("{label} [{default}]: "),
        None => eprint!("{label}: "),
    }
    io::stderr().flush().context("failed to flush prompt")?;

    let mut value = String::new();
    io::stdin()
        .read_line(&mut value)
        .context("failed to read input")?;
    let value = value.trim();
    if value.is_empty() {
        return default.map(str::to_owned).context("value cannot be empty");
    }
    Ok(value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_url_is_normalized() {
        assert_eq!(
            normalize_server("  https://storage.example.com///  "),
            "https://storage.example.com"
        );
    }
}
