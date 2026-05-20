import type { EquipmentDefinition, EquipmentSlot, PlayerSave } from "../types";

export const EQUIPMENT_SLOT_ORDER: EquipmentSlot[] = ["weapon", "armor", "head", "hands", "feet", "accessory"];

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: "무기",
  armor: "방어구",
  head: "머리",
  hands: "손",
  feet: "발",
  accessory: "장신구",
};

export function getEquippedEquipment(
  equippedEquipmentIds: string[],
  equipmentById: Record<string, EquipmentDefinition>,
): EquipmentDefinition[] {
  return equippedEquipmentIds
    .map((id) => equipmentById[id])
    .filter((item): item is EquipmentDefinition => Boolean(item));
}

export function normalizeEquippedEquipmentIds(
  equippedEquipmentIds: string[],
  equipmentById: Record<string, EquipmentDefinition>,
): string[] {
  const usedSlots = new Set<EquipmentSlot>();
  const normalized: string[] = [];

  equippedEquipmentIds.forEach((id) => {
    const item = equipmentById[id];
    if (!item || usedSlots.has(item.slot)) {
      return;
    }

    usedSlots.add(item.slot);
    normalized.push(id);
  });

  return normalized;
}

export function toggleEquippedEquipmentId(
  player: PlayerSave,
  equipmentId: string,
  equipmentById: Record<string, EquipmentDefinition>,
): string[] {
  const item = equipmentById[equipmentId];
  if (!item || !player.ownedEquipmentIds.includes(equipmentId)) {
    return normalizeEquippedEquipmentIds(player.equippedEquipmentIds, equipmentById);
  }

  if (player.equippedEquipmentIds.includes(equipmentId)) {
    return player.equippedEquipmentIds.filter((id) => id !== equipmentId);
  }

  return normalizeEquippedEquipmentIds(
    [
      ...player.equippedEquipmentIds.filter((id) => equipmentById[id]?.slot !== item.slot),
      equipmentId,
    ],
    equipmentById,
  );
}

export function sumEquipmentAttackBonus(
  equippedEquipmentIds: string[],
  equipmentById: Record<string, EquipmentDefinition>,
): number {
  return getEquippedEquipment(equippedEquipmentIds, equipmentById).reduce((total, item) => total + item.attackBonus, 0);
}

export function selectEquipmentAccuracy(
  equippedEquipmentIds: string[],
  equipmentById: Record<string, EquipmentDefinition>,
): number {
  const equipped = getEquippedEquipment(equippedEquipmentIds, equipmentById);
  return equipped.find((item) => item.slot === "weapon")?.accuracy ?? equipped[0]?.accuracy ?? 0.8;
}

export function applyEquipmentSelection(
  player: PlayerSave,
  equippedEquipmentIds: string[],
  equipmentById: Record<string, EquipmentDefinition>,
): PlayerSave {
  const normalizedEquippedIds = normalizeEquippedEquipmentIds(equippedEquipmentIds, equipmentById);
  const baseAttack = player.attack - sumEquipmentAttackBonus(player.equippedEquipmentIds, equipmentById);

  return {
    ...player,
    attack: baseAttack + sumEquipmentAttackBonus(normalizedEquippedIds, equipmentById),
    accuracy: selectEquipmentAccuracy(normalizedEquippedIds, equipmentById),
    equippedEquipmentIds: normalizedEquippedIds,
  };
}
