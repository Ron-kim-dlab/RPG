import { describe, expect, it } from "vitest";
import type { EquipmentDefinition, SkillDefinition } from "@rpg/game-core";
import { describeEquipmentActionCard, describeSkillActionCard } from "../src/ui/actionCards";

const equipment: EquipmentDefinition = {
  id: "equipment-bronze-sword",
  itemType: "equipment",
  slot: "weapon",
  name: "청동 검",
  texturePath: "/assets/generated/items/item-village-sword.png",
  village: "시작의 마을",
  cost: 120,
  attackBonus: 7,
  manaCost: 0,
  accuracy: 0.92,
  description: "초반 지역에서 안정적으로 쓰기 좋은 검입니다.",
  effects: [],
};

const skill: SkillDefinition = {
  id: "skill-fireball",
  name: "화염구",
  village: "시작의 마을",
  cost: 90,
  manaCost: 12,
  accuracy: 0.85,
  description: "적 하나에게 화염 피해를 주는 기본 마법입니다.",
  effects: [],
};

describe("shop action card helpers", () => {
  it("includes equipment descriptions and purchase state", () => {
    const card = describeEquipmentActionCard(equipment, { owned: false, equipped: false });

    expect(card.description).toBe(equipment.description);
    expect(card.meta).toContain("무기");
    expect(card.meta).toContain("공격 +7");
    expect(card.meta).toContain("명중 92%");
    expect(card.action).toBe("120 코인 구매");
  });

  it("uses equipped state labels for owned equipment", () => {
    const card = describeEquipmentActionCard(equipment, { owned: true, equipped: true });

    expect(card.action).toBe("장착 해제/교체");
  });

  it("includes skill descriptions and casting stats", () => {
    const card = describeSkillActionCard(skill, false);

    expect(card.description).toBe(skill.description);
    expect(card.meta).toContain("MP 12");
    expect(card.meta).toContain("명중 85%");
    expect(card.action).toBe("90 코인 습득");
  });
});
