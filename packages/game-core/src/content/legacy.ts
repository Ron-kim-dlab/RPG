import type {
  EffectDefinition,
  EquipmentDefinition,
  LegacyBossData,
  LegacyEquipmentData,
  LegacyMapData,
  LegacyMonsterData,
  LegacySkillData,
  LegacyTacticData,
  LocationNode,
  SkillDefinition,
  TacticDefinition,
  WorldContent,
} from "../types";
import { toLocationKey, toStableId } from "../utils/id";
import { assertValidWorldContent } from "../validation";

const LEGACY_LOCATION_ALIASES: Record<string, string> = {
  [toLocationKey("산길", "불꽃 산길")]: toLocationKey("산길", "얼음 산길"),
};

const LEGACY_BOSS_TEMPLATE_ALIASES: Record<string, string> = {
  "진흙 거인": "물먹는 하마",
  "하늘의 눈동자": "악마 독수리",
  "화성의 화염 수호자": "화성의 불 수호자",
};

function resolveLegacyLocationKey(mainLocation: string, subLocation: string): string {
  const rawKey = toLocationKey(mainLocation, subLocation);
  return LEGACY_LOCATION_ALIASES[rawKey] ?? rawKey;
}

function resolveBossTemplateName(name: string): string {
  return LEGACY_BOSS_TEMPLATE_ALIASES[name] ?? name;
}

function parseFunctionBody(code: string): string {
  const trimmed = code.trim();
  const match = trimmed.match(/^\(monster,\s*user\)\s*=>\s*\{([\s\S]*)\}$/) ?? trimmed.match(/^\(monster,user\)=>\{([\s\S]*)\}$/);
  if (!match) {
    throw new Error(`Unsupported effect function format: ${code}`);
  }
  const [, body] = match;
  if (!body) {
    throw new Error(`Missing function body: ${code}`);
  }
  return body.replace(/\s+/g, "");
}

function damageEffect(
  trigger: EffectDefinition["trigger"],
  target: "self" | "opponent",
  options: { flat?: number; scale?: number; source?: "none" | "self_attack" | "target_attack"; minimum?: number; repeat?: number },
): EffectDefinition {
  return {
    type: "damage",
    trigger,
    target,
    repeat: options.repeat,
    formula: {
      source: options.source ?? "none",
      flat: options.flat,
      scale: options.scale,
      minimum: options.minimum,
      rounding: "round",
    },
  };
}

function healEffect(
  trigger: EffectDefinition["trigger"],
  target: "self" | "opponent",
  options: { flat?: number; scale?: number; source?: "none" | "self_attack" | "target_attack"; minimum?: number; clampToMax?: boolean },
): EffectDefinition {
  return {
    type: "heal",
    trigger,
    target,
    clampToMax: options.clampToMax,
    formula: {
      source: options.source ?? "none",
      flat: options.flat,
      scale: options.scale,
      minimum: options.minimum,
      rounding: "round",
    },
  };
}

function statEffect(
  trigger: EffectDefinition["trigger"],
  target: "self" | "opponent",
  stat: "attack" | "defense" | "speed" | "accuracy" | "hp" | "mp",
  operation: "add" | "multiply",
  value: number,
  minimum?: number,
): EffectDefinition {
  return {
    type: "stat_modifier",
    trigger,
    target,
    stat,
    operation,
    value,
    minimum,
  };
}

