import type {
  BattleAction,
  BattleResolution,
  BattleState,
  CombatantRuntime,
  EffectDefinition,
  EffectFormula,
  EnemyDefinition,
  EquipmentDefinition,
  PlayerSave,
  SkillDefinition,
  TacticDefinition,
} from "../types";
import { applyLevelUps, getMaxHp, getMaxMp } from "./player";
import { clamp, pickRandom, toStableId } from "../utils/id";

function toRuntimePlayer(player: PlayerSave): CombatantRuntime {
  return {
    id: toStableId("player", player.username),
    name: player.username,
    currentHp: player.currentHp,
    maxHp: getMaxHp(player.level),
    currentMp: player.currentMp,
    maxMp: getMaxMp(player.level),
    attack: player.attack,
    defense: player.defense,
    speed: player.speed,
    accuracy: player.accuracy,
  };
}

function toRuntimeEnemy(enemy: EnemyDefinition): CombatantRuntime {
  return {
    id: enemy.id,
    name: enemy.name,
    currentHp: enemy.currentHp ?? enemy.maxHp,
    maxHp: enemy.maxHp,
    currentMp: enemy.mana,
    maxMp: enemy.mana,
    attack: enemy.attack,
    defense: enemy.defense,
    speed: enemy.speed,
    accuracy: enemy.accuracy,
  };
}

function resolveFormula(
  formula: EffectFormula,
  self: CombatantRuntime,
  target: CombatantRuntime,
): number {
  const base = formula.flat ?? 0;
  const scale = formula.scale ?? 0;
  const sourceValue =
    formula.source === "self_attack"
      ? self.attack
      : formula.source === "target_attack"
        ? target.attack
        : 0;
  const rawValue = base + sourceValue * scale;

  const rounded =
    formula.rounding === "floor"
      ? Math.floor(rawValue)
      : formula.rounding === "ceil"
        ? Math.ceil(rawValue)
        : Math.round(rawValue);

  return Math.max(formula.minimum ?? Number.NEGATIVE_INFINITY, rounded);
}

function applyEffect(
  effect: EffectDefinition,
  self: CombatantRuntime,
  target: CombatantRuntime,
  log: string[],
): void {
  const subject = effect.target === "self" ? self : target;

  if (effect.type === "damage") {
    const repeat = effect.repeat ?? 1;
    for (let index = 0; index < repeat; index += 1) {
      const value = Math.max(0, resolveFormula(effect.formula, self, target));
      subject.currentHp -= value;
      log.push(`${subject.name}에게 ${value} 피해.`);
      if (subject.currentHp <= 0) {
        subject.currentHp = 0;
        break;
      }
    }
    return;
  }

  if (effect.type === "heal") {
    const value = Math.max(0, resolveFormula(effect.formula, self, target));
    const nextValue = effect.clampToMax
      ? Math.min(subject.maxHp, subject.currentHp + value)
      : subject.currentHp + value;
    subject.currentHp = nextValue;
    log.push(`${subject.name} 회복 ${value}.`);
    return;
  }

  if (effect.operation === "add") {
    const nextValue = (subject[effect.stat === "hp" ? "currentHp" : effect.stat === "mp" ? "currentMp" : effect.stat] as number) + effect.value;
    if (effect.stat === "hp") subject.currentHp = nextValue;
    else if (effect.stat === "mp") subject.currentMp = nextValue;
    else subject[effect.stat] = nextValue;
  } else {
    const currentValue = effect.stat === "hp" ? subject.currentHp : effect.stat === "mp" ? subject.currentMp : subject[effect.stat];
    const nextValue = currentValue * effect.value;
    if (effect.stat === "hp") subject.currentHp = nextValue;
    else if (effect.stat === "mp") subject.currentMp = nextValue;
    else subject[effect.stat] = nextValue;
  }

  if (typeof effect.minimum === "number") {
    if (effect.stat === "hp") subject.currentHp = Math.max(effect.minimum, subject.currentHp);
    else if (effect.stat === "mp") subject.currentMp = Math.max(effect.minimum, subject.currentMp);
    else subject[effect.stat] = Math.max(effect.minimum, subject[effect.stat]);
  }

  log.push(`${subject.name}의 ${effect.stat} 변화.`);
}

