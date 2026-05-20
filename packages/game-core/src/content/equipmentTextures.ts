import type { EquipmentSlot } from "../types";

const GENERATED_ITEM_ROOT = "/assets/generated/items";

export const EQUIPMENT_TEXTURE_IDS = [
  "village-sword",
  "healing-sword",
  "wooden-hammer",
  "wooden-shield",
  "simple-bow",
  "heavy-axe",
  "iron-armor",
  "desert-longsword",
  "sand-hat",
  "sunlight-hat",
  "mountain-spear",
  "stone-gauntlet",
  "bamboo-spear",
  "crocodile-tooth-spear",
  "water-droplet-sword",
  "river-sword",
  "deep-sea-predator-blade",
  "kraken-tentacle-whip",
  "sky-sword",
  "light-sword",
  "grassland-dagger",
  "peace-guard-ring",
  "neighbor-longbow",
  "desert-sabre",
  "sand-buckler",
  "mountain-battle-axe",
  "snow-marching-boots",
  "swamp-thorn-spear",
  "upstream-whirlpool-amulet",
  "deep-sea-shell-armor",
  "sky-lightning-spear",
  "cosmic-gravity-ring",
] as const;

export type EquipmentTextureId = (typeof EQUIPMENT_TEXTURE_IDS)[number];

export const DEFAULT_EQUIPMENT_TEXTURE_ID: EquipmentTextureId = "village-sword";

export const EQUIPMENT_TEXTURES = Object.fromEntries(
  EQUIPMENT_TEXTURE_IDS.map((id) => [id, `${GENERATED_ITEM_ROOT}/item-${id}.png`]),
) as Record<EquipmentTextureId, string>;

const EQUIPMENT_NAME_TO_TEXTURE_ID: Record<string, EquipmentTextureId> = {
  "마을의 검": "village-sword",
  "치유의 검": "healing-sword",
  "나무 망치": "wooden-hammer",
  "나무 방패": "wooden-shield",
  "활": "simple-bow",
  "도끼": "heavy-axe",
  "철 갑옷": "iron-armor",
  "사막 장검": "desert-longsword",
  "모래 모자": "sand-hat",
  "햇빛 모자": "sunlight-hat",
  "산맥 창": "mountain-spear",
  "바위 장갑": "stone-gauntlet",
  "죽창": "bamboo-spear",
  "악어 이빨 창": "crocodile-tooth-spear",
  "물방울 검": "water-droplet-sword",
  "강의 검": "river-sword",
  "바다의 포식자": "deep-sea-predator-blade",
  "크라켄의 촉수": "kraken-tentacle-whip",
  "하늘의 검": "sky-sword",
  "빛의 검": "light-sword",
  "초원의 단도": "grassland-dagger",
  "평화의 가드링": "peace-guard-ring",
  "이웃의 장궁": "neighbor-longbow",
  "사막의 사브르": "desert-sabre",
  "모래방패 버클러": "sand-buckler",
  "산길의 전투도끼": "mountain-battle-axe",
  "빙설 행군화": "snow-marching-boots",
  "습지의 가시창": "swamp-thorn-spear",
  "상류의 소용돌이 부적": "upstream-whirlpool-amulet",
  "심해의 등껍질 갑옷": "deep-sea-shell-armor",
  "하늘의 번개 창": "sky-lightning-spear",
  "우주의 중력석 반지": "cosmic-gravity-ring",
};

const EQUIPMENT_TEXTURE_ID_TO_SLOT: Record<EquipmentTextureId, EquipmentSlot> = {
  "village-sword": "weapon",
  "healing-sword": "weapon",
  "wooden-hammer": "weapon",
  "wooden-shield": "hands",
  "simple-bow": "weapon",
  "heavy-axe": "weapon",
  "iron-armor": "armor",
  "desert-longsword": "weapon",
  "sand-hat": "head",
  "sunlight-hat": "head",
  "mountain-spear": "weapon",
  "stone-gauntlet": "hands",
  "bamboo-spear": "weapon",
  "crocodile-tooth-spear": "weapon",
  "water-droplet-sword": "weapon",
  "river-sword": "weapon",
  "deep-sea-predator-blade": "weapon",
  "kraken-tentacle-whip": "weapon",
  "sky-sword": "weapon",
  "light-sword": "weapon",
  "grassland-dagger": "weapon",
  "peace-guard-ring": "accessory",
  "neighbor-longbow": "weapon",
  "desert-sabre": "weapon",
  "sand-buckler": "hands",
  "mountain-battle-axe": "weapon",
  "snow-marching-boots": "feet",
  "swamp-thorn-spear": "weapon",
  "upstream-whirlpool-amulet": "accessory",
  "deep-sea-shell-armor": "armor",
  "sky-lightning-spear": "weapon",
  "cosmic-gravity-ring": "accessory",
};

export function getEquipmentTextureId(name: string): EquipmentTextureId {
  return EQUIPMENT_NAME_TO_TEXTURE_ID[name] ?? DEFAULT_EQUIPMENT_TEXTURE_ID;
}

export function getEquipmentSlot(name: string): EquipmentSlot {
  return EQUIPMENT_TEXTURE_ID_TO_SLOT[getEquipmentTextureId(name)] ?? "weapon";
}

export function getEquipmentTexturePath(name: string): string {
  return EQUIPMENT_TEXTURES[getEquipmentTextureId(name)];
}

export function getEquipmentTexturePaths(): string[] {
  return Object.values(EQUIPMENT_TEXTURES);
}
