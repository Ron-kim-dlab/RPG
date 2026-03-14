import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildWorldContentFromLegacy, getSceneAssetManifest } from "@rpg/game-core";
import { describe, expect, it } from "vitest";
import boss from "../../../game/boss.json";
import equipment from "../../../game/equipment.json";
import map from "../../../game/map.json";
import monster from "../../../game/monster.json";
import skill from "../../../game/skill.json";
import tactics from "../../../game/tactics.json";

function toPublicPath(assetPath: string): string {
  return resolve(process.cwd(), "public", assetPath.slice(1));
}

describe("web asset pipeline", () => {
  const world = buildWorldContentFromLegacy({
    map,
    monsters: monster,
    bosses: boss,
    equipment: equipment as never,
    skills: skill as never,
    tactics: tactics as never,
  });

  it("ships every shared map and placeholder asset referenced by scenes", () => {
    const manifest = getSceneAssetManifest();
    const scenePaths = new Set<string>([
      ...manifest.jsonPaths,
      ...manifest.texturePaths,
    ]);

    Object.values(world.locations).forEach((location) => {
      scenePaths.add(location.scene.assets.mapJsonPath);
      scenePaths.add(location.scene.assets.terrainTexturePath);
      scenePaths.add(location.scene.assets.propsTexturePath);
      scenePaths.add(location.scene.assets.playerTexturePath);
      scenePaths.add(location.scene.assets.remotePlayerTexturePath);
      scenePaths.add(location.scene.assets.npcTexturePath);
      scenePaths.add(location.scene.assets.portalTexturePath);
      scenePaths.add(location.scene.assets.encounterTexturePath);
    });

    Array.from(scenePaths).forEach((assetPath) => {
      expect(existsSync(toPublicPath(assetPath)), `${assetPath} should exist in apps/web/public`).toBe(true);
    });
  });

  it("keeps scene layout metadata aligned with the tiled placeholder maps", () => {
    Object.values(world.locations).forEach((location) => {
      const source = readFileSync(toPublicPath(location.scene.assets.mapJsonPath), "utf8");
      const mapJson = JSON.parse(source) as {
        properties?: Array<{ name: string; value: string | boolean }>;
      };
      const layoutProperty = mapJson.properties?.find((property) => property.name === "layoutId");
      expect(layoutProperty?.value).toBe(location.scene.assets.layoutId);
    });
  });
});