function applyTriggeredEffects(
  effects: EffectDefinition[],
  trigger: EffectDefinition["trigger"],
  self: CombatantRuntime,
  target: CombatantRuntime,
  log: string[],
): void {
  effects
    .filter((effect) => effect.trigger === trigger)
    .forEach((effect) => applyEffect(effect, self, target, log));
}

function getEquippedItems(
  player: PlayerSave,
  equipment: Record<string, EquipmentDefinition>,
): EquipmentDefinition[] {
  return player.equippedEquipmentIds
    .map((equipmentId) => equipment[equipmentId])
    .filter((entry): entry is EquipmentDefinition => Boolean(entry));
}

function applyEquipmentTriggeredEffects(
  equippedItems: EquipmentDefinition[],
  trigger: EffectDefinition["trigger"],
  self: CombatantRuntime,
  target: CombatantRuntime,
  log: string[],
): void {
  equippedItems.forEach((equipment) => applyTriggeredEffects(equipment.effects, trigger, self, target, log));
}

function finalizePlayerSnapshot(player: PlayerSave, runtime: CombatantRuntime): PlayerSave {
  return {
    ...player,
    currentHp: clamp(runtime.currentHp, 0, runtime.maxHp),
    currentMp: clamp(runtime.currentMp, 0, runtime.maxMp),
    attack: runtime.attack,
    defense: runtime.defense,
    speed: runtime.speed,
    accuracy: runtime.accuracy,
  };
}

export function createBattle(player: PlayerSave, enemy: EnemyDefinition): BattleState {
  return {
    id: `${player.username}-${enemy.id}-${Date.now()}`,
    enemyId: enemy.id,
    player: toRuntimePlayer(player),
    enemy: toRuntimeEnemy(enemy),
    isBoss: Boolean(enemy.isBoss),
    turnNumber: 1,
    charged: false,
    evadeNext: false,
    guardBreakTurns: 0,
    finished: false,
    log: [`${enemy.name}과(와) 조우했습니다.`],
  };
}

function rewardPlayer(player: PlayerSave, enemy: EnemyDefinition, tacticPool: TacticDefinition[], rng: () => number): { player: PlayerSave; logs: string[] } {
  let rewarded: PlayerSave = {
    ...player,
    experience: player.experience + enemy.experienceReward,
    coins: player.coins + enemy.coinReward,
  };

  const logs = [
    `${enemy.name} 처치! 경험치 ${enemy.experienceReward}, 코인 ${enemy.coinReward} 획득.`,
  ];

  const leveled = applyLevelUps(rewarded);
  rewarded = leveled.player;
  logs.push(...leveled.messages);

  if (rng() < 0.01) {
    const learned = new Set(rewarded.learnedTacticIds);
    const candidates = tacticPool.filter((tactic) => !learned.has(tactic.id));
    if (candidates.length > 0) {
      const drop = pickRandom(candidates, rng);
      rewarded = {
        ...rewarded,
        learnedTacticIds: [...rewarded.learnedTacticIds, drop.id],
      };
      logs.push(`신규 전술 습득: ${drop.name}`);
    }
  }

  return { player: rewarded, logs };
}

