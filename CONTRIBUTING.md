# Contributing

## Branch naming
- `feat/<short-name>` for player-facing features
- `fix/<short-name>` for bug fixes
- `chore/<short-name>` for maintenance, tooling, or refactors
- `docs/<short-name>` for documentation-only changes

## Working agreement
- Link every PR to an issue unless it is a tiny docs-only correction.
- Keep PRs narrow enough that gameplay, save/load, and realtime impact can be reviewed together.
- When touching balance or content conversion, include before/after notes in the PR.

## Local checks
- `corepack pnpm install`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`

## Security
- Never commit real secrets or production database credentials.
- Rotate any exposed credential before using it again in deployment.
