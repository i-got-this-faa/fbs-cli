## Project Guidelines

- This project is a Rust command-line tool, not a TUI.
- Use Cargo for dependencies and project commands.
- Keep stdout machine-readable. Progress and diagnostics belong on stderr.
- Preserve non-interactive operation for AI agents and scripts.
- Never print or log Bearer tokens.
- Store credentials with user-only filesystem permissions where supported.
- Keep HTTP, configuration, and command behavior in separate focused modules.
- Add tests for URL encoding, validation, credential storage, and command behavior changes.
- Run `cargo fmt --check`, `cargo test`, and `cargo clippy --all-targets -- -D warnings` after changes.
- Do not reintroduce Bun, React, OpenTUI, or TypeScript without an explicit user request.
