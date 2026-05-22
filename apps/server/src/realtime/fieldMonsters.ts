import type {
  EncounterZone,
  FieldMonsterClaimResult,
  FieldMonsterState,
  SceneDefinition,
  WorldContent,
} from "@rpg/game-core";

const MAX_NORMAL_MONSTERS_PER_SCENE = 20;
const MONSTER_HITBOX_SIZE = 36;
const MONSTER_SPACING = 44;
const BLOCKING_BUFFER = 28;

type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SceneSpawnConfig = {
  scene: SceneDefinition;
  normalEnemyIds: string[];
  bossEnemyId?: string;
};

type RefillOptions = {
  fillNormal: boolean;
  ensureBoss: boolean;
};

function expandRectangle(rectangle: Rectangle, amount: number): Rectangle {
  return {
    x: rectangle.x - amount,
    y: rectangle.y - amount,
    width: rectangle.width + amount * 2,
    height: rectangle.height + amount * 2,
  };
}

function rectanglesOverlap(left: Rectangle, right: Rectangle): boolean {
  return (
    left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
  );
}

function monsterHitbox(x: number, y: number): Rectangle {
  return {
    x: x - MONSTER_HITBOX_SIZE / 2,
    y: y - MONSTER_HITBOX_SIZE / 2,
    width: MONSTER_HITBOX_SIZE,
    height: MONSTER_HITBOX_SIZE,
  };
}

function copyMonster(monster: FieldMonsterState): FieldMonsterState {
  return { ...monster };
}

export class FieldMonsterManager {
  private readonly sceneConfigs = new Map<string, SceneSpawnConfig>();
  private readonly monstersByScene = new Map<string, FieldMonsterState[]>();
  private nextMonsterId = 1;

  constructor(
    private readonly world: WorldContent,
    private readonly rng: () => number = Math.random,
  ) {
    this.buildSceneConfigs();
    this.refillAll({ fillNormal: true, ensureBoss: true });
  }

  getSceneMonsters(sceneId: string): FieldMonsterState[] {
    return (this.monstersByScene.get(sceneId) ?? []).map(copyMonster);
  }

  refillAll(options: RefillOptions = { fillNormal: true, ensureBoss: true }): string[] {
    const changedSceneIds = new Set<string>();
    this.sceneConfigs.forEach((_config, sceneId) => {
      if (this.refillScene(sceneId, options)) {
        changedSceneIds.add(sceneId);
      }
    });
    return Array.from(changedSceneIds);
  }

  claimMonster(sceneId: string, monsterId: string, username: string): {
    result: FieldMonsterClaimResult;
    changedSceneIds: string[];
  } {
    const monsters = this.monstersByScene.get(sceneId);
    const monster = monsters?.find((entry) => entry.id === monsterId);
    if (!monsters || !monster) {
      return { result: { ok: false, reason: "not_found" }, changedSceneIds: [] };
    }

    if (monster.inBattleBy && monster.inBattleBy !== username) {
      return { result: { ok: false, reason: "busy" }, changedSceneIds: [] };
    }

    monster.inBattleBy = username;
    const changedSceneIds = new Set<string>([sceneId]);
    if (monster.isBoss && this.refillScene(sceneId, { fillNormal: false, ensureBoss: true })) {
      changedSceneIds.add(sceneId);
    }

    return {
      result: { ok: true, monster: copyMonster(monster) },
      changedSceneIds: Array.from(changedSceneIds),
    };
  }

  completeBattle(monsterId: string, username: string): string[] {
    const changedSceneIds = new Set<string>();
    for (const [sceneId, monsters] of this.monstersByScene.entries()) {
      const index = monsters.findIndex((monster) => monster.id === monsterId);
      if (index < 0) {
        continue;
      }

      const monster = monsters[index];
      if (!monster || monster.inBattleBy !== username) {
        return [];
      }

      monsters.splice(index, 1);
      changedSceneIds.add(sceneId);
      if (monster.isBoss && this.refillScene(sceneId, { fillNormal: false, ensureBoss: true })) {
        changedSceneIds.add(sceneId);
      }
      return Array.from(changedSceneIds);
    }
    return [];
  }

