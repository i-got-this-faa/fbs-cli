use crate::config::Config;
use anyhow::{Context, Result, anyhow, bail};
use quick_xml::de::from_str as from_xml_str;
use reqwest::StatusCode;
use reqwest::blocking::{Client, Response};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use s3::Bucket;
use s3::creds::Credentials;
use s3::region::Region;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::Path;
use std::time::Duration;
use url::Url;

pub struct FbsClient {
    base_url: Url,
    token: String,
    sigv4_access_key: String,
    sigv4_secret_key: String,
    http: Client,
}

#[derive(Debug, Serialize)]
pub struct UploadResult {
    pub url: String,
    pub bucket: String,
    pub key: String,
    pub expires_at: String,
}

#[derive(Debug, Deserialize)]
struct ManagementErrorEnvelope {
    error: ManagementError,
}

#[derive(Debug, Deserialize)]
struct ManagementError {
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename = "Error")]
struct S3Error {
    #[serde(rename = "Code")]
    code: Option<String>,
    #[serde(rename = "Message")]
    message: Option<String>,
}

impl FbsClient {
    pub fn new(config: &Config) -> Result<Self> {
        let mut base_url = Url::parse(config.server.trim()).context("invalid FBS server URL")?;
        if !matches!(base_url.scheme(), "http" | "https") {
            bail!("FBS server URL must use http or https");
        }
        base_url.set_query(None);
        base_url.set_fragment(None);

        let http = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .build()
            .context("failed to create HTTP client")?;

        Ok(Self {
            base_url,
            token: config.token.trim().to_owned(),
            sigv4_access_key: config.sigv4_access_key.trim().to_owned(),
            sigv4_secret_key: config.sigv4_secret_key.trim().to_owned(),
            http,
        })
    }

    pub fn validate_access(&self) -> Result<()> {
        let url = self.url(&[])?;
        let response = self
            .authenticated(self.http.get(url))
            .send()
            .context("could not connect to the FBS server")?;

        if response.status().is_success() {
            return Ok(());
        }

        Err(response_error(response, "authentication failed"))
    }

    pub fn upload(
        &self,
        file_path: &Path,
        bucket: &str,
        key: &str,
        content_type: &str,
        expires: u64,
    ) -> Result<UploadResult> {
        validate_bucket(bucket)?;
        validate_key(key)?;
        let expires = validate_expiry(expires)?;

        self.ensure_bucket(bucket)?;
        self.put_object(file_path, bucket, key, content_type)?;
        self.create_presigned_url(bucket, key, expires)
    }

    fn ensure_bucket(&self, bucket: &str) -> Result<()> {
        let url = self.url(&[bucket])?;
        let response = self
            .authenticated(self.http.head(url.clone()))
            .send()
            .with_context(|| format!("failed to check bucket {bucket}"))?;

        if response.status().is_success() {
            return Ok(());
        }
        if response.status() != StatusCode::NOT_FOUND {
            return Err(response_error(
                response,
                "failed to check destination bucket",
            ));
        }

        let response = self
            .authenticated(self.http.put(url))
            .body(Vec::new())
            .send()
            .with_context(|| format!("failed to create bucket {bucket}"))?;
        if response.status().is_success() {
            return Ok(());
        }

        Err(response_error(
            response,
            "failed to create destination bucket",
        ))
    }

    fn put_object(
        &self,
        file_path: &Path,
        bucket: &str,
        key: &str,
        content_type: &str,
    ) -> Result<()> {
        let file = File::open(file_path)
            .with_context(|| format!("failed to open {}", file_path.display()))?;
        let url = self.object_url(bucket, key)?;
        let response = self
            .authenticated(self.http.put(url))
            .header(CONTENT_TYPE, content_type)
            .body(file)
            .send()
            .with_context(|| format!("failed to upload {}", file_path.display()))?;

        if response.status().is_success() {
            return Ok(());
        }

        Err(response_error(response, "upload failed"))
    }

    fn create_presigned_url(&self, bucket: &str, key: &str, expires: u32) -> Result<UploadResult> {
        let credentials = Credentials::new(
            Some(&self.sigv4_access_key),
            Some(&self.sigv4_secret_key),
            None,
            None,
            None,
        )
        .context("invalid SigV4 credentials")?;
        let region = Region::Custom {
            region: "us-east-1".to_owned(),
            endpoint: self.base_url.as_str().trim_end_matches('/').to_owned(),
        };
        let bucket_client = Bucket::new(bucket, region, credentials)
            .context("failed to prepare signed link")?
            .with_path_style();
        let url = bucket_client
            .presign_get(key, expires, None)
            .context("file uploaded, but signed link creation failed")?;
        let expires_at = time::OffsetDateTime::now_utc()
            .checked_add(time::Duration::seconds(i64::from(expires)))
            .context("signed link expiration overflow")?
            .format(&time::format_description::well_known::Rfc3339)
            .context("failed to format signed link expiration")?;
        Ok(UploadResult {
            url,
            bucket: bucket.to_owned(),
            key: key.to_owned(),
            expires_at,
        })
    }