export function parseLegacyAbility(code: string, trigger: EffectDefinition["trigger"]): EffectDefinition[] {
  const body = parseFunctionBody(code);

  const directDamage = body.match(/^monster\.체력-=Math\.round\(user\.공격력\*([0-9.]+)\);$/);
  if (directDamage) {
    return [damageEffect(trigger, "opponent", { source: "self_attack", scale: Number(directDamage[1]) })];
  }

  const directDamageWithFlat = body.match(/^monster\.체력-=Math\.round\(([0-9.]+)\+user\.공격력\*([0-9.]+)\);$/);
  if (directDamageWithFlat) {
    return [
      damageEffect(trigger, "opponent", {
        flat: Number(directDamageWithFlat[1]),
        source: "self_attack",
        scale: Number(directDamageWithFlat[2]),
      }),
    ];
  }

  const minScaledDamage = body.match(/^monster\.체력-=Math\.max\(([0-9.]+),Math\.round\(user\.공격력\*([0-9.]+)\)\);$/);
  if (minScaledDamage) {
    return [
      damageEffect(trigger, "opponent", {
        minimum: Number(minScaledDamage[1]),
        source: "self_attack",
        scale: Number(minScaledDamage[2]),
      }),
    ];
  }

  const reflectedDamage = body.match(/^monster\.체력-=Math\.max\(([0-9.]+),Math\.round\(monster\.공격력\|\|0\)\);$/);
  if (reflectedDamage) {
    return [
      damageEffect(trigger, "opponent", {
        minimum: Number(reflectedDamage[1]),
        source: "target_attack",
        scale: 1,
      }),
    ];
  }

  const flatMonsterDamage = body.match(/^monster\.체력-=([0-9.]+);$/);
  if (flatMonsterDamage) {
    return [damageEffect(trigger, "opponent", { flat: Number(flatMonsterDamage[1]) })];
  }

  const flatPlayerDamage = body.match(/^user\.체력-=([0-9.]+);$/);
  if (flatPlayerDamage) {
    return [damageEffect(trigger, "opponent", { flat: Number(flatPlayerDamage[1]) })];
  }

  const monsterScaledDamage = body.match(/^user\.체력-=Math\.round\(monster\.공격력\*([0-9.]+)\);$/);
  if (monsterScaledDamage) {
    return [damageEffect(trigger, "opponent", { source: "self_attack", scale: Number(monsterScaledDamage[1]) })];
  }

  const directMonsterAttackDamage = body.match(/^user\.체력-=Math\.round\(monster\.공격력\);$/);
  if (directMonsterAttackDamage) {
    return [damageEffect(trigger, "opponent", { source: "self_attack", scale: 1 })];
  }

  const monsterScaledDamageWithMinimum = body.match(/^user\.체력-=Math\.max\(([0-9.]+),Math\.round\(monster\.공격력\*([0-9.]+)\)\);$/);
  if (monsterScaledDamageWithMinimum) {
    return [
      damageEffect(trigger, "opponent", {
        minimum: Number(monsterScaledDamageWithMinimum[1]),
        source: "self_attack",
        scale: Number(monsterScaledDamageWithMinimum[2]),
      }),
    ];
  }

  const monsterFlatScaledDamage = body.match(/^user\.체력-=Math\.round\(([0-9.]+)\+monster\.공격력\*([0-9.]+)\);$/);
  if (monsterFlatScaledDamage) {
    return [
      damageEffect(trigger, "opponent", {
        flat: Number(monsterFlatScaledDamage[1]),
        source: "self_attack",
        scale: Number(monsterFlatScaledDamage[2]),
      }),
    ];
  }

  const maxHpHeal = body.match(/^constmax=Game\.functions\.getMaxHP\(user\);user\.체력=Math\.min\(max,user\.체력\+([0-9.]+)\);$/);
  if (maxHpHeal) {
    return [healEffect(trigger, "self", { flat: Number(maxHpHeal[1]), clampToMax: true })];
  }

  const scaledMaxHpHeal = body.match(/^constmax=Game\.functions\.getMaxHP\(user\);user\.체력=Math\.min\(max,user\.체력\+Math\.(?:round|floor)\(user\.공격력\*([0-9.]+)\)\);$/);
  if (scaledMaxHpHeal) {
    return [healEffect(trigger, "self", { source: "self_attack", scale: Number(scaledMaxHpHeal[1]), clampToMax: true })];
  }

  const directHeal = body.match(/^user\.체력\+=([0-9.]+);$/);
  if (directHeal) {
    return [healEffect(trigger, "self", { flat: Number(directHeal[1]) })];
  }

  const monsterDirectHeal = body.match(/^monster\.체력\+=([0-9.]+);$/);
  if (monsterDirectHeal) {
    return [healEffect(trigger, "self", { flat: Number(monsterDirectHeal[1]) })];
  }

  const drainBasedOnPlayerAttack = body.match(/^constv=Math\.max\(1,user\.공격력\);monster\.체력-=v;constmax=Game\.functions\.getMaxHP\(user\);user\.체력=Math\.min\(max,user\.체력\+v\);$/);
  if (drainBasedOnPlayerAttack) {
    return [
      damageEffect(trigger, "opponent", { source: "self_attack", scale: 1, minimum: 1 }),
      healEffect(trigger, "self", { source: "self_attack", scale: 1, minimum: 1, clampToMax: true }),
    ];
  }

  const drainBasedOnMonsterAttack = body.match(/^constd=Math\.round\(monster\.공격력\*([0-9.]+)\);user\.체력-=d;monster\.체력\+=Math\.round\(d\*([0-9.]+)\);$/);
  if (drainBasedOnMonsterAttack) {
    return [
      damageEffect(trigger, "opponent", { source: "self_attack", scale: Number(drainBasedOnMonsterAttack[1]) }),
      healEffect(trigger, "self", { source: "self_attack", scale: Number(drainBasedOnMonsterAttack[1]) * Number(drainBasedOnMonsterAttack[2]) }),
    ];
  }

  const repeatedDamage = body.match(/^constd=Math\.round\(monster\.공격력\*([0-9.]+)\);user\.체력-=d;if\(user\.체력>0\)user\.체력-=d;$/);
  if (repeatedDamage) {
    return [damageEffect(trigger, "opponent", { source: "self_attack", scale: Number(repeatedDamage[1]), repeat: 2 })];
  }

  const addSelfDefense = body.match(/^user\.방어력\+=([0-9.]+);$/);
  if (addSelfDefense) {
    return [statEffect(trigger, "self", "defense", "add", Number(addSelfDefense[1]))];
  }

  const addEnemyStat = body.match(/^monster\.(공격력|방어력|속도)\+=([0-9.]+);$/);
  if (addEnemyStat) {
    const stat = addEnemyStat[1] === "공격력" ? "attack" : addEnemyStat[1] === "방어력" ? "defense" : "speed";
    return [statEffect(trigger, "self", stat, "add", Number(addEnemyStat[2]))];
  }

  const multiplyEnemyAttack = body.match(/^monster\.공격력=Math\.round\(monster\.공격력\*([0-9.]+)\);$/);
  if (multiplyEnemyAttack) {
    return [statEffect(trigger, "self", "attack", "multiply", Number(multiplyEnemyAttack[1]), 0)];
  }

  const reduceEnemyAttack = body.match(/^monster\.공격력=Math\.max\(0,Math\.(?:floor|round)\(\(monster\.공격력\|\|0\)\*([0-9.]+)\)\);$/);
  if (reduceEnemyAttack) {
    return [statEffect(trigger, "opponent", "attack", "multiply", Number(reduceEnemyAttack[1]), 0)];
  }

  const reduceEnemyAttackFlat = body.match(/^monster\.공격력=Math\.max\(0,Math\.floor\(\(monster\.공격력\|\|0\)-([0-9.]+)\)\);$/);
  if (reduceEnemyAttackFlat) {
    return [statEffect(trigger, "opponent", "attack", "add", -Number(reduceEnemyAttackFlat[1]), 0)];
  }

  const reduceEnemyAccuracy = body.match(/^monster\.명중률=Math\.max\(([0-9.]+),\(monster\.명중률\|\|[0-9.]+\)-([0-9.]+)\);$/);
  if (reduceEnemyAccuracy) {
    return [statEffect(trigger, "opponent", "accuracy", "add", -Number(reduceEnemyAccuracy[2]), Number(reduceEnemyAccuracy[1]))];
  }

  const reduceEnemyDefense = body.match(/^monster\.방어력=Math\.max\(0,\(monster\.방어력\|\|0\)-([0-9.]+)\);$/);
  if (reduceEnemyDefense) {
    return [statEffect(trigger, "opponent", "defense", "add", -Number(reduceEnemyDefense[1]), 0)];
  }

  const damageAndAccuracyDebuff = body.match(/^monster\.체력-=Math\.round\(user\.공격력\*([0-9.]+)\);monster\.명중률=Math\.max\(([0-9.]+),\(monster\.명중률\|\|[0-9.]+\)-([0-9.]+)\);$/);
  if (damageAndAccuracyDebuff) {
    return [
      damageEffect(trigger, "opponent", { source: "self_attack", scale: Number(damageAndAccuracyDebuff[1]) }),
      statEffect(trigger, "opponent", "accuracy", "add", -Number(damageAndAccuracyDebuff[3]), Number(damageAndAccuracyDebuff[2])),
    ];
  }

  const damageAndAttackDebuff = body.match(/^monster\.체력-=Math\.round\(user\.공격력\*([0-9.]+)\);monster\.공격력=Math\.max\(0,Math\.round\(\(monster\.공격력\|\|0\)\*([0-9.]+)\)\);$/);
  if (damageAndAttackDebuff) {
    return [
      damageEffect(trigger, "opponent", { source: "self_attack", scale: Number(damageAndAttackDebuff[1]) }),
      statEffect(trigger, "opponent", "attack", "multiply", Number(damageAndAttackDebuff[2]), 0),
    ];
  }

  const damageAndHeal = body.match(/^constd=Math\.round\(user\.공격력\*([0-9.]+)\);monster\.체력-=d;constmax=Game\.functions\.getMaxHP\(user\);user\.체력=Math\.min\(max,user\.체력\+Math\.round\(user\.공격력\*([0-9.]+)\)\);$/);
  if (damageAndHeal) {
    return [
      damageEffect(trigger, "opponent", { source: "self_attack", scale: Number(damageAndHeal[1]) }),
      healEffect(trigger, "self", { source: "self_attack", scale: Number(damageAndHeal[2]), clampToMax: true }),
    ];
  }

  throw new Error(`Unsupported legacy ability body: ${body}`);
}

