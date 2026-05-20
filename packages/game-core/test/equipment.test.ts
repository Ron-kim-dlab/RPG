import { describe, expect, it } from "vitest";
import {
  applyEquipmentSelection,
  normalizeEquippedEquipmentIds,
  toggleEquippedEquipmentId,
  type EquipmentDefinition,
  type PlayerSave,
} from "../src";

const equipmentById: Record<string, EquipmentDefinition> = {
  "equipment-sword": makeEquipment("equipment-sword", "weapon", 5, 0.9),
  "equipment-bow": makeEquipment("equipment-bow", "weapon", 8, 0.75),
  "equipment-armor": makeEquipment("equipment-armor", "armor", 2, 0.8),
};

function makeEquipment(
  id: string,
  slot: EquipmentDefinition["slot"],
  attackBonus: number,
  accuracy: number,
): EquipmentDefinition {
  return {
    id,
    itemType: "equipment",
    slot,
    name: id,
    texturePath: "/assets/generated/items/item-village-sword.png",
    cost: 0,
    attackBonus,
    manaCost: 0,
    accuracy,
    description: id,
    effects: [],
  };
}

function makePlayer(overrides: Partial<PlayerSave> = {}): PlayerSave {
  return {
    version: 2,
    username: "tester",
    coins: 0,
    experience: 0,
    level: 1,
    currentHp: 100,
    currentMp: 50,
    attack: 10,
    defense: 0,
    speed: 10,
    accuracy: 0.8,
    locationKey: "start",
    position: { x: 0, y: 0 },
    facing: "down",
    visitedMainLocations: [],
    visitedLocationKeys: [],
    storyState: {},
    ownedEquipmentIds: Object.keys(equipmentById),
    equippedEquipmentIds: [],
    learnedSkillIds: [],
    learnedTacticIds: [],
    questCompletion: {},
    flags: {
      demonLordDefeated: false,
    },
    ...overrides,
  };
}

describe("equipment slots", () => {
  it("replaces equipment in the same slot while preserving other slots", () => {
    let player = makePlayer();

    player = applyEquipmentSelection(player, toggleEquippedEquipmentId(player, "equipment-sword", equipmentById), equipmentById);
    expect(player.equippedEquipmentIds).toEqual(["equipment-sword"]);
    expect(player.attack).toBe(15);
    expect(player.accuracy).toBe(0.9);

    player = applyEquipmentSelection(player, toggleEquippedEquipmentId(player, "equipment-armor", equipmentById), equipmentById);
    expect(player.equippedEquipmentIds).toEqual(["equipment-sword", "equipment-armor"]);
    expect(player.attack).toBe(17);
    expect(player.accuracy).toBe(0.9);

    player = applyEquipmentSelection(player, toggleEquippedEquipmentId(player, "equipment-bow", equipmentById), equipmentById);
    expect(player.equippedEquipmentIds).toEqual(["equipment-armor", "equipment-bow"]);
    expect(player.attack).toBe(20);
    expect(player.accuracy).toBe(0.75);
  });

  it("normalizes duplicate slots by keeping the first item in that slot", () => {
    expect(normalizeEquippedEquipmentIds(["equipment-sword", "equipment-bow", "equipment-armor"], equipmentById)).toEqual([
      "equipment-sword",
      "equipment-armor",
    ]);
  });
});
