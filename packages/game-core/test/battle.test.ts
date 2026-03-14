import { describe, expect, it } from "vitest";
import { createBattle, createStarterPlayer, performBattleAction, type EffectDefinition, type TacticDefinition } from "../src";

const emptyWorld = {
  startLocationKey: "시작의 마을::마을 입구",
  locations: {},
  equipment: [],
  skills: [],
  tactics: [],
  enemies: {},
  enemiesByLocation: {},
};

function makeEquipment(id: string, effect: EffectDefinition) {
  return {
    id,
    name: id,
    cost: 0,
    attackBonus: 0,
    manaCost: 0,
    accuracy: 1,
    description: id,
    effects: [effect],
  };
}

describe("battle engine", () => {
  it("applies normal combat rewards on victory", () => {
    const player = createStarterPlayer("tester", emptyWorld);

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

  it("applies on_turn_start equipment effects before the player action", () => {
    const basePlayer = createStarterPlayer("tester", emptyWorld);
    const player = {
      ...basePlayer,
      currentHp: 40,
      equippedEquipmentIds: ["equipment-regen-ring"],
    };

    const enemy = {
      id: "enemy-training-dummy",
      name: "허수아비",
      maxHp: 100,
      attack: 0,
      defense: 0,
      speed: 1,
      accuracy: 0,
      mana: 0,
      experienceReward: 0,
      coinReward: 0,
    };

    const result = performBattleAction({
      player,
      state: createBattle(player, enemy),
      action: { kind: "defend" },
      skills: {},
      tactics: {} as Record<string, TacticDefinition>,
      equipment: {
        "equipment-regen-ring": makeEquipment("equipment-regen-ring", {
          type: "heal",
          trigger: "on_turn_start",
          target: "self",
          clampToMax: true,
          formula: { source: "none", flat: 25, rounding: "round" },
        }),
      },
      enemies: { [enemy.id]: enemy },
      rng: () => 0.5,
    });

    expect(result.player.currentHp).toBe(65);
    expect(result.logs.some((entry) => entry.includes("회복 25"))).toBe(true);
  });

  it("applies on_hit equipment effects after a successful player hit", () => {
    const player = {
      ...createStarterPlayer("tester", emptyWorld),
      attack: 20,
      equippedEquipmentIds: ["equipment-thorn-blade"],
    };

    const enemy = {
      id: "enemy-slime",
      name: "슬라임",
      maxHp: 30,
      attack: 0,
      defense: 0,
      speed: 1,
      accuracy: 0,
      mana: 0,
      experienceReward: 0,
      coinReward: 0,
    };

    const result = performBattleAction({
      player,
      state: createBattle(player, enemy),
      action: { kind: "normal" },
      skills: {},
      tactics: {} as Record<string, TacticDefinition>,
      equipment: {
        "equipment-thorn-blade": makeEquipment("equipment-thorn-blade", {
          type: "damage",
          trigger: "on_hit",
          target: "opponent",
          formula: { source: "none", flat: 3, rounding: "round" },
        }),
      },
      enemies: { [enemy.id]: enemy },
      rng: () => 0.5,
    });

    expect(result.state.enemy.currentHp).toBe(7);
    expect(result.logs.some((entry) => entry.includes("슬라임에게 3 피해"))).toBe(true);
  });
});
