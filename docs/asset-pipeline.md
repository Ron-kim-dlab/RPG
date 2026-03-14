# Map Metadata And Placeholder Asset Pipeline

## Goals
- Keep location-to-scene metadata in `game-core` so server and client use the same 2D scene contract.
- Store placeholder art and Tiled-compatible JSON maps under `apps/web/public` so the browser can load them without build-time coupling.
- Catch missing maps, bad scene links, and broken asset conventions in automated tests.

## Path Rules
- Layout maps: `/maps/layouts/<layout-id>.json`
- Terrain textures: `/assets/placeholders/terrain/<theme-id>.svg`
- Shared prop texture: `/assets/placeholders/props/prop-block.svg`
- Shared actor textures:
  - `/assets/placeholders/actors/player-local.svg`
  - `/assets/placeholders/actors/player-remote.svg`
  - `/assets/placeholders/actors/npc-guide.svg`
  - `/assets/placeholders/actors/portal.svg`
  - `/assets/placeholders/actors/encounter.svg`

## Scene Metadata Contract
- `scene.themeId`: biome-level terrain variant
- `scene.tileSize`: base tile scale for Tiled layouts
- `scene.assets.layoutId`: shared layout template id
- `scene.assets.mapJsonPath`: public Tiled JSON path
- `scene.collisionZones`: runtime movement blockers
- `scene.portals`, `scene.npcs`, `scene.encounterZones`: location-specific interactive objects

## Current Layout Templates
- `town_gate`
- `shop`
- `inn`
- `skill_shop`
- `plaza`
- `field`
- `boss_arena`

## Validation
- `packages/game-core/src/validation.ts` checks layout/theme conventions, bounds, collisions, and location links.
- `apps/web/test/assetPipeline.test.ts` verifies that every declared public asset exists and that each map JSON advertises the same `layoutId` as the scene metadata.
