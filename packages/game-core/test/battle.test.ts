import { describe, expect, it } from "vitest";
import { createBattle, createStarterPlayer, performBattleAction, type TacticDefinition } from "../src";

describe("battle engine", () => {
  it("applies normal combat rewards on victory", () => {
    const player = createStarterPlayer("tester", {
      startLocationKey: "시작의 마을::마을 입구",
      locations: {},
      equipment: [],
      skills: [],
      tactics: [],
      enemies: {},
      enemiesByLocation: {},
    });

    const enemy = {
      id: "enemy-slime",
      name: "슬라임",
      maxHp: 5,
      attack: 1,
      defense: 0,
      speed: 1,
      accuracy: 0.7,
      mana: 0,
      experienceReward: 8,
      coinReward: 80,
    };

    const battle = createBattle(player, enemy);
    const result = performBattleAction({
      player,
      state: battle,
      action: { kind: "attack" },
      skills: {},
      tactics: {} as Record<string, TacticDefinition>,
      equipment: {},
      enemies: { [enemy.id]: enemy },
      rng: () => 0.5,
    });

    expect(result.state.finished).toBe(true);
    expect(result.player.coins).toBeGreaterThan(player.coins);
    expect(result.logs.some((entry) => entry.includes("처치"))).toBe(true);
  });
});
