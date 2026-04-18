# 2D RPG Rebuild

A browser-first rebuild of the original text-based RPG into a top-down 2D game.

This repository is organized as a `pnpm` workspace with:
- `apps/web`: Phaser 3 + TypeScript client
- `apps/server`: Express + Socket.IO + MongoDB backend
- `packages/game-core`: shared world, combat, save, and content logic

The project keeps the original world progression and battle rules, but moves moment-to-moment play into a 2D overworld with dialogue, combat overlays, save/load, and multiplayer-ready scene presence.

## Current Status

Implemented today:
- login and registration
- 2D overworld movement and scene transitions
- NPC and location dialogue flows
- battle overlay, tactics, skills, and HUD
- save/load and shared content bootstrap API
- scene metadata and placeholder asset pipeline
- scene-local presence/chat foundations

Still in progress:
- multiplayer hardening and reconnect recovery
- release-quality test gates and external playtest readiness
- production secret rotation and deployment hardening tooling

Relevant open issues:
- `#7` Scene-local multiplayer presence and chat
- `#9` Test expansion and release gates
- `#17` MongoDB credential rotation and deployment secrets
- `#18` Reconnect recovery and presence resync
- `#19` Web bundle splitting and initial load optimization

## Repository Layout

```text
.
|-- apps/
|   |-- server/        # API, auth, persistence, realtime
|   `-- web/           # Phaser client and DOM HUD
|-- packages/
|   `-- game-core/     # shared rules, content conversion, validation
|-- docs/
|   |-- asset-pipeline.md
|   `-- security-checklist.md
|-- api/               # legacy deployment path, not the active target
|-- game/              # legacy content/runtime files
|-- script.js          # legacy browser implementation
`-- server.js          # legacy server entrypoint
```

The active implementation target is the workspace app structure under `apps/` and `packages/`.

## Tech Stack

- Client: `Phaser 3`, `Vite`, `TypeScript`
- Server: `Express`, `Socket.IO`, `JWT`, `bcryptjs`
- Storage: `MongoDB` for persistent environments, in-memory storage for quick local testing
- Shared logic: `@rpg/game-core`
- Tooling: `pnpm`, `Vitest`, `ESLint`, `Playwright`

## Prerequisites

- Node.js with `corepack` enabled
- `pnpm` via Corepack
- WSL or another Unix-like shell is recommended on Windows
- MongoDB only if you want persistent local saves

## Quick Start

### 1. Install dependencies

```bash
corepack pnpm install
```

### 2. Configure environment variables

For a quick local test, use the server in memory mode.

Create `apps/server/.env`:

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
JWT_SECRET=replace-this-with-a-real-32-character-secret
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
STORAGE_DRIVER=memory
```

Optional client override in `apps/web/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:4000
```

If you want persistent saves, set:

```dotenv
STORAGE_DRIVER=mongo
MONGODB_URI=mongodb://localhost:27017/rpg-rebuild
```

Reference examples:
- `apps/server/.env.example`
- `apps/web/.env.example`
- `.env.example`

### 3. Start the backend

```bash
corepack pnpm dev:server
```

The API listens on `http://localhost:4000` by default.

### 4. Start the web client

In another terminal:

```bash
corepack pnpm dev:web
```

The client runs on `http://localhost:5173` by default.

### 5. Test the game loop

Current local playtest flow:
1. Register a new account.
2. Move with `WASD` or arrow keys.
3. Use `Space` near NPCs.
4. Use `Enter` on portals.
5. Use `B` in encounter zones.
6. Use `1`, `2`, `3` or the battle UI for core combat actions.

## Local Network Playtest On WSL

Use this flow when another device on the same Wi-Fi/LAN should connect to the game running inside WSL.

1. Find the Windows LAN IP from PowerShell:

```powershell
Get-NetIPAddress -AddressFamily IPv4
```

Example LAN IP: `192.168.0.9`.

2. Point the web client at the LAN API in `apps/web/.env.local`:

```dotenv
VITE_API_BASE_URL=http://192.168.0.9:4023
```

3. Allow the LAN web origin in `apps/server/.env.local`:

```dotenv
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://192.168.0.9:5173
```

4. Run the WSL port proxy and firewall helper from WSL:

```powershell
corepack pnpm dev:wsl-lan
```

The helper asks for elevated Windows PowerShell when needed, forwards Windows ports `5173` and `4023` to the current WSL IP, and creates inbound firewall rules.

5. Start the backend and LAN web server from WSL:

```bash
corepack pnpm dev:server
corepack pnpm dev:web:lan
```

6. Open the game from another local-network device:

```text
http://192.168.0.9:5173
```

If WSL restarts, its internal IP can change. Re-run `corepack pnpm dev:wsl-lan` after WSL restarts.

## Development Commands

From the repository root:

```bash
corepack pnpm dev:web
corepack pnpm dev:web:lan
corepack pnpm dev:server
corepack pnpm dev:wsl-lan
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

Useful package-scoped commands:

```bash
corepack pnpm --filter @rpg/web dev
corepack pnpm --filter @rpg/server dev
corepack pnpm --filter @rpg/game-core test
```

## Testing

Run the full local quality pass:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

For browser E2E:

```bash
E2E_BASE_URL=http://127.0.0.1:5173 corepack pnpm test:e2e
```

Current automated coverage includes:
- shared battle and content validation tests
- server auth, save/load, and realtime tests
- web asset pipeline and gameplay helper tests

## Deployment Notes

- Deploy the new backend from `apps/server`
- Do not deploy the legacy `server.js` or `api/*` paths as the primary runtime
- `STORAGE_DRIVER=memory` is only for local development and tests
- Production should use `STORAGE_DRIVER=mongo`

## Security Notes

- Do not commit real secrets
- `JWT_SECRET` must be at least 32 characters
- Rotate any MongoDB credential that was previously exposed before production use
- Review `docs/security-checklist.md` before deployment
- Use `corepack pnpm security:generate-jwt` and `corepack pnpm security:sync-gh-secrets` during secret rotation
- Run `corepack pnpm security:smoke` after applying new deployment secrets

## Collaboration

- `main` is protected and must be updated through PRs
- Branch naming uses `feat/*`, `fix/*`, `chore/*`, and `docs/*`
- The required GitHub check is `quality`

See:
- `CONTRIBUTING.md`
- `docs/asset-pipeline.md`
- `docs/secret-rotation.md`
- `docs/security-checklist.md`

## Roadmap Snapshot

The smallest milestone for an internal multiplayer playtest is:
- `#7` scene-local multiplayer presence/chat
- `#18` reconnect recovery

For a safer external alpha playtest, add:
- `#9` release gates and broader tests
- `#17` production secret rotation