  releaseBusyMonstersForUser(username: string): string[] {
    const changedSceneIds = new Set<string>();
    this.monstersByScene.forEach((monsters, sceneId) => {
      let removedBoss = false;
      for (let index = monsters.length - 1; index >= 0; index -= 1) {
        const monster = monsters[index];
        if (monster?.inBattleBy !== username) {
          continue;
        }
        removedBoss = removedBoss || monster.isBoss;
        monsters.splice(index, 1);
        changedSceneIds.add(sceneId);
      }

      if (removedBoss && this.refillScene(sceneId, { fillNormal: false, ensureBoss: true })) {
        changedSceneIds.add(sceneId);
      }
    });
    return Array.from(changedSceneIds);
  }

  private buildSceneConfigs(): void {
    Object.values(this.world.locations).forEach((location) => {
      const scene = location.scene;
      if (scene.encounterZones.length === 0) {
        return;
      }

      const encounterEnemyIds = Array.from(new Set(scene.encounterZones.flatMap((zone) => zone.enemyIds)));
      const normalEnemyIds = encounterEnemyIds.filter((enemyId) => {
        const enemy = this.world.enemies[enemyId];
        return Boolean(enemy && !enemy.isBoss);
      });
      const bossEnemyId = encounterEnemyIds.find((enemyId) => Boolean(this.world.enemies[enemyId]?.isBoss));
      if (normalEnemyIds.length === 0 && !bossEnemyId) {
        return;
      }

      this.sceneConfigs.set(scene.sceneId, {
        scene,
        normalEnemyIds,
        bossEnemyId,
      });
      this.monstersByScene.set(scene.sceneId, []);
    });
  }

  private refillScene(sceneId: string, options: RefillOptions): boolean {
    const config = this.sceneConfigs.get(sceneId);
    const monsters = this.monstersByScene.get(sceneId);
    if (!config || !monsters) {
      return false;
    }

    let changed = false;
    if (options.fillNormal) {
      while (monsters.filter((monster) => !monster.isBoss).length < MAX_NORMAL_MONSTERS_PER_SCENE) {
        const spawned = this.spawnNormalMonster(config, monsters);
        if (!spawned) {
          break;
        }
        monsters.push(spawned);
        changed = true;
      }
    }

    if (options.ensureBoss) {
      changed = this.ensureAvailableBoss(config, monsters) || changed;
    }

    return changed;
  }

  private spawnNormalMonster(config: SceneSpawnConfig, existingMonsters: FieldMonsterState[]): FieldMonsterState | null {
    if (config.normalEnemyIds.length === 0) {
      return null;
    }

    const enemyId = this.pickWeightedEnemy(config.normalEnemyIds);
    return this.createMonster(config, enemyId, false, existingMonsters);
  }

  private ensureAvailableBoss(config: SceneSpawnConfig, existingMonsters: FieldMonsterState[]): boolean {
    if (!config.bossEnemyId) {
      return false;
    }

    const hasAvailableBoss = existingMonsters.some((monster) => monster.isBoss && !monster.inBattleBy);
    if (hasAvailableBoss) {
      return false;
    }

    const boss = this.createMonster(config, config.bossEnemyId, true, existingMonsters);
    if (!boss) {
      return false;
    }
    existingMonsters.push(boss);
    return true;
  }

  private createMonster(
    config: SceneSpawnConfig,
    enemyId: string,
    isBoss: boolean,
    existingMonsters: FieldMonsterState[],
  ): FieldMonsterState | null {
    const enemy = this.world.enemies[enemyId];
    if (!enemy) {
      return null;
    }

    const zones = this.getZonesForEnemy(config.scene, enemyId);
    const position = this.pickSpawnPosition(config.scene, zones, existingMonsters);
    if (!position) {
      return null;
    }

    return {
      id: `field-monster-${this.nextMonsterId++}`,
      sceneId: config.scene.sceneId,
      enemyId,
      enemyName: enemy.name,
      texturePath: enemy.texturePath,
      x: Math.round(position.x),
      y: Math.round(position.y),
      isBoss,
      spawnedAt: new Date().toISOString(),
    };
  }

