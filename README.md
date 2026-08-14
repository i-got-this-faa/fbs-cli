# FBS CLI

A small, script-friendly Rust CLI for uploading files to `fbs-core` and printing signed public links.

## Workflow

Authenticate once with the Bearer and SigV4 credentials issued for the same FBS user:

```bash
cargo run -- login --server http://127.0.0.1:9000
```

Install the `fbs` binary locally with `cargo install --path .`.

The token is entered without terminal echo and saved at `$XDG_CONFIG_HOME/fbs/config.json`, or `~/.config/fbs/config.json` when `XDG_CONFIG_HOME` is unset. On Unix, the directory is mode `0700` and the file is mode `0600`.

Upload a file:

```bash
cargo run -- upload ./report.pdf
```

The default bucket is `uploads`, and it is created automatically when missing. Progress is written to stderr. On success, stdout contains only the signed public URL, which makes the command straightforward for AI agents and scripts to consume.

```bash
link="$(fbs upload ./report.pdf)"
```

## Commands

```text
fbs login [--server URL] [--token TOKEN] [--sigv4-access-key KEY] [--sigv4-secret-key SECRET]
fbs upload FILE [--bucket NAME] [--key KEY] [--expires SECONDS | --permanent] [--content-type TYPE] [--json]
fbs list [BUCKET] [--prefix PREFIX] [--json]
fbs link KEY [--bucket NAME] [--expires SECONDS | --permanent] [--json]
fbs status
fbs logout
```

`fbs upload --json` emits:

```json
{"url":"https://storage.example.com/public/uploads/report.pdf?...","bucket":"uploads","key":"report.pdf","expires_at":"2026-08-12T12:00:00Z"}
```

For ephemeral agent environments, `FBS_URL`, `FBS_TOKEN`, `FBS_SIGV4_ACCESS_KEY`, and `FBS_SIGV4_SECRET_KEY` override saved credentials.

List objects in the default `uploads` bucket:

```bash
fbs list
fbs list uploads --prefix reports/ --json
```

Generate a fresh link for an existing object:

```bash
fbs link reports/report.pdf --expires 3600
```

## Permanent links

`--permanent` requests a link that never expires instead of the default
short-lived presigned URL. It is mutually exclusive with `--expires`:

```bash
fbs upload ./logo.png --permanent
fbs link reports/report.pdf --permanent
```

This uses the server's signed public-read endpoint, so it only succeeds when
the `fbs-core` server is configured for it:

- `FBS_PUBLIC_READ_SIGNING_SECRET` (at least 32 bytes) must be set, or the
  server returns an error that public read signing is disabled.
- The requested lifetime is ~100 years, but the server caps it at
  `FBS_PUBLIC_READ_MAX_TTL` (default 24 hours). Raise it to allow long-lived
  links, for example `FBS_PUBLIC_READ_MAX_TTL=876000h`.
- The saved credentials must be an admin, since the endpoint is part of the
  admin management API.

A permanent link is revoked by rotating the signing secret or deleting the
object; it is not tied to the credentials that created it.

## Server Requirements

- A current `fbs-core` server.
- A Bearer token with permission to upload to the destination bucket.
- Matching SigV4 credentials, used locally to create presigned download links.

## Development

```bash
cargo fmt --check
cargo test
cargo clippy --all-targets -- -D warnings
```
