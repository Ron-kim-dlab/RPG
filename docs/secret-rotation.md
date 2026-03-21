# Secret Rotation Guide

Use this guide when rotating the MongoDB credential and deployment secrets tracked by `#17`.

## 1. Generate fresh credentials

- Create a new MongoDB user scoped to the RPG database only.
- Prefer a dedicated application user instead of reusing an admin account.
- Generate a new JWT secret:

```bash
corepack pnpm security:generate-jwt
```

## 2. Update local server env

Update `apps/server/.env` with the fresh values:

```dotenv
JWT_SECRET=replace-with-a-fresh-generated-secret
MONGODB_URI=mongodb://rpg_app:new-password@db-host:27017/rpg-rebuild?authSource=rpg-rebuild
STORAGE_DRIVER=mongo
```

If the web client uses a non-default backend URL, update `apps/web/.env` as well.

## 3. Sync GitHub secrets

For a quick preview:

```bash
corepack pnpm security:sync-gh-secrets --dry-run
```

Sync repository-level secrets:

```bash
corepack pnpm security:sync-gh-secrets
```

Or create/update a GitHub environment and write to it:

```bash
corepack pnpm security:sync-gh-secrets --environment production
```

By default the sync script writes:

- `JWT_SECRET`
- `MONGODB_URI`

You can override the list when needed:

```bash
corepack pnpm security:sync-gh-secrets --keys JWT_SECRET,MONGODB_URI,CLIENT_ORIGIN
```

## 4. Update the deployment platform

- Copy the same fresh values into the active deployment platform environment settings.
- Keep the active runtime pointed at `apps/server`.
- Do not reuse old `server.js` or `api/*` deployment paths.

## 5. Audit legacy runtime paths

Run the legacy audit to see whether old runtime files still reference deployment env keys:

```bash
corepack pnpm security:audit-legacy-runtime
```

Use `--strict` if you want the command to fail when references are found.

## 6. Verify the rotated secrets

With the server running against the new MongoDB credential:

```bash
corepack pnpm security:smoke
```

The smoke flow verifies:

- `/healthz`
- account registration
- login
- `player/me`
- `player/save`
- Socket.IO connection
- scene presence join
- chat round trip

## 7. Retire the old credential

- Disable or delete the previous MongoDB user/password after verification succeeds.
- Confirm that no deployment target still points at the old URI.
- Record the rotation date in the related issue or ops notes.
