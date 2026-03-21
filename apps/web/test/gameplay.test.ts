import { describe, expect, it } from "vitest";
import { createBattle, createStarterPlayer, performBattleAction, type LocationNode, type WorldContent } from "@rpg/game-core";
import { createBattleReport, deriveOverlayMode, didSceneChange } from "../src/gameplay";

const baseWorld: WorldContent = {
  startLocationKey: "시작의 마을::여관",
  locations: {},
  equipment: [],
  skills: [],
  tactics: [],
  enemies: {},
  enemiesByLocation: {},
};

function makeLocation(key: string, sceneId: string): LocationNode {
  const [mainLocation = "테스트 마을", subLocation = "테스트 구역"] = key.split("::");
  return {
    key,
    mainLocation,
    subLocation,
    story: [],
    connections: [],
    scene: {
      sceneId,
      themeId: "village",
      width: 1024,
      height: 768,
      tileSize: 32,
      backgroundColor: "#10231b",
      spawn: { x: 120, y: 120 },
      portals: [],
      npcs: [],
      encounterZones: [],
      collisionZones: [],
      assets: {
        layoutId: "inn",
        mapJsonPath: "/maps/test.json",
        terrainTexturePath: "/terrain.svg",
        propsTexturePath: "/props.svg",
        playerTexturePath: "/player.svg",
        remotePlayerTexturePath: "/remote.svg",
        npcTexturePath: "/npc.svg",
        portalTexturePath: "/portal.svg",
        encounterTexturePath: "/encounter.svg",
        license: "placeholder",
        attribution: "test",
      },
    },
  };
}

describe("web gameplay helpers", () => {
  it("derives overlay mode with battle priority", () => {
    expect(deriveOverlayMode({ battle: null, dialogue: null })).toBe("explore");
    expect(deriveOverlayMode({ battle: null, dialogue: { title: "npc" } })).toBe("dialogue");
    expect(deriveOverlayMode({ battle: { id: "battle-1" }, dialogue: { title: "npc" } })).toBe("battle");
  });

  it("builds a concise battle report after victory", () => {
    const player = createStarterPlayer("tester", baseWorld);
    const enemy = {
      id: "enemy-slime",
      name: "슬라임",
      maxHp: 5,
      attack: 0,
      defense: 0,
      speed: 1,
      accuracy: 0,
      mana: 0,
      experienceReward: 4,
      coinReward: 6,
    };

    const resolution = performBattleAction({
      player,
      state: createBattle(player, enemy),
      action: { kind: "attack" },
      skills: {},
      tactics: {},
      equipment: {},
      enemies: { [enemy.id]: enemy },
      rng: () => 0.5,
    });

    const report = createBattleReport(resolution);

    expect(report).not.toBeNull();
    expect(report?.outcome).toBe("player_win");
    expect(report?.title).toContain("제압");
    expect(report?.lines.some((entry) => entry.includes("처치"))).toBe(true);
  });

  it("detects scene changes after defeat relocation", () => {
    const world: WorldContent = {
      ...baseWorld,
      locations: {
        "시작의 마을::여관": makeLocation("시작의 마을::여관", "inn_scene"),
        "시작의 마을::필드": makeLocation("시작의 마을::필드", "field_scene"),
      },
    };

    const previousPlayer = {
      ...createStarterPlayer("tester", world),
      locationKey: "시작의 마을::필드",
    };
    const nextPlayer = {
      ...previousPlayer,
      locationKey: "시작의 마을::여관",
    };

    expect(didSceneChange(world, previousPlayer, nextPlayer)).toBe(true);
  });
});
