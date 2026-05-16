import type { EquipmentDefinition, SkillDefinition } from "@rpg/game-core";

export type ShopActionCard = {
  title: string;
  description: string;
  meta: string;
  action: string;
};

function formatAccuracy(accuracy: number): string {
  return `명중 ${Math.round(accuracy * 100)}%`;
}

function joinSegments(segments: string[]): string {
  return segments.filter(Boolean).join(" · ");
}

export function describeEquipmentActionCard(
  equipment: EquipmentDefinition,
  options: { owned: boolean; equipped: boolean },
): ShopActionCard {
  const metaSegments = [
    equipment.attackBonus !== 0 ? `공격 ${equipment.attackBonus > 0 ? `+${equipment.attackBonus}` : equipment.attackBonus}` : "",
    equipment.manaCost > 0 ? `MP ${equipment.manaCost}` : "",
    formatAccuracy(equipment.accuracy),
  ];

  return {
    title: equipment.name,
    description: equipment.description,
    meta: joinSegments(metaSegments),
    action: options.owned ? (options.equipped ? "장착 해제/교체" : "장착") : `${equipment.cost} 코인 구매`,
  };
}

export function describeSkillActionCard(skill: SkillDefinition, learned: boolean): ShopActionCard {
  return {
    title: skill.name,
    description: skill.description,
    meta: joinSegments([
      `MP ${skill.manaCost}`,
      formatAccuracy(skill.accuracy),
    ]),
    action: learned ? "습득 완료" : `${skill.cost} 코인 습득`,
  };
}
