import type {
  EffectDefinition,
  EffectFormula,
  EncounterZone,
  EnemyDefinition,
  EquipmentDefinition,
  LocationNode,
  SceneDefinition,
  SkillDefinition,
  TacticDefinition,
  WorldContent,
} from "./types";

export type ValidationIssue = {
  path: string;
  message: string;
};

const VALID_EFFECT_TRIGGERS = new Set<EffectDefinition["trigger"]>(["on_use", "on_turn_start", "on_turn_end", "on_hit"]);
const VALID_EFFECT_TARGETS = new Set<EffectDefinition["target"]>(["self", "opponent"]);
const VALID_FORMULA_SOURCES = new Set<EffectFormula["source"]>(["none", "self_attack", "target_attack"]);
const VALID_TACTIC_TYPES = new Set<TacticDefinition["type"]>(["charge", "multi", "guard_break", "evade"]);

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateFormula(formula: EffectFormula, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!VALID_FORMULA_SOURCES.has(formula.source)) {
    issues.push(issue(`${path}.source`, `Unknown formula source '${String(formula.source)}'.`));
  }

  if (formula.flat !== undefined && !isFiniteNumber(formula.flat)) {
    issues.push(issue(`${path}.flat`, "Formula flat value must be a finite number."));
  }

  if (formula.scale !== undefined && !isFiniteNumber(formula.scale)) {
    issues.push(issue(`${path}.scale`, "Formula scale value must be a finite number."));
  }

  if (formula.minimum !== undefined && !isFiniteNumber(formula.minimum)) {
    issues.push(issue(`${path}.minimum`, "Formula minimum must be a finite number."));
  }

  if (
    formula.rounding !== undefined
    && formula.rounding !== "round"
    && formula.rounding !== "floor"
    && formula.rounding !== "ceil"
  ) {
    issues.push(issue(`${path}.rounding`, `Unknown rounding mode '${String(formula.rounding)}'.`));
  }

  return issues;
}

export function validateEffects(effects: EffectDefinition[], path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  effects.forEach((effect, index) => {
    const effectPath = `${path}[${index}]`;

    if (!VALID_EFFECT_TRIGGERS.has(effect.trigger)) {
      issues.push(issue(`${effectPath}.trigger`, `Unknown effect trigger '${String(effect.trigger)}'.`));
    }

    if (!VALID_EFFECT_TARGETS.has(effect.target)) {
      issues.push(issue(`${effectPath}.target`, `Unknown effect target '${String(effect.target)}'.`));
    }

    if (effect.type === "damage" || effect.type === "heal") {
      issues.push(...validateFormula(effect.formula, `${effectPath}.formula`));

      if (effect.type === "damage" && effect.repeat !== undefined) {
        if (!Number.isInteger(effect.repeat) || effect.repeat <= 0) {
          issues.push(issue(`${effectPath}.repeat`, "Damage repeat must be a positive integer."));
        }
      }

      return;
    }

    if (!["hp", "mp", "attack", "defense", "speed", "accuracy"].includes(effect.stat)) {
      issues.push(issue(`${effectPath}.stat`, `Unknown stat '${String(effect.stat)}'.`));
    }

    if (effect.operation !== "add" && effect.operation !== "multiply") {
      issues.push(issue(`${effectPath}.operation`, `Unknown stat operation '${String(effect.operation)}'.`));
    }

    if (!isFiniteNumber(effect.value)) {
      issues.push(issue(`${effectPath}.value`, "Stat modifier value must be a finite number."));
    }

    if (effect.minimum !== undefined && !isFiniteNumber(effect.minimum)) {
      issues.push(issue(`${effectPath}.minimum`, "Stat modifier minimum must be a finite number."));
    }

    if (effect.durationTurns !== undefined && (!Number.isInteger(effect.durationTurns) || effect.durationTurns <= 0)) {
      issues.push(issue(`${effectPath}.durationTurns`, "durationTurns must be a positive integer when provided."));
    }
  });

  return issues;
}

function validateSkill(skill: SkillDefinition, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!skill.id) {
    issues.push(issue(`${path}.id`, "Skill id is required."));
  }

  if (!skill.name) {
    issues.push(issue(`${path}.name`, "Skill name is required."));
  }

  if (skill.effects.length === 0) {
    issues.push(issue(`${path}.effects`, "Skills must have at least one effect."));
  }

  issues.push(...validateEffects(skill.effects, `${path}.effects`));
  return issues;
}

function validateEquipment(equipment: EquipmentDefinition, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!equipment.id) {
    issues.push(issue(`${path}.id`, "Equipment id is required."));
  }

  if (!equipment.name) {
    issues.push(issue(`${path}.name`, "Equipment name is required."));
  }

  issues.push(...validateEffects(equipment.effects, `${path}.effects`));
  return issues;
}

function validateEnemy(enemy: EnemyDefinition, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!enemy.id) {
    issues.push(issue(`${path}.id`, "Enemy id is required."));
  }

  if (!enemy.name) {
    issues.push(issue(`${path}.name`, "Enemy name is required."));
  }

  if (enemy.maxHp <= 0) {
    issues.push(issue(`${path}.maxHp`, "Enemy maxHp must be greater than 0."));
  }

  if (enemy.specialAbility) {
    issues.push(...validateSkill(enemy.specialAbility, `${path}.specialAbility`));
  }

  return issues;
}