export function performBattleAction(params: {
  player: PlayerSave;
  state: BattleState;
  action: BattleAction;
  skills: Record<string, SkillDefinition>;
  tactics: Record<string, TacticDefinition>;
  equipment: Record<string, EquipmentDefinition>;
  enemies: Record<string, EnemyDefinition>;
  rng?: () => number;
}): BattleResolution {
  const rng = params.rng ?? Math.random;
  const state = structuredClone(params.state);
  let player = structuredClone(params.player);
  const logs = [...state.log];
  const enemyDef = params.enemies[state.enemyId];

  if (!enemyDef) {
    throw new Error(`Unknown enemy id: ${state.enemyId}`);
  }

  const playerRuntime = state.player;
  const enemyRuntime = state.enemy;
  const equippedItems = getEquippedItems(player, params.equipment);

  if (state.finished) {
    return { player, state, logs, requiresFollowUpAction: false };
  }

  applyEquipmentTriggeredEffects(equippedItems, "on_turn_start", playerRuntime, enemyRuntime, logs);

  if (params.action.kind === "skill") {
    const skill = params.skills[params.action.skillId];
    if (!skill) {
      throw new Error(`Unknown skill id: ${params.action.skillId}`);
    }
    if (!player.learnedSkillIds.includes(skill.id)) {
      throw new Error(`Player does not know skill ${skill.id}`);
    }
    if (playerRuntime.currentMp < skill.manaCost) {
      logs.push("MP가 부족합니다.");
      player = finalizePlayerSnapshot(player, playerRuntime);
      state.player = toRuntimePlayer(player);
      state.enemy = {
        ...enemyRuntime,
        currentHp: clamp(enemyRuntime.currentHp, 0, enemyRuntime.maxHp),
        currentMp: clamp(enemyRuntime.currentMp, 0, enemyRuntime.maxMp),
      };
      state.log = logs;
      return { player, state, logs, requiresFollowUpAction: true };
    }

    playerRuntime.currentMp -= skill.manaCost;
    if (rng() > skill.accuracy) {
      logs.push(`${skill.name} 사용 실패.`);
      player = finalizePlayerSnapshot(player, playerRuntime);
      state.player = toRuntimePlayer(player);
      state.enemy = {
        ...enemyRuntime,
        currentHp: clamp(enemyRuntime.currentHp, 0, enemyRuntime.maxHp),
        currentMp: clamp(enemyRuntime.currentMp, 0, enemyRuntime.maxMp),
      };
      state.log = logs;
      return { player, state, logs, requiresFollowUpAction: true };
    }

    const enemyHpBeforeSkill = enemyRuntime.currentHp;
    applyTriggeredEffects(skill.effects, "on_use", playerRuntime, enemyRuntime, logs);
    if (enemyRuntime.currentHp < enemyHpBeforeSkill) {
      applyEquipmentTriggeredEffects(equippedItems, "on_hit", playerRuntime, enemyRuntime, logs);
    }
    player = finalizePlayerSnapshot(player, playerRuntime);
    state.player = toRuntimePlayer(player);
    state.enemy = {
      ...enemyRuntime,
      currentHp: clamp(enemyRuntime.currentHp, 0, enemyRuntime.maxHp),
      currentMp: clamp(enemyRuntime.currentMp, 0, enemyRuntime.maxMp),
    };
    state.log = logs;
    return { player, state, logs, requiresFollowUpAction: true };
  }

  let attackMultiplier = 1;
  let defendMultiplier = 1;
  let skipPlayerAttack = false;
  const enemyHpBeforePlayerAction = enemyRuntime.currentHp;

  if (params.action.kind === "attack") {
    attackMultiplier = 1.5;
    defendMultiplier = 1.5;
  } else if (params.action.kind === "defend") {
    attackMultiplier = 0.5;
    defendMultiplier = 0.5;
  } else if (params.action.kind === "tactic") {
    const tactic = params.tactics[params.action.tacticId];
    if (!tactic) {
      throw new Error(`Unknown tactic id: ${params.action.tacticId}`);
    }
    if (!player.learnedTacticIds.includes(tactic.id)) {
      throw new Error(`Player does not know tactic ${tactic.id}`);
    }

    if (tactic.type === "charge") {
      state.charged = true;
      skipPlayerAttack = true;
      logs.push(`${tactic.name}: 다음 공격이 강화됩니다.`);
    } else if (tactic.type === "guard_break") {
      state.guardBreakTurns = Math.max(state.guardBreakTurns, tactic.durationTurns ?? 2);
      skipPlayerAttack = true;
      logs.push(`${tactic.name}: 적의 방어가 약화됩니다.`);
    } else if (tactic.type === "evade") {
      state.evadeNext = true;
      skipPlayerAttack = true;
      logs.push(`${tactic.name}: 다음 반격 회피 확률 증가.`);
    } else if (tactic.type === "multi") {
      const hits = tactic.hits ?? 2;
      const coefficient = tactic.coefficient ?? 0.7;
      for (let index = 0; index < hits; index += 1) {
        const guardMultiplier = state.guardBreakTurns > 0 ? 0.5 : 1;
        const damage = Math.max(
          0,
          Math.round(playerRuntime.attack * coefficient - enemyRuntime.defense * 0.5 * guardMultiplier),
        );
        enemyRuntime.currentHp = Math.max(0, enemyRuntime.currentHp - damage);
        logs.push(`${tactic.name} ${index + 1}타: ${damage} 피해.`);
        if (enemyRuntime.currentHp <= 0) {
          break;
        }
      }
    }
  }

  if (!skipPlayerAttack && enemyRuntime.currentHp > 0) {
    const guardBrokenDefense = state.guardBreakTurns > 0 ? Math.floor(enemyRuntime.defense * 0.5) : enemyRuntime.defense;
    let damage = Math.max(0, Math.round(playerRuntime.attack * attackMultiplier - guardBrokenDefense * 0.5));
    if (state.charged) {
      damage = Math.round(damage * 2);
      state.charged = false;
    }
    enemyRuntime.currentHp = Math.max(0, enemyRuntime.currentHp - damage);
    logs.push(`플레이어 ${params.action.kind}: ${damage} 피해.`);
  }

  if (enemyRuntime.currentHp < enemyHpBeforePlayerAction) {
    applyEquipmentTriggeredEffects(equippedItems, "on_hit", playerRuntime, enemyRuntime, logs);
  }

  if (enemyRuntime.currentHp <= 0) {
    state.finished = true;
    state.outcome = "player_win";
  }

  const enemySpecial = enemyDef.specialAbility;
  if (!state.finished && !skipPlayerAttack && enemySpecial && enemyRuntime.currentMp >= enemySpecial.manaCost && rng() < (enemyDef.specialChance ?? 0.3)) {
    enemyRuntime.currentMp -= enemySpecial.manaCost;
    logs.push(`${enemyRuntime.name}의 ${enemySpecial.name}!`);
    applyTriggeredEffects(enemySpecial.effects, "on_use", enemyRuntime, playerRuntime, logs);
  } else if (!state.finished) {
    const hitChance = playerRuntime.accuracy + playerRuntime.speed * 0.01 - enemyRuntime.speed * 0.01 - (state.evadeNext ? 0.5 : 0);
    if (rng() <= hitChance) {
      const damage = Math.max(0, Math.round(enemyRuntime.attack * defendMultiplier - playerRuntime.defense * 0.5));
      playerRuntime.currentHp = Math.max(0, playerRuntime.currentHp - damage);
      logs.push(`${enemyRuntime.name} 반격: ${damage} 피해.`);
    } else {
      logs.push(`${enemyRuntime.name}의 공격이 빗나갔습니다.`);
    }
  }

  state.evadeNext = false;
  if (state.guardBreakTurns > 0) {
    state.guardBreakTurns -= 1;
  }

  if (enemyRuntime.currentHp > 0 && playerRuntime.currentHp > 0) {
    applyEquipmentTriggeredEffects(equippedItems, "on_turn_end", playerRuntime, enemyRuntime, logs);
  }

  if (playerRuntime.currentHp <= 0 && enemyRuntime.currentHp <= 0) {
    state.finished = true;
    state.outcome = rng() >= 0.5 ? "player_win" : "enemy_win";
  } else if (playerRuntime.currentHp <= 0) {
    state.finished = true;
    state.outcome = "enemy_win";
  } else if (enemyRuntime.currentHp <= 0) {
    state.finished = true;
    state.outcome = "player_win";
  }

  player = finalizePlayerSnapshot(player, playerRuntime);

  if (state.finished && state.outcome === "enemy_win") {
    player = {
      ...player,
      coins: 0,
      currentHp: getMaxHp(player.level),
      currentMp: getMaxMp(player.level),
      locationKey: "시작의 마을::여관",
      position: { x: 512, y: 384 },
    };
    logs.push("패배했습니다. 시작의 마을 여관에서 부활합니다.");
  }

  if (state.finished && state.outcome === "player_win") {
    const rewarded = rewardPlayer(player, enemyDef, Object.values(params.tactics), rng);
    player = rewarded.player;
    logs.push(...rewarded.logs);
  }

  state.turnNumber += 1;
  state.player = toRuntimePlayer(player);
  state.enemy = {
    ...enemyRuntime,
    currentHp: clamp(enemyRuntime.currentHp, 0, enemyRuntime.maxHp),
    currentMp: clamp(enemyRuntime.currentMp, 0, enemyRuntime.maxMp),
  };
  state.log = logs;

  return {
    player,
    state,
    logs,
    requiresFollowUpAction: !state.finished,
  };
}
