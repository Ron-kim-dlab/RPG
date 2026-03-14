# Security Checklist

## Deployment
- Deploy the new multiplayer server from `apps/server`.
- Do not deploy the legacy `server.js` or `api/*` entrypoints.
- Set `STORAGE_DRIVER=mongo` for any shared or persistent environment.
- `STORAGE_DRIVER=memory` is only for local development and tests.

## Secrets
- Generate a fresh `JWT_SECRET` with at least 32 characters.
- Store secrets only in untracked `.env` or platform-managed environment variables.
- Rotate any MongoDB credential that was previously exposed before the next deployment.
- Prefer a dedicated MongoDB user scoped to the RPG database only.

## Local setup
- Copy `apps/server/.env.example` to `apps/server/.env`.
- Copy `apps/web/.env.example` to `apps/web/.env` only if you need a non-default API URL.
- Keep `.env.example` files committed and real `.env` files uncommitted.

## Verification
- `corepack pnpm --filter @rpg/server test`
- `corepack pnpm --filter @rpg/server typecheck`
- `corepack pnpm --filter @rpg/server lint`