function validateSceneBounds(scene: SceneDefinition, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Number.isFinite(scene.width) || scene.width <= 0) {
    issues.push(issue(`${path}.width`, "Scene width must be greater than 0."));
  }

  if (!Number.isFinite(scene.height) || scene.height <= 0) {
    issues.push(issue(`${path}.height`, "Scene height must be greater than 0."));
  }

  if (scene.spawn.x < 0 || scene.spawn.x > scene.width || scene.spawn.y < 0 || scene.spawn.y > scene.height) {
    issues.push(issue(`${path}.spawn`, "Scene spawn must be inside the scene bounds."));
  }

  return issues;
}

function validateEncounterZone(zone: EncounterZone, world: WorldContent, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (zone.enemyIds.length === 0) {
    issues.push(issue(`${path}.enemyIds`, "Encounter zones must reference at least one enemy."));
  }

  zone.enemyIds.forEach((enemyId, index) => {
    if (!world.enemies[enemyId]) {
      issues.push(issue(`${path}.enemyIds[${index}]`, `Unknown enemy id '${enemyId}'.`));
    }
  });

  return issues;
}

function validateLocation(location: LocationNode, key: string, world: WorldContent, sceneIds: Set<string>, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (location.key !== key) {
    issues.push(issue(`${path}.key`, `Location key '${location.key}' does not match record key '${key}'.`));
  }

  if (!location.scene.sceneId) {
    issues.push(issue(`${path}.scene.sceneId`, "Every location must have a sceneId."));
  } else if (sceneIds.has(location.scene.sceneId)) {
    issues.push(issue(`${path}.scene.sceneId`, `Duplicate sceneId '${location.scene.sceneId}'.`));
  } else {
    sceneIds.add(location.scene.sceneId);
  }

  issues.push(...validateSceneBounds(location.scene, `${path}.scene`));

  location.connections.forEach((connection, index) => {
    if (!world.locations[connection.toLocationKey]) {
      issues.push(issue(`${path}.connections[${index}].toLocationKey`, `Unknown location '${connection.toLocationKey}'.`));
    }
  });

  location.scene.portals.forEach((portal, index) => {
    if (!world.locations[portal.toLocationKey]) {
      issues.push(issue(`${path}.scene.portals[${index}].toLocationKey`, `Unknown portal destination '${portal.toLocationKey}'.`));
    }
  });

  location.scene.encounterZones.forEach((zone, index) => {
    issues.push(...validateEncounterZone(zone, world, `${path}.scene.encounterZones[${index}]`));
  });

  return issues;
}

function validateUniqueIds<T extends { id: string }>(entries: T[], path: string, label: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();

  entries.forEach((entry, index) => {
    if (ids.has(entry.id)) {
      issues.push(issue(`${path}[${index}].id`, `Duplicate ${label} id '${entry.id}'.`));
    } else {
      ids.add(entry.id);
    }
  });

  return issues;
}

export function validateWorldContent(world: WorldContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!world.locations[world.startLocationKey]) {
    issues.push(issue("startLocationKey", `Unknown start location '${world.startLocationKey}'.`));
  }

  issues.push(...validateUniqueIds(world.skills, "skills", "skill"));
  issues.push(...validateUniqueIds(world.equipment, "equipment", "equipment"));
  issues.push(...validateUniqueIds(world.tactics, "tactics", "tactic"));
  issues.push(...validateUniqueIds(Object.values(world.enemies), "enemies", "enemy"));

  world.skills.forEach((skill, index) => {
    issues.push(...validateSkill(skill, `skills[${index}]`));
  });

  world.equipment.forEach((equipment, index) => {
    issues.push(...validateEquipment(equipment, `equipment[${index}]`));
  });

  world.tactics.forEach((tactic, index) => {
    if (!VALID_TACTIC_TYPES.has(tactic.type)) {
      issues.push(issue(`tactics[${index}].type`, `Unknown tactic type '${String(tactic.type)}'.`));
    }
  });

  Object.entries(world.enemies).forEach(([enemyId, enemy], index) => {
    if (enemy.id !== enemyId) {
      issues.push(issue(`enemies.${enemyId}.id`, `Enemy id '${enemy.id}' does not match record key '${enemyId}'.`));
    }
    issues.push(...validateEnemy(enemy, `enemies[${index}]`));
  });

  const sceneIds = new Set<string>();
  Object.entries(world.locations).forEach(([key, location], index) => {
    issues.push(...validateLocation(location, key, world, sceneIds, `locations[${index}]`));
  });

  Object.entries(world.enemiesByLocation).forEach(([locationKey, enemyIds]) => {
    if (!world.locations[locationKey]) {
      issues.push(issue(`enemiesByLocation.${locationKey}`, `Unknown location '${locationKey}'.`));
    }

    enemyIds.forEach((enemyId, index) => {
      if (!world.enemies[enemyId]) {
        issues.push(issue(`enemiesByLocation.${locationKey}[${index}]`, `Unknown enemy id '${enemyId}'.`));
      }
    });
  });

  return issues;
}

export function assertValidWorldContent(world: WorldContent): WorldContent {
  const issues = validateWorldContent(world);
  if (issues.length === 0) {
    return world;
  }

  const message = issues
    .slice(0, 20)
    .map((entry) => `- ${entry.path}: ${entry.message}`)
    .join("\n");

  throw new Error(`Invalid world content:\n${message}`);
}