  private pickWeightedEnemy(enemyIds: string[]): string {
    const totalWeight = enemyIds.reduce((sum, enemyId) => sum + this.getSpawnWeight(enemyId), 0);
    let threshold = this.rng() * totalWeight;
    for (const enemyId of enemyIds) {
      threshold -= this.getSpawnWeight(enemyId);
      if (threshold <= 0) {
        return enemyId;
      }
    }
    return enemyIds[enemyIds.length - 1] as string;
  }

  private getSpawnWeight(enemyId: string): number {
    const spawnRate = this.world.enemies[enemyId]?.spawnRate;
    return typeof spawnRate === "number" && Number.isFinite(spawnRate) && spawnRate > 0 ? spawnRate : 1;
  }

  private getZonesForEnemy(scene: SceneDefinition, enemyId: string): EncounterZone[] {
    const matchingZones = scene.encounterZones.filter((zone) => zone.enemyIds.includes(enemyId));
    return matchingZones.length > 0 ? matchingZones : scene.encounterZones;
  }

  private pickSpawnPosition(
    scene: SceneDefinition,
    zones: EncounterZone[],
    existingMonsters: FieldMonsterState[],
  ): { x: number; y: number } | null {
    const blockingRects = this.createBlockingRectangles(scene);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const zone = zones[Math.floor(this.rng() * zones.length)];
      if (!zone) {
        return null;
      }
      const x = zone.x + MONSTER_HITBOX_SIZE / 2 + this.rng() * Math.max(1, zone.width - MONSTER_HITBOX_SIZE);
      const y = zone.y + MONSTER_HITBOX_SIZE / 2 + this.rng() * Math.max(1, zone.height - MONSTER_HITBOX_SIZE);
      if (this.canPlaceMonster(x, y, scene, blockingRects, existingMonsters)) {
        return { x, y };
      }
    }

    for (const zone of zones) {
      for (let y = zone.y + MONSTER_HITBOX_SIZE / 2; y <= zone.y + zone.height - MONSTER_HITBOX_SIZE / 2; y += MONSTER_SPACING) {
        for (let x = zone.x + MONSTER_HITBOX_SIZE / 2; x <= zone.x + zone.width - MONSTER_HITBOX_SIZE / 2; x += MONSTER_SPACING) {
          if (this.canPlaceMonster(x, y, scene, blockingRects, existingMonsters)) {
            return { x, y };
          }
        }
      }
    }

    return null;
  }

  private canPlaceMonster(
    x: number,
    y: number,
    scene: SceneDefinition,
    blockingRects: Rectangle[],
    existingMonsters: FieldMonsterState[],
  ): boolean {
    const hitbox = monsterHitbox(x, y);
    if (hitbox.x < 0 || hitbox.y < 0 || hitbox.x + hitbox.width > scene.width || hitbox.y + hitbox.height > scene.height) {
      return false;
    }

    if (blockingRects.some((rectangle) => rectanglesOverlap(hitbox, rectangle))) {
      return false;
    }

    return existingMonsters.every((monster) => {
      const distance = Math.hypot(monster.x - x, monster.y - y);
      return distance >= MONSTER_SPACING;
    });
  }

  private createBlockingRectangles(scene: SceneDefinition): Rectangle[] {
    const npcBlocks = scene.npcs.map((npc) =>
      expandRectangle({ x: npc.x - 24, y: npc.y - 32, width: 48, height: 64 }, BLOCKING_BUFFER),
    );
    const portalBlocks = scene.portals.map((portal) => expandRectangle(portal, BLOCKING_BUFFER));
    const collisionBlocks = scene.collisionZones.map((zone) => expandRectangle(zone, 6));
    const spawnBlock = expandRectangle({ x: scene.spawn.x - 28, y: scene.spawn.y - 28, width: 56, height: 56 }, 18);
    return [...npcBlocks, ...portalBlocks, ...collisionBlocks, spawnBlock];
  }
}
