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

#[derive(Debug, Serialize)]
pub struct ObjectInfo {
    pub key: String,
    pub uploaded_at: String,
    pub size_bytes: u64,
    pub content_type: String,
}
/// How long a generated link should live.
#[derive(Clone, Copy, Debug)]
pub enum LinkLifetime {
    /// Expire after this many seconds (SigV4 presigned URL).
    Seconds(u64),
    /// Never expire. The server still caps the lifetime it is willing to sign.
    Permanent,
}

/// Requested lifetime for a permanent link: ~100 years, effectively forever.
const PERMANENT_LINK_TTL_SECONDS: u64 = 100 * 365 * 24 * 60 * 60;

#[derive(Serialize)]
struct PublicUrlRequest {
    expires_in_seconds: u64,
}

#[derive(Deserialize)]
struct PublicUrlResponse {
    url: String,
    expires_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename = "ListBucketResult")]
struct ListBucketResponse {
    #[serde(rename = "IsTruncated")]
    is_truncated: bool,
    #[serde(rename = "NextContinuationToken", default)]
    next_continuation_token: String,
    #[serde(rename = "Contents", default)]
    contents: Vec<ListBucketObject>,
}

#[derive(Debug, Deserialize)]
struct ListBucketObject {
    #[serde(rename = "Key")]
    key: String,
    #[serde(rename = "LastModified")]
    last_modified: String,
    #[serde(rename = "Size")]
    size: u64,
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
        lifetime: LinkLifetime,
    ) -> Result<UploadResult> {
        validate_bucket(bucket)?;
        validate_key(key)?;
        let expires = resolve_lifetime(lifetime)?;

        self.ensure_bucket(bucket)?;
        self.put_object(file_path, bucket, key, content_type)?;
        self.link_for(bucket, key, expires)
    }

    pub fn list_objects(&self, bucket: &str, prefix: Option<&str>) -> Result<Vec<ObjectInfo>> {
        validate_bucket(bucket)?;
        if let Some(prefix) = prefix {
            validate_prefix(prefix)?;
        }

        let mut objects = Vec::new();
        let mut continuation_token: Option<String> = None;
        loop {
            let page = self.list_objects_page(bucket, prefix, continuation_token.as_deref())?;
            for object in page.contents {
                let content_type = self.object_content_type(bucket, &object.key)?;
                objects.push(ObjectInfo {
                    key: object.key,
                    uploaded_at: object.last_modified,
                    size_bytes: object.size,
                    content_type,
                });
            }

            if !page.is_truncated {
                break;
            }
            if page.next_continuation_token.is_empty() {
                bail!("server returned a truncated listing without a continuation token");
            }
            continuation_token = Some(page.next_continuation_token);
        }

        Ok(objects)
    }

    pub fn create_link(
        &self,
        bucket: &str,
        key: &str,
        lifetime: LinkLifetime,
    ) -> Result<UploadResult> {
        validate_bucket(bucket)?;
        validate_key(key)?;
        let expires = resolve_lifetime(lifetime)?;
        self.object_content_type(bucket, key)?;
        self.link_for(bucket, key, expires)
    }

    fn list_objects_page(
        &self,
        bucket: &str,
        prefix: Option<&str>,
        continuation_token: Option<&str>,
    ) -> Result<ListBucketResponse> {
        let mut url = self.url(&[bucket])?;
        {
            let mut query = url.query_pairs_mut();
            query.append_pair("list-type", "2");
            query.append_pair("max-keys", "1000");
            if let Some(prefix) = prefix {
                query.append_pair("prefix", prefix);
            }
            if let Some(token) = continuation_token {
                query.append_pair("continuation-token", token);
            }
        }

        let response = self
            .authenticated(self.http.get(url))
            .send()
            .with_context(|| format!("failed to list bucket {bucket}"))?;
        if !response.status().is_success() {
            return Err(response_error(response, "failed to list bucket"));
        }

        let body = response.text().context("failed to read bucket listing")?;
        from_xml_str(&body).context("server returned an invalid bucket listing")
    }

    fn object_content_type(&self, bucket: &str, key: &str) -> Result<String> {
        let url = self.object_url(bucket, key)?;
        let response = self
            .authenticated(self.http.head(url))
            .send()
            .with_context(|| format!("failed to inspect {bucket}/{key}"))?;
        if !response.status().is_success() {
            return Err(response_error(response, "object not found"));
        }

        Ok(response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("application/octet-stream")
            .to_owned())
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

    fn link_for(&self, bucket: &str, key: &str, expires: Option<u32>) -> Result<UploadResult> {
        match expires {
            Some(seconds) => self.create_presigned_url(bucket, key, seconds),
            None => self.create_permanent_link(bucket, key),
        }
    }

    fn create_permanent_link(&self, bucket: &str, key: &str) -> Result<UploadResult> {
        let url = self.public_url_endpoint(bucket, key)?;
        let response = self
            .authenticated(self.http.post(url))
            .json(&PublicUrlRequest {
                expires_in_seconds: PERMANENT_LINK_TTL_SECONDS,
            })
            .send()
            .with_context(|| format!("failed to request a permanent link for {bucket}/{key}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let error = response_error(response, "failed to create permanent link");
            return Err(error.context(permanent_link_hint(status)));
        }

        let body: PublicUrlResponse = response
            .json()
            .context("server returned an invalid permanent link response")?;
        Ok(UploadResult {
            url: body.url,
            bucket: bucket.to_owned(),
            key: key.to_owned(),
            expires_at: body.expires_at,
        })
    }

    fn public_url_endpoint(&self, bucket: &str, key: &str) -> Result<Url> {
        self.url(&public_url_segments(bucket, key))
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

fn public_url_segments<'a>(bucket: &'a str, key: &'a str) -> Vec<&'a str> {
    let mut segments = vec!["api", "management", "buckets", bucket, "objects"];
    segments.extend(key.split('/'));
    segments.push("public-url");
    segments
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

fn validate_prefix(prefix: &str) -> Result<()> {
    if prefix.len() > 1024 || prefix.contains(['\0', '\n', '\r']) {
        bail!("invalid object prefix");
    }
    Ok(())
}

fn resolve_lifetime(lifetime: LinkLifetime) -> Result<Option<u32>> {
    match lifetime {
        LinkLifetime::Seconds(seconds) => validate_expiry(seconds).map(Some),
        LinkLifetime::Permanent => Ok(None),
    }
}

fn permanent_link_hint(status: StatusCode) -> String {
    match status {
        StatusCode::SERVICE_UNAVAILABLE => {
            "the server has public read signing disabled; set FBS_PUBLIC_READ_SIGNING_SECRET (at least 32 bytes) on the server".to_owned()
        }
        StatusCode::BAD_REQUEST => {
            "the server's maximum public link lifetime is below 100 years; raise FBS_PUBLIC_READ_MAX_TTL (for example FBS_PUBLIC_READ_MAX_TTL=876000h) on the server".to_owned()
        }
        StatusCode::FORBIDDEN => {
            "the saved credentials are not an admin; permanent links require the admin management API".to_owned()
        }
        _ => "the server refused to create a permanent link".to_owned(),
    }
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
    fn permanent_link_endpoint_encodes_key_without_losing_slashes() {
        let base = Url::parse("https://storage.example.com").expect("base URL");
        let url = build_url(
            &base,
            &public_url_segments("uploads", "reports/hello world#.txt"),
        )
        .expect("permanent link endpoint");

        assert_eq!(
            url.as_str(),
            "https://storage.example.com/api/management/buckets/uploads/objects/reports/hello%20world%23.txt/public-url"
        );
    }

    #[test]
    fn permanent_link_request_serializes_long_expiry() {
        let request = PublicUrlRequest {
            expires_in_seconds: PERMANENT_LINK_TTL_SECONDS,
        };

        assert_eq!(
            serde_json::to_string(&request).expect("serialize"),
            r#"{"expires_in_seconds":3153600000}"#
        );
    }

    #[test]
    fn lifetime_resolves_to_validated_expiry() {
        assert_eq!(
            resolve_lifetime(LinkLifetime::Permanent).expect("permanent"),
            None
        );
        assert_eq!(
            resolve_lifetime(LinkLifetime::Seconds(3600)).expect("one hour"),
            Some(3600)
        );
        assert!(resolve_lifetime(LinkLifetime::Seconds(0)).is_err());
        assert!(resolve_lifetime(LinkLifetime::Seconds(604_801)).is_err());
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

    #[test]
    fn list_bucket_xml_is_parsed() {
        let response: ListBucketResponse = from_xml_str(
            r#"<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>report.pdf</Key><LastModified>2026-08-12T12:00:00.000Z</LastModified><Size>42</Size></Contents></ListBucketResult>"#,
        )
        .expect("parse listing");

        assert!(!response.is_truncated);
        assert_eq!(response.contents.len(), 1);
        assert_eq!(response.contents[0].key, "report.pdf");
        assert_eq!(response.contents[0].size, 42);
    }
}
