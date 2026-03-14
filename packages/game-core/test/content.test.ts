import { describe, expect, it } from "vitest";
import map from "../../../game/map.json";
import monster from "../../../game/monster.json";
import boss from "../../../game/boss.json";
import equipment from "../../../game/equipment.json";
import skill from "../../../game/skill.json";
import tactics from "../../../game/tactics.json";
import { buildWorldContentFromLegacy } from "../src";

describe("legacy content conversion", () => {
  it("converts the current JSON dataset without unresolved effect handlers", () => {
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
  });
});
