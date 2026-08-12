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

        /// Override the detected content type.
        #[arg(long)]
        content_type: Option<String>,

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
            content_type,
            json,
        } => fbs_cli::commands::upload(fbs_cli::commands::UploadArgs {
            file,
            bucket,
            key,
            expires,
            content_type,
            json,
        }),
        Command::Status => fbs_cli::commands::status(),
        Command::Logout => fbs_cli::commands::logout(),
    };

    if let Err(error) = result {
        eprintln!("error: {error:#}");
        std::process::exit(1);
    }
}
