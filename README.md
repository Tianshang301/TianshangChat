# TianshangChat

- en [English](README.md)
- zh_CN [简体中文](readme/README.zh_CN.md)
- zh_TW [繁體中文](readme/README.zh_TW.md)
- ja [日本語](readme/README.ja.md)
- ko [한국어](readme/README.ko.md)

A real-time chat application with public channels, private messaging, and group conversations — offline-capable, end-to-end encrypted, and extensible via plugins. Available on Web (PWA), Android, and Windows Desktop.

> **Note**: The project is being industrialized phase-by-phase (see [AGENTS.md](AGENTS.md) for the engineering baseline). Phases 0–5 are merged: pnpm monorepo, full TypeScript, E2EE, offline-first, test/CI infrastructure, PWA + plugin system.

## Features

### Core Features
- **Public Chat**: Real-time chat room for all connected users
- **Private Messaging**: One-on-one conversations
- **Group Chat**: Create / join by ID, member roles (creator/admin/member), owner cannot leave
- **Voice Messages**: Record and play voice notes
- **Custom Avatars**: Upload profile pictures
- **Multi-language Support**: English, Chinese (Simplified/Traditional), Japanese, Korean
- **Typing Indicators & Unread Badges**: Public and private

### Security (E2EE)
- **Private chats** use a simplified Signal protocol: X3DH key agreement + Double Ratchet
- **Group chats** use Sender Keys (distributed by the sender, not the server)
- The server stores only ciphertext (`e2ee:v1.*` / `gsk:v1.*` envelopes); plaintext exists solely on devices
- Local message cache is encrypted with a non-exportable device key (WebCrypto)
- Anti-screencap: Electron `setContentProtection`, Android `FLAG_SECURE`

### Offline-First
- Local cache (IndexedDB/Dexie) for history read without network
- Outbox queue with exponential-backoff retry — messages sent offline flush automatically on reconnect
- Delivery receipts: `sending → sent → delivered → read` status machine
- Incremental sync (`GET /api/sync?cursor=`) on reconnect/app start

### PWA & Web Push
- Installable web app (manifest, service worker, app-shell caching)
- Web Push notifications (VAPID) when the tab is closed or the chat is in the background
- Uploaded media (avatars/voice) cached cache-first for instant replay

