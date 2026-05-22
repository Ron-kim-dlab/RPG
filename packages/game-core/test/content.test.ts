import { describe, expect, it } from "vitest";
import map from "../../../game/map.json";
import monster from "../../../game/monster.json";
import boss from "../../../game/boss.json";
import equipment from "../../../game/equipment.json";
import skill from "../../../game/skill.json";
import tactics from "../../../game/tactics.json";
import {
  buildWorldContentFromLegacy,
  createSceneLayout,
  createScenePortalSlots,
  validateWorldContent,
  type LegacyMonsterData,
} from "../src";

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
  );
}

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
    expect(world.equipment.every((entry) => entry.itemType === "equipment" && Boolean(entry.slot))).toBe(true);
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

  it("maps optional monster spawn_rate values into shared spawn weights", () => {
    const monstersWithRates = structuredClone(monster) as LegacyMonsterData;
    const firstMonster = Object.values(monstersWithRates)
      .flatMap((subLocations) => Object.values(subLocations))
      .find((enemies) => enemies.length > 0)?.[0];
    expect(firstMonster).toBeTruthy();
    firstMonster!.spawn_rate = 7;

    const world = buildWorldContentFromLegacy({
      map,
      monsters: monstersWithRates,
      bosses: boss,
      equipment: equipment as never,
      skills: skill as never,
      tactics: tactics as never,
    });

    const convertedEnemy = Object.values(world.enemies).find((enemy) => enemy.name === firstMonster!.이름 && enemy.spawnRate === 7);
    expect(convertedEnemy?.spawnRate).toBe(7);
  });

  it("splits monster fields into four visible encounter zones", () => {
    const world = buildWorldContentFromLegacy({
      map,
      monsters: monster,
      bosses: boss,
      equipment: equipment as never,
      skills: skill as never,
      tactics: tactics as never,
    });

    const monsterLocations = Object.values(world.locations).filter((location) => (
      !location.bossName && (world.enemiesByLocation[location.key]?.length ?? 0) > 0
    ));

    expect(monsterLocations.length).toBeGreaterThan(0);
    monsterLocations.forEach((location) => {
      expect(location.scene.encounterZones).toHaveLength(4);
    });
  });

  it("does not add normal monster zones to boss-only fields", () => {
    const world = buildWorldContentFromLegacy({
      map,
      monsters: monster,
      bosses: boss,
      equipment: equipment as never,
      skills: skill as never,
      tactics: tactics as never,
    });

    const bossLocations = Object.values(world.locations).filter((location) => Boolean(location.bossName));

    expect(bossLocations.length).toBeGreaterThan(0);
    bossLocations.forEach((location) => {
      expect(location.scene.encounterZones).toEqual([]);
    });
  });

  it("creates non-overlapping portal slots when a layout needs more than four exits", () => {
    const layout = createSceneLayout("plaza");
    const slots = createScenePortalSlots(layout, 6);

    expect(slots).toHaveLength(6);

    slots.forEach((slot, index) => {
      slots.slice(index + 1).forEach((otherSlot) => {
        expect(rectanglesOverlap(slot, otherSlot)).toBe(false);
      });
    });
  });
});
