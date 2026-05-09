# FBS CLI

A terminal user interface (TUI) for managing **FBS** (File Bucket Storage) — a self-hosted, S3-compatible object storage backend.

Built with [OpenTUI](https://opentui.dev) + React + Zustand.

## Features

- **Dashboard** — View metrics (buckets, objects, storage, keys) and recent activity
- **Bucket Management** — Create, browse, empty, and delete buckets
- **Object Browser** — Navigate folders (prefix/delimiter), delete objects, multi-select
- **Access Keys** — Create, rename, activate/deactivate, and delete API keys
- **Settings** — View server config and connection details
- **Persistent Config** — Auto-reconnects using saved credentials (`~/.config/fbs/config.json`)
- **Keyboard Navigation** — Full keyboard-driven interface (no mouse required)

## Quick Start

```bash
# Install dependencies
bun install

# Run in development (watch mode)
bun run dev

# Or run directly
bun src/index.tsx
```

## Usage

### Connect

On first launch, enter your FBS backend URL and bearer token:

- **URL**: `http://127.0.0.1:9000` (default)
- **Token**: Your bearer token (e.g. `fbsa_...`)

Credentials are saved to `~/.config/fbs/config.json` for auto-reconnect.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Dashboard view |
| `2` | Buckets view |
| `3` | Access Keys view |
| `4` | Settings view |
| `↑` / `↓` | Navigate items |
| `Enter` | Select / open item |
| `r` | Refresh current view |
| `q` | Quit |
| `Ctrl+C` | Quit |
| `Esc` | Go back (from object browser to buckets) |

### Views

**Dashboard** (`1`)
- Metric cards: Buckets, Objects, Storage, Keys
- Largest buckets table
- Recent activity feed

**Buckets** (`2`)
- List all buckets with object count and size
- `c` Create new bucket
- `Enter` Open bucket object browser
- `d` Delete bucket
- `e` Empty bucket

**Object Browser** (Enter on a bucket)
- Navigate folders with `Enter`
- Go up with `Esc` or `← Up` button
- `Space` Select objects
- `d` Delete single object
- `D` Delete selected objects
- `m` Load more (if truncated)

**Access Keys** (`3`)
- List all keys with role and status
- `c` Create new key
- `t` Toggle active/inactive
- `r` Rename key
- `d` Delete key

**Settings** (`4`)
- View server config (region, dev mode, limits)
- View connection details
- Disconnect and clear saved credentials

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Run in watch mode |
| `bun run lint` | Run ESLint |
| `bun run format` | Run Prettier |
| `bun run check` | Run TypeScript type check |

## Architecture

```
src/
├── index.tsx              # Entry point — renderer setup
├── app.tsx                # Root shell (sidebar + view router + status bar)
├── theme.ts               # Terminal color palette
├── config.ts              # App constants
│
├── types/
│   └── api.ts             # All TypeScript interfaces (mirrors fbs-web)
│
├── services/
│   ├── api-client.ts      # FbsApiClient — HTTP Management + S3 API
│   └── config-store.ts    # Read/write ~/.config/fbs/config.json
│
├── stores/
│   ├── connection.ts      # Zustand — URL, token, client, connection status
│   ├── dashboard.ts       # Zustand — metrics
│   ├── buckets.ts         # Zustand — bucket CRUD
│   ├── objects.ts         # Zustand — object browsing + selection
│   ├── keys.ts            # Zustand — key CRUD + one-time secrets
│   └── server.ts          # Zustand — config + activity
│
├── utils/
│   ├── format.ts          # formatBytes, timeAgo, formatDate, truncate
│   └── crypto.ts          # sha256Hex
│
├── components/
│   ├── sidebar.tsx        # Left navigation panel
│   ├── topbar.tsx         # Breadcrumb header
│   ├── status-bar.tsx     # Bottom shortcuts + connection status
│   ├── metric-card.tsx    # Stat widget
│   ├── table.tsx          # Scrollable selectable list
│   ├── confirm-dialog.tsx # Confirmation overlay
│   ├── input-dialog.tsx   # Text input overlay
│   ├── secret-dialog.tsx  # One-time credential display
│   └── loading.tsx        # Loading spinner
│
├── views/
│   ├── setup.tsx          # Connection form
│   ├── dashboard.tsx      # Metrics + activity
│   ├── buckets.tsx        # Bucket list
│   ├── bucket-detail.tsx  # Object browser
│   ├── keys.tsx           # Access key management
│   └── settings.tsx       # Server info + disconnect
│
└── keymap/
    └── index.ts           # Global shortcut constants
```

## License

MIT