### Plugin System
- Third-party plugins register capabilities without host changes: slash commands, message observers, outgoing transformers, settings storage
- Permission-gated API (manifest-declared capabilities enforced at runtime)
- Bundled sample plugin `ai-assistant`: `/ai <question>` and `/translate <text>` via any OpenAI-compatible endpoint (works out of the box with local [Ollama](https://ollama.com))

### Platform Support
| Platform | Description |
|----------|-------------|
| **Web / PWA** | Browser-based app; installable, offline-capable, push-enabled |
| **Android** | Capacitor shell with bottom navigation |
| **Windows** | Electron desktop client with system tray |

## Tech Stack

- **Language**: TypeScript (strict mode, zero `any`) across server, web, shared packages
- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: React 18, Vite, vite-plugin-pwa, Dexie (IndexedDB), Socket.IO client, Capacitor, Electron
- **Backend**: Node.js, Express, Socket.IO, Drizzle ORM + better-sqlite3, Zod validation, helmet/rate-limit/CORS allowlist, bcrypt + JWT sessions
- **Crypto**: self-maintained minimal Signal implementation (@noble/curves + hashes + ciphers)
- **Testing**: Vitest (unit + integration w/ Supertest over temp SQLite), Playwright (E2E)
- **CI/CD**: GitHub Actions (lint → typecheck → unit → integration → build → docker); Docker Compose deployment (server + Caddy TLS + coturn)

## Project Structure

```
TianshangChat/
├── apps/
│   ├── server/               # Express + Socket.IO API (TypeScript)
│   │   └── src/
│   │       ├── api/routes/   # auth, messages, groups, users, sync, e2ee, push, upload
│   │       ├── socket/handlers/
│   │       ├── infra/        # Drizzle schema + db bootstrap
│   │       └── app.ts        # app factory (used by tests too)
│   ├── web/                  # React 18 + Vite PWA
│   │   └── src/
│   │       ├── core/         # crypto glue, push client, pure logic
│   │       ├── domain/       # use cases (messaging, groups, e2ee setup)
│   │       ├── data/         # Dexie repositories, socket adapter
│   │       ├── state/        # chat/ui store
│   │       ├── plugins/      # plugin host loader
│   │       └── ui/           # React components
│   └── desktop/              # Electron shell (reuses web build)
├── packages/
│   ├── shared/               # Socket event types, Zod DTOs, error codes
│   ├── core/                 # Pure logic shared across ends
│   ├── crypto/               # X3DH / Double Ratchet / Sender Keys (+ KATs)
│   └── plugins-sdk/          # Plugin manifest schema + host API contract
├── android/                  # Capacitor Android project
├── docs/                     # Engineering reports (e.g. pwa-vs-capacitor)
├── docker-compose.yml        # server + Caddy (TLS) + coturn
└── AGENTS.md                 # Engineering baseline & roadmap
```

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm 11+ (`corepack enable`)

### Setup

```bash
pnpm install

# Configure the server
cp apps/server/.env.example apps/server/.env
#   - set JWT_SECRET (command provided in the file)
#   - optionally set VAPID_* keys for Web Push:
#       npx web-push generate-vapid-keys

# Run database migrations
pnpm db:migrate

# Start server + web dev servers (Turbo)
pnpm dev
```

The web app runs on http://localhost:5173 (proxied to the API on :3000).

### Production Build

```bash
pnpm build        # all packages + apps
pnpm --filter @tianshangchat/web preview   # serve built PWA locally
```

### Android

```bash
pnpm --filter @tianshangchat/web build
npx cap sync android
cd android && ./gradlew assembleDebug
```

### Docker Deployment

```bash
docker compose up -d    # server + Caddy (automatic TLS) + coturn relay
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run server + web in watch mode |
| `pnpm build` | Build all packages/apps |
| `pnpm lint` | ESLint (zero warnings allowed) |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm test` | Vitest unit + integration suites |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm db:migrate` | Apply Drizzle migrations |

## Configuration (`apps/server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no (default 3000) | HTTP port |
| `NODE_ENV` | no | development / production |
| `JWT_SECRET` | **yes** | Session signing secret |
| `DATABASE_PATH` | no | SQLite file location |
| `UPLOAD_DIR` | no | Directory served under `/uploads` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | no | Web Push (push disabled if empty) |

## API Overview

All request bodies are validated with Zod. Authentication is JWT bearer.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login (rate-limited) |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/verify` | Verify token |
| GET | `/api/auth/user` | Current user profile |

### Messages & Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/history` | Public channel history |
| GET | `/api/messages/private/:userId` | Private history with a peer |
| GET | `/api/messages/private-list` | Conversation list |
| GET | `/api/messages/unread` | Unread counters |
| GET | `/api/sync?cursor=` | Incremental sync feed |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET / POST | `/api/groups` | List mine / create |
| GET | `/api/groups/:id` | Group details |
| PUT / DELETE | `/api/groups/:id` | Update / delete (owner) |
| GET | `/api/groups/:id/messages` | Group history |
| GET / POST | `/api/groups/:id/members` | List / add members |
| DELETE | `/api/groups/:id/members/:userId` | Kick member |
| PUT | `/api/groups/:id/admin/:userId` | Promote/demote admin |
| POST | `/api/groups/:id/join` | Join by ID |
| POST | `/api/groups/:id/leave` | Leave (owner cannot) |
| POST | `/api/groups/:id/transfer` | Transfer ownership |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?q=` | Search users |
| GET | `/api/users/:id` | User profile |

### E2EE / Push / Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT / GET | `/api/e2ee/bundle` , `/api/e2ee/bundle/:userId` | Publish/fetch prekey bundles |
| GET | `/api/push/vapid-public` | Get VAPID public key |
| POST | `/api/push/subscribe` / `/api/push/unsubscribe` | Manage push subscriptions |
| POST | `/api/upload/avatar` / `/api/upload/voice` | Uploads (type + size + path allowlist) |

## Socket Protocol

Event names and payloads are typed in `@tianshangchat/shared` (`ClientToServerEvents` / `ServerToClientEvents`). Highlights:

- **Client → Server**: `send-message`, `send-private-message`, `send-group-message`, voice twins (`send-*-voice`), `create-group`, `join-group`, `leave-group`, `mark-delivered`, `mark-read`, typing indicators, `update-avatar`
- **Server → Client**: `receive-message`, `receive-private-message`, `receive-group-message`, `message-status`, presence (`user-list-update`, `user-left`), group lifecycle (`group-created`, `group-updated`, `member-joined`, `member-left`), `avatar-updated`, `auth-error`

Private/group message bodies travel as E2EE envelopes; the server never sees plaintext.

## Plugins

Drop-in extension without touching host code:

1. Serve a JS module (ESM) exposing `manifest` + `activate(api)` (optionally `deactivate`)
2. Register it in `apps/web/public/plugins/registry.json`:

```json
[
  { "id": "my-plugin", "entry": "/plugins/my-plugin/index.js", "enabled": true }
]
```

Manifest declares permissions — `settings`, `messages:observe`, `messages:transform`, `commands:register` — each unlocks the corresponding `PluginApi` surface; anything else throws at runtime.

The bundled `ai-assistant` plugin demonstrates the full surface:

```
/ai How do I rotate ratchet keys?
/translate Good morning, everyone.
```

It calls an OpenAI-compatible endpoint (defaults to local Ollama at `http://127.0.0.1:11434/v1`); base URL/model/key live in per-device plugin settings and never reach the chat server. See [`packages/plugins-sdk`](packages/plugins-sdk/src/plugin.ts) for the contract.

## Database

SQLite via Drizzle ORM (migrations in `apps/server/drizzle/`): `users`, `sessions`, `messages` (ciphertext for E2EE scopes), `groups`, `group_members`, `e2ee_bundles`, `push_subscriptions`.

## License

MIT License