function areaColor(mainLocation: string): string {
  const colors: Record<string, string> = {
    "시작의 마을": "#2b6b4d",
    "시작의 땅": "#497d33",
    "평화의 마을": "#3c7e80",
    "이웃 마을": "#7c6b3b",
    사막: "#9e7e3b",
    산길: "#6c7a89",
    늪지: "#556b2f",
    하천: "#2f6f91",
    바다: "#1f4f9b",
    하늘: "#7096d1",
    우주: "#463f78",
    "마왕의 성": "#6d2f42",
  };

  return colors[mainLocation] ?? "#34506b";
}

function buildScene(mainLocation: string, subLocation: string, story: string[], enemyIds: string[], connectionKeys: Array<{ label: string; toLocationKey: string }>) {
  const sceneId = toStableId("scene", `${mainLocation}-${subLocation}`);
  const width = 1024;
  const height = 768;
  const portalSlots = [
    { x: width / 2 - 50, y: 12, width: 100, height: 24 },
    { x: width - 36, y: height / 2 - 50, width: 24, height: 100 },
    { x: width / 2 - 50, y: height - 36, width: 100, height: 24 },
    { x: 12, y: height / 2 - 50, width: 24, height: 100 },
  ];

  return {
    sceneId,
    width,
    height,
    backgroundColor: areaColor(mainLocation),
    spawn: { x: width / 2, y: height - 120 },
    portals: connectionKeys.map((connection, index) => {
      const slot = portalSlots[index % portalSlots.length]!;
      return {
        id: toStableId("portal", `${sceneId}-${connection.toLocationKey}`),
        label: connection.label,
        toLocationKey: connection.toLocationKey,
        ...slot,
      };
    }),
    npcs: story.length > 0
      ? [
          {
            id: toStableId("npc", `${sceneId}-guide`),
            name: `${subLocation} 안내자`,
            x: width / 2,
            y: 160,
            lines: story,
          },
        ]
      : [],
    encounterZones: enemyIds.length > 0
      ? [
          {
            id: toStableId("encounter", sceneId),
            x: width / 2 - 180,
            y: height / 2,
            width: 360,
            height: 180,
            enemyIds,
          },
        ]
      : [],
  };
}

