use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(
    name = "fbs",
    version,
    about = "Upload files to FBS and print shareable links"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Authenticate this machine with FBS Bearer and SigV4 credentials.
    Login {
        /// FBS server URL. Prompted when omitted.
        #[arg(long)]
        server: Option<String>,

        /// FBS Bearer token. Prompted without echo when omitted.
        #[arg(long)]
        token: Option<String>,

        /// SigV4 access key. Prompted without echo when omitted.
        #[arg(long)]
        sigv4_access_key: Option<String>,

        /// SigV4 secret key. Prompted without echo when omitted.
        #[arg(long)]
        sigv4_secret_key: Option<String>,
    },

    /// Upload a file and print its signed public URL.
    Upload {
        /// File to upload.
        file: PathBuf,

        /// Destination bucket. Created automatically when missing.
        #[arg(long, default_value = "uploads")]
        bucket: String,

        /// Object key. Defaults to the file name.
        #[arg(long)]
        key: Option<String>,

        /// Signed-link lifetime in seconds.
        #[arg(long, default_value_t = 3600)]
        expires: u64,

        /// Create a link that never expires instead of an expiring one.
        #[arg(long, conflicts_with = "expires")]
        permanent: bool,

        /// Override the detected content type.
        #[arg(long)]
        content_type: Option<String>,

        /// Emit structured JSON instead of only the URL.
        #[arg(long)]
        json: bool,
    },

    /// List objects with upload time, size, and content type.
    List {
        /// Bucket to list.
        #[arg(default_value = "uploads")]
        bucket: String,

        /// Only include keys beginning with this prefix.
        #[arg(long)]
        prefix: Option<String>,

        /// Emit structured JSON.
        #[arg(long)]
        json: bool,
    },

    /// Generate a fresh signed link for an existing object.
    Link {
        /// Object key.
        key: String,

        /// Bucket containing the object.
        #[arg(long, default_value = "uploads")]
        bucket: String,

        /// Create a link that never expires instead of an expiring one.
        #[arg(long, conflicts_with = "expires")]
        permanent: bool,

        /// Signed-link lifetime in seconds.
        #[arg(long, default_value_t = 3600)]
        expires: u64,

        /// Emit structured JSON instead of only the URL.
        #[arg(long)]
        json: bool,
    },

    /// Check the saved credentials against the server.
    Status,

    /// Remove locally saved credentials.
    Logout,
}

fn main() {
    let result = match Cli::parse().command {
        Command::Login {
            server,
            token,
            sigv4_access_key,
            sigv4_secret_key,
        } => fbs_cli::commands::login(server, token, sigv4_access_key, sigv4_secret_key),
        Command::Upload {
            file,
            bucket,
            key,
            expires,
            permanent,
            content_type,
            json,
        } => fbs_cli::commands::upload(fbs_cli::commands::UploadArgs {
            file,
            bucket,
            key,
            expires,
            permanent,
            content_type,
            json,
        }),
        Command::List {
            bucket,
            prefix,
            json,
        } => fbs_cli::commands::list(bucket, prefix, json),
        Command::Link {
            key,
            bucket,
            permanent,
            expires,
            json,
        } => fbs_cli::commands::link(bucket, key, expires, permanent, json),
        Command::Status => fbs_cli::commands::status(),
        Command::Logout => fbs_cli::commands::logout(),
    };

    if let Err(error) = result {
        eprintln!("error: {error:#}");
        std::process::exit(1);
    }
}
