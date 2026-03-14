import { describe, expect, it } from "vitest";
import map from "../../../game/map.json";
import monster from "../../../game/monster.json";
import boss from "../../../game/boss.json";
import equipment from "../../../game/equipment.json";
import skill from "../../../game/skill.json";
import tactics from "../../../game/tactics.json";
import { buildWorldContentFromLegacy, validateWorldContent } from "../src";

describe("legacy content conversion", () => {
  it("converts the current JSON dataset into valid shared world content", () => {
    const world = buildWorldContentFromLegacy({
      map,
      monsters: monster,
      bosses: boss,
      equipment: equipment as never,
      skills: skill as never,
      tactics: tactics as never,
    });

    expect(world.startLocationKey).toBe("시작의 마을::마을 입구");
    expect(Object.keys(world.locations).length).toBeGreaterThan(10);
    expect(world.skills.every((entry) => entry.effects.length > 0)).toBe(true);
    expect(world.equipment.every((entry) => entry.effects.length >= 0)).toBe(true);
    expect(Object.values(world.locations).every((location) => location.scene.assets.mapJsonPath.endsWith(".json"))).toBe(true);
    expect(Object.values(world.locations).every((location) => location.scene.collisionZones.length > 0)).toBe(true);
    expect(validateWorldContent(world)).toEqual([]);
  });

  it("reports broken references through validation", () => {
    const world = buildWorldContentFromLegacy({
      map,
      monsters: monster,
      bosses: boss,
      equipment: equipment as never,
      skills: skill as never,
      tactics: tactics as never,
    });

    const issues = validateWorldContent({
      ...world,
      startLocationKey: "없는 마을::없는 위치",
      enemiesByLocation: {
        ...world.enemiesByLocation,
        "시작의 마을::마을 입구": [...(world.enemiesByLocation["시작의 마을::마을 입구"] ?? []), "enemy-missing"],
      },
    });

    expect(issues.some((entry) => entry.path === "startLocationKey")).toBe(true);
    expect(issues.some((entry) => entry.message.includes("enemy-missing"))).toBe(true);
  });

  it("reports invalid scene asset metadata through validation", () => {
    const world = buildWorldContentFromLegacy({
      map,
      monsters: monster,
      bosses: boss,
      equipment: equipment as never,
      skills: skill as never,
      tactics: tactics as never,
    });

    const start = world.locations["시작의 마을::마을 입구"]!;
    const issues = validateWorldContent({
      ...world,
      locations: {
        ...world.locations,
        [start.key]: {
          ...start,
          scene: {
            ...start.scene,
            assets: {
              ...start.scene.assets,
              mapJsonPath: "/maps/layouts/missing.json",
            },
          },
        },
      },
    });

    expect(issues.some((entry) => entry.path.endsWith("assets.mapJsonPath"))).toBe(true);
  });
});
