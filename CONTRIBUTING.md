# Contributing

## Branch naming
- `feat/<short-name>` for player-facing features
- `fix/<short-name>` for bug fixes
- `chore/<short-name>` for maintenance, tooling, or refactors
- `docs/<short-name>` for documentation-only changes

## Protected `main` workflow
- `main` is protected by a GitHub ruleset. Direct pushes are blocked.
- All changes must be made on a topic branch and merged through a PR.
- The required status check is `quality`. A PR cannot merge until it passes.
- Linear history is enforced, so avoid merge commits in local branch sync flows.
- If VS Code `Sync Changes` fails on `main`, that usually means it is trying to push directly to `main`. Switch to a topic branch first.

## Recommended Git flow
- Start work from an up-to-date `main`: `git pull --ff-only origin main`
- Create a branch such as `feat/<short-name>` or `fix/<short-name>`
- Push the branch: `git push -u origin <branch-name>`
- Open a PR linked to an issue
- Merge after `quality` passes, then sync local `main` again

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