    fn authenticated(
        &self,
        request: reqwest::blocking::RequestBuilder,
    ) -> reqwest::blocking::RequestBuilder {
        request.header(AUTHORIZATION, format!("Bearer {}", self.token))
    }

    fn object_url(&self, bucket: &str, key: &str) -> Result<Url> {
        let mut segments = vec![bucket];
        segments.extend(key.split('/'));
        self.url(&segments)
    }

    fn url(&self, segments: &[&str]) -> Result<Url> {
        build_url(&self.base_url, segments)
    }
}

fn build_url(base_url: &Url, segments: &[&str]) -> Result<Url> {
    let mut url = base_url.clone();
    url.set_query(None);
    url.set_fragment(None);
    {
        let mut path = url
            .path_segments_mut()
            .map_err(|_| anyhow!("FBS server URL cannot be used as a base URL"))?;
        path.clear();
        path.extend(segments.iter().copied());
    }
    Ok(url)
}

fn validate_bucket(bucket: &str) -> Result<()> {
    let bytes = bucket.as_bytes();
    if !(3..=63).contains(&bytes.len())
        || !bytes.iter().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'-' | b'.')
        })
        || !bytes.first().is_some_and(u8::is_ascii_alphanumeric)
        || !bytes.last().is_some_and(u8::is_ascii_alphanumeric)
        || bucket.contains("..")
        || bucket.contains(".-")
        || bucket.contains("-.")
        || bucket == "public"
        || bucket.parse::<std::net::Ipv4Addr>().is_ok()
    {
        bail!("invalid bucket name: {bucket}");
    }
    Ok(())
}

fn validate_key(key: &str) -> Result<()> {
    if key.is_empty()
        || key.len() > 1024
        || key.starts_with('/')
        || key.contains(['\0', '\n', '\r'])
        || key.split('/').any(|segment| matches!(segment, "." | ".."))
    {
        bail!("invalid object key: {key}");
    }
    Ok(())
}

fn validate_expiry(expires: u64) -> Result<u32> {
    let expires = u32::try_from(expires).context("link lifetime is too large")?;
    if !(1..=604_800).contains(&expires) {
        bail!("link lifetime must be between 1 and 604800 seconds");
    }
    Ok(expires)
}

fn response_error(response: Response, fallback: &str) -> anyhow::Error {
    let status = response.status();
    let body = response.text().unwrap_or_default();
    let message = serde_json::from_str::<ManagementErrorEnvelope>(&body)
        .ok()
        .map(|error| error.error.message)
        .or_else(|| {
            from_xml_str::<S3Error>(&body)
                .ok()
                .map(|error| match (error.code, error.message) {
                    (Some(code), Some(message)) => format!("{code}: {message}"),
                    (Some(code), None) => code,
                    (None, Some(message)) => message,
                    (None, None) => fallback.to_owned(),
                })
        })
        .filter(|message| !message.trim().is_empty())
        .unwrap_or_else(|| fallback.to_owned());
    anyhow!("{message} (HTTP {status})")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn object_paths_are_encoded_without_losing_slashes() {
        let base =
            Url::parse("https://storage.example.com/old/path?ignored=yes").expect("base URL");
        let url =
            build_url(&base, &["uploads", "reports", "hello world#.txt"]).expect("object URL");

        assert_eq!(
            url.as_str(),
            "https://storage.example.com/uploads/reports/hello%20world%23.txt"
        );
    }

    #[test]
    fn invalid_keys_are_rejected_locally() {
        for key in [
            "",
            "/absolute",
            "../secret",
            "folder/../secret",
            "line\nbreak",
        ] {
            assert!(
                validate_key(key).is_err(),
                "key should be rejected: {key:?}"
            );
        }
    }

    #[test]
    fn common_bucket_name_is_valid() {
        assert!(validate_bucket("agent-uploads").is_ok());
        assert!(validate_bucket("public").is_err());
        assert!(validate_bucket("UPPERCASE").is_err());
        assert!(validate_bucket("192.168.1.1").is_err());
    }
}