export function buildWorldContentFromLegacy(input: {
  map: LegacyMapData;
  skills: LegacySkillData;
  equipment: LegacyEquipmentData;
  monsters: LegacyMonsterData;
  bosses: LegacyBossData;
  tactics: LegacyTacticData;
}): WorldContent {
  const ensureBossRecord = (
    referenceName: string,
    boss: LegacyBossData[string],
    enemyRecords: WorldContent["enemies"],
  ): string => {
    const id = toStableId("boss", referenceName);
    if (enemyRecords[id]) {
      return id;
    }

    enemyRecords[id] = {
      id,
      name: referenceName,
      maxHp: boss.체력,
      attack: boss.공격력,
      defense: boss.방어력,
      speed: boss.속도,
      accuracy: boss.명중률,
      mana: boss.MP,
      experienceReward: boss.경험치 * 5,
      coinReward: boss.경험치 * 15,
      specialChance: 0.3,
      isBoss: true,
      specialAbility: boss.특수능력
        ? {
            id: toStableId("boss-skill", `${referenceName}-${boss.특수능력.이름}`),
            name: boss.특수능력.이름,
            description: boss.특수능력.이름,
            cost: 0,
            manaCost: boss.특수능력.MP소모,
            accuracy: 1,
            effects: parseLegacyAbility(boss.특수능력.능력, "on_use"),
          }
        : undefined,
    };

    return id;
  };

  const skills: SkillDefinition[] = input.skills.map((skill) => ({
    id: toStableId("skill", skill.이름),
    name: skill.이름,
    description: skill.설명 ?? `${skill.이름} 기술`,
    village: skill.판매마을,
    cost: skill.cost,
    manaCost: skill.MP소모,
    accuracy: skill.명중률,
    effects: parseLegacyAbility(skill.능력, "on_use"),
  }));

  const equipment: EquipmentDefinition[] = input.equipment.map((item) => ({
    id: toStableId("equipment", item.이름),
    name: item.이름,
    village: item.판매마을,
    cost: item.cost,
    attackBonus: item.공격력 ?? 0,
    manaCost: item.MP소모 ?? 0,
    accuracy: item.명중률 ?? 0.8,
    description:
      (typeof item.능력 === "object" ? item.능력?.설명 : undefined)
      ?? item.설명
      ?? `${item.이름} 장비`,
    effects: item.능력
      ? parseLegacyAbility(typeof item.능력 === "string" ? item.능력 : item.능력.능력, "on_turn_end")
      : [],
  }));

  const tactics: TacticDefinition[] = input.tactics.map((tactic) => ({
    id: toStableId("tactic", tactic.이름),
    name: tactic.이름,
    description: tactic.설명,
    type:
      tactic.효과 === "charge"
        ? "charge"
        : tactic.효과 === "multi"
          ? "multi"
          : tactic.효과 === "guard_break"
            ? "guard_break"
            : "evade",
    hits: tactic.타수,
    coefficient: tactic.계수,
    durationTurns: tactic.턴수,
  }));

  const enemyRecords: WorldContent["enemies"] = {};
  const enemiesByLocation: WorldContent["enemiesByLocation"] = {};

  Object.entries(input.monsters).forEach(([mainLocation, subLocations]) => {
    Object.entries(subLocations).forEach(([subLocation, enemies]) => {
      const locationKey = resolveLegacyLocationKey(mainLocation, subLocation);
      enemiesByLocation[locationKey] = enemies.map((enemy) => {
        const id = toStableId("enemy", `${mainLocation}-${subLocation}-${enemy.이름}`);
        enemyRecords[id] = {
          id,
          name: enemy.이름,
          maxHp: enemy.체력,
          attack: enemy.공격력,
          defense: enemy.방어력,
          speed: enemy.속도,
          accuracy: enemy.명중률,
          mana: enemy.MP,
          experienceReward: enemy.경험치,
          coinReward: enemy.경험치 * 10,
          specialChance: 0.3,
          specialAbility: enemy.특수능력
            ? {
                id: toStableId("enemy-skill", `${enemy.이름}-${enemy.특수능력.이름}`),
                name: enemy.특수능력.이름,
                description: enemy.특수능력.이름,
                cost: 0,
                manaCost: enemy.특수능력.MP소모,
                accuracy: 1,
                effects: parseLegacyAbility(enemy.특수능력.능력, "on_use"),
              }
            : undefined,
        };
        return id;
      });
    });
  });

  Object.entries(input.bosses).forEach(([name, boss]) => {
    ensureBossRecord(name, boss, enemyRecords);
  });

  const locations: Record<string, LocationNode> = {};
  Object.entries(input.map).forEach(([mainLocation, subLocations]) => {
    Object.entries(subLocations).forEach(([subLocation, location]) => {
      const key = toLocationKey(mainLocation, subLocation);
      const connections = (location.연결 ?? []).map((connection) => {
        if (typeof connection === "string") {
          return {
            main: mainLocation,
            sub: connection,
            toLocationKey: toLocationKey(mainLocation, connection),
          };
        }

        return {
          main: connection.main,
          sub: connection.sub,
          branch: connection.branch,
          toLocationKey: toLocationKey(connection.main, connection.sub),
        };
      });

      const enemyIds = location.보스
        ? (() => {
            const templateName = resolveBossTemplateName(location.보스);
            const boss = input.bosses[templateName];
            return boss ? [ensureBossRecord(location.보스, boss, enemyRecords)] : [toStableId("boss", location.보스)];
          })()
        : enemiesByLocation[key] ?? [];

      locations[key] = {
        key,
        mainLocation,
        subLocation,
        story: location.스토리 ?? [],
        bossName: location.보스,
        connections,
        scene: buildScene(
          mainLocation,
          subLocation,
          location.스토리 ?? [],
          enemyIds,
          connections.map((connection) => ({
            label: connection.sub,
            toLocationKey: connection.toLocationKey,
          })),
        ),
      };
    });
  });

  return assertValidWorldContent({
    startLocationKey: toLocationKey("시작의 마을", "마을 입구"),
    locations,
    equipment,
    skills,
    tactics,
    enemies: enemyRecords,
    enemiesByLocation,
  });
}
