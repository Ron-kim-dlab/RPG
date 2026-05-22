import Phaser from "phaser";
import {
  getDeathGraveTexturePath,
  getPlayerAvatarTexturePath,
  type DeathGraveState,
  type DialogueNpc,
  type EncounterZone,
  type Facing,
  type FieldMonsterState,
  type PlayerSave,
  type PresenceState,
  type SceneDefinition,
  type WorldContent,
} from "@rpg/game-core";
import type { FieldPrompt, OverlayMode } from "../gameplay";

type SceneCallbacks = {
  canMove: () => boolean;
  isGameplayInputBlocked: () => boolean;
  getPlayerAvatarId: () => string;
  getOverlayMode: () => OverlayMode;
  hasPendingLocationStory: () => boolean;
  onPositionChange: (x: number, y: number, facing: Facing) => void;
  onSceneChange: (locationKey: string) => void;
  onOpenLocationStory: () => void;
  onInteractNpc: (npc: DialogueNpc) => void;
  onInteractGrave: (grave: DeathGraveState) => void;
  onFieldMonsterContact: (monster: FieldMonsterState) => void;
  onFieldPromptChange: (prompt: FieldPrompt) => void;
};

type TiledProperty = {
  name: string;
  value: string | number | boolean;
};

type TiledObject = {
  id: number;
  name: string;
  class?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProperty[];
};

type TiledObjectLayer = {
  name: string;
  type: "objectgroup";
  objects: TiledObject[];
};

type TiledMapData = {
  layers: TiledObjectLayer[];
};

type RemotePlayerSprite = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  avatarId: string;
  targetX: number;
  targetY: number;
};

type FieldMonsterSprite = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  texturePath: string;
  zoneId?: string;
  wanderTween?: Phaser.Tweens.Tween;
};

type DeathGraveSprite = {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
};

const REMOTE_INTERPOLATION_SPEED = 12;
const REMOTE_SNAP_DISTANCE = 240;
const LOCAL_PLAYER_SYNC_SNAP_DISTANCE = 96;
const OBSTACLE_SPEED_MULTIPLIER = 0.35;
const MONSTER_CONTACT_DISTANCE = 42;
const BOSS_CONTACT_DISTANCE = 58;
const GRAVE_INTERACTION_DISTANCE = 58;
const MONSTER_CONTACT_COOLDOWN_MS = 1200;

export class OverworldScene extends Phaser.Scene {
  private world: WorldContent | null = null;
  private playerState: PlayerSave | null = null;
  private sceneDefinition: SceneDefinition | null = null;
  private callbacks: SceneCallbacks | null = null;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private remoteSprites = new Map<string, RemotePlayerSprite>();
  private fieldMonsterSprites = new Map<string, FieldMonsterSprite>();
  private deathGraveSprites = new Map<string, DeathGraveSprite>();
  private fieldMonsters: FieldMonsterState[] = [];
  private deathGraves: DeathGraveState[] = [];
  private portals: Array<{ zone: Phaser.Geom.Rectangle; locationKey: string; label: string }> = [];
  private encounterZones: Array<{ zone: Phaser.Geom.Rectangle; data: EncounterZone }> = [];
  private collisionZones: Phaser.Geom.Rectangle[] = [];
  private npcMarkers: Array<{ sprite: Phaser.GameObjects.Sprite; npc: DialogueNpc }> = [];
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private hintText!: Phaser.GameObjects.Text;
  private overlayShade!: Phaser.GameObjects.Rectangle;
  private overlayText!: Phaser.GameObjects.Text;
  private lastPresenceSentAt = 0;
  private lastBroadcastKey = "";
  private lastPromptKey = "";
  private lastFieldMonsterContactId = "";
  private lastFieldMonsterContactAt = 0;
  private gameplayCaptureDisabled = false;

  constructor() {
    super("overworld");
  }

  create(): void {
    this.cursorKeys = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey("W");
    this.keyA = this.input.keyboard!.addKey("A");
    this.keyS = this.input.keyboard!.addKey("S");
    this.keyD = this.input.keyboard!.addKey("D");
    this.keyEnter = this.input.keyboard!.addKey("ENTER");
    this.keySpace = this.input.keyboard!.addKey("SPACE");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.resetKeys();
      this.gameplayCaptureDisabled = false;
    });

    if (this.world && this.playerState) {
      this.buildLocation();
    }
  }

  attach(world: WorldContent, player: PlayerSave, callbacks: SceneCallbacks): void {
    const sameLocation = this.playerState?.locationKey === player.locationKey && this.sceneDefinition;
    this.world = world;
    this.playerState = player;
    this.callbacks = callbacks;
    if (!this.sys.isActive()) {
      return;
    }
    if (!sameLocation) {
      this.buildLocation();
    }
  }

  sync(
    player: PlayerSave,
    nearbyPlayers: PresenceState[],
    fieldMonsters: FieldMonsterState[],
    deathGraves: DeathGraveState[],
  ): void {
    const previousSceneId = this.sceneDefinition?.sceneId;
    const location = this.world?.locations[player.locationKey];
    if (location && location.scene.sceneId !== previousSceneId) {
      this.playerState = player;
      this.buildLocation();
    }
    this.fieldMonsters = fieldMonsters.filter((monster) => monster.sceneId === this.sceneDefinition?.sceneId);
    this.deathGraves = deathGraves.filter((grave) => grave.sceneId === this.sceneDefinition?.sceneId);

    if (this.playerSprite) {
      const syncDistance = Phaser.Math.Distance.Between(
        this.playerSprite.x,
        this.playerSprite.y,
        player.position.x,
        player.position.y,
      );
      if (syncDistance > LOCAL_PLAYER_SYNC_SNAP_DISTANCE || location?.scene.sceneId !== previousSceneId) {
        this.playerSprite.setPosition(player.position.x, player.position.y);
      }
      this.playerState = {
        ...player,
        position: {
          x: this.playerSprite.x,
          y: this.playerSprite.y,
        },
      };
    } else {
      this.playerState = player;
    }
    this.syncFieldMonsterSprites(this.fieldMonsters);
    this.syncDeathGraveSprites(this.deathGraves);

    const activeUsers = new Set<string>();
    nearbyPlayers
      .filter((presence) => presence.username !== player.username && presence.sceneId === this.sceneDefinition?.sceneId)
      .forEach((presence) => {
        activeUsers.add(presence.username);
        this.syncRemotePresence(presence);
      });

    Array.from(this.remoteSprites.entries()).forEach(([username, remote]) => {
      if (!activeUsers.has(username)) {
        remote.container.destroy();
        this.remoteSprites.delete(username);
      }
    });
  }

  update(time: number, delta: number): void {
    if (!this.playerState || !this.callbacks || !this.sceneDefinition || !this.playerSprite || !this.hintText || !this.overlayShade || !this.overlayText) {
      return;
    }

    const overlayMode = this.callbacks.getOverlayMode();
    const gameplayInputBlocked = this.callbacks.isGameplayInputBlocked();
    this.syncGameplayCapture(gameplayInputBlocked);
    this.interpolateRemoteSprites(delta);
    const canExplore = overlayMode === "explore" && this.callbacks.canMove() && !gameplayInputBlocked;
    const speed = canExplore ? 160 : 0;
    let velocityX = 0;
    let velocityY = 0;
    let facing: Facing = this.playerState.facing;

    if (canExplore) {
      if (this.cursorKeys.left.isDown || this.keyA.isDown) {
        velocityX = -1;
        facing = "left";
      } else if (this.cursorKeys.right.isDown || this.keyD.isDown) {
        velocityX = 1;
        facing = "right";
      }

      if (this.cursorKeys.up.isDown || this.keyW.isDown) {
        velocityY = -1;
        facing = "up";
      } else if (this.cursorKeys.down.isDown || this.keyS.isDown) {
        velocityY = 1;
        facing = "down";
      }
    }

    const baseDistance = speed * (delta / 1000);
    const intendedX = Phaser.Math.Clamp(this.playerSprite.x + velocityX * baseDistance, 36, this.sceneDefinition.width - 36);
    const intendedY = Phaser.Math.Clamp(this.playerSprite.y + velocityY * baseDistance, 36, this.sceneDefinition.height - 36);
    const speedMultiplier = this.getObstacleSpeedMultiplier(this.playerSprite.x, this.playerSprite.y, intendedX, intendedY);
    const distance = baseDistance * speedMultiplier;
    const nextX = Phaser.Math.Clamp(this.playerSprite.x + velocityX * distance, 36, this.sceneDefinition.width - 36);
    const nextY = Phaser.Math.Clamp(this.playerSprite.y + velocityY * distance, 36, this.sceneDefinition.height - 36);

    this.playerSprite.setPosition(nextX, nextY);
    this.playerState = {
      ...this.playerState,
      position: { x: nextX, y: nextY },
      facing,
    };

    const broadcastKey = `${Math.round(nextX)}:${Math.round(nextY)}:${facing}`;
    if (canExplore && time - this.lastPresenceSentAt > 120 && broadcastKey !== this.lastBroadcastKey) {
      this.callbacks.onPositionChange(nextX, nextY, facing);
      this.lastPresenceSentAt = time;
      this.lastBroadcastKey = broadcastKey;
    }

    const activePortal = this.findActivePortal(nextX, nextY);
    const activeNpc = this.findActiveNpc(nextX, nextY);
    const activeGrave = this.findActiveGrave(nextX, nextY);
    const activeFieldMonster = this.findActiveFieldMonster(nextX, nextY);
    const hasPendingLocationStory = this.callbacks.hasPendingLocationStory();
    const prompt = this.resolvePrompt({
      overlayMode,
      hasPendingLocationStory,
      portal: activePortal,
      npc: activeNpc?.npc ?? null,
      grave: activeGrave,
    });
    this.syncFieldPrompt(prompt);
    this.syncOverlayState(overlayMode);
    this.syncWorldHint(prompt);

    if (!canExplore) {
      return;
    }

    if (activePortal && Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
      this.callbacks.onSceneChange(activePortal.locationKey);
      return;
    }

    if (!activePortal && !activeNpc && hasPendingLocationStory) {
      if (Phaser.Input.Keyboard.JustDown(this.keySpace) || Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        this.callbacks.onOpenLocationStory();
        return;
      }
    }

    if (activeNpc && Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.callbacks.onInteractNpc(activeNpc.npc);
      return;
    }

    if (activeGrave && Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.callbacks.onInteractGrave(activeGrave);
      return;
    }

    if (activeFieldMonster) {
      const shouldContact = this.lastFieldMonsterContactId !== activeFieldMonster.id
        || time - this.lastFieldMonsterContactAt > MONSTER_CONTACT_COOLDOWN_MS;
      if (shouldContact) {
        this.lastFieldMonsterContactId = activeFieldMonster.id;
        this.lastFieldMonsterContactAt = time;
        this.callbacks.onFieldMonsterContact(activeFieldMonster);
      }
      return;
    }

    this.lastFieldMonsterContactId = "";
  }

  private syncRemotePresence(presence: PresenceState): void {
    const existing = this.remoteSprites.get(presence.username);
    const texturePath = getPlayerAvatarTexturePath(presence.avatarId);
    if (existing) {
      existing.targetX = presence.x;
      existing.targetY = presence.y;
      if (existing.avatarId !== presence.avatarId) {
        existing.sprite.setTexture(texturePath);
        existing.avatarId = presence.avatarId;
      }
      return;
    }

    const sprite = this.add
      .sprite(0, 0, texturePath)
      .setDisplaySize(30, 30);
    const label = this.createReadableLabel(0, -24, presence.username, {
      color: "#fefae0",
      depth: 6,
      fontFamily: "Space Mono, monospace",
      fontSize: "11px",
      originY: 1,
    });
    const container = this.add.container(presence.x, presence.y, [sprite, label]).setDepth(5);
    this.remoteSprites.set(presence.username, {
      container,
      sprite,
      avatarId: presence.avatarId,
      targetX: presence.x,
      targetY: presence.y,
    });
  }

  private interpolateRemoteSprites(delta: number): void {
    const blend = 1 - Math.exp(-REMOTE_INTERPOLATION_SPEED * (delta / 1000));
    this.remoteSprites.forEach((remote) => {
      const distance = Phaser.Math.Distance.Between(
        remote.container.x,
        remote.container.y,
        remote.targetX,
        remote.targetY,
      );

      if (distance > REMOTE_SNAP_DISTANCE) {
        remote.container.setPosition(remote.targetX, remote.targetY);
        return;
      }

      const nextX = Phaser.Math.Linear(remote.container.x, remote.targetX, blend);
      const nextY = Phaser.Math.Linear(remote.container.y, remote.targetY, blend);
      remote.container.setPosition(nextX, nextY);
    });
  }

  private syncFieldMonsterSprites(monsters: FieldMonsterState[]): void {
    if (!this.sceneDefinition) {
      return;
    }

    const activeIds = new Set<string>();
    monsters.forEach((monster) => {
      activeIds.add(monster.id);
      const existing = this.fieldMonsterSprites.get(monster.id);
      if (existing) {
        existing.container.setAlpha(monster.inBattleBy ? 0.42 : 1);
        existing.label.setText(monster.inBattleBy ? `${monster.enemyName} (전투 중)` : monster.enemyName);
        if (existing.texturePath !== monster.texturePath) {
          existing.sprite.setTexture(monster.texturePath);
          existing.texturePath = monster.texturePath;
        }
        if (monster.inBattleBy) {
          existing.wanderTween?.stop();
          existing.wanderTween = undefined;
        } else if (existing.zoneId !== monster.zoneId || !existing.wanderTween) {
          existing.wanderTween?.stop();
          existing.zoneId = monster.zoneId;
          this.startMonsterWander(monster, existing);
        }
        return;
      }

      const displaySize = monster.isBoss ? 56 : 40;
      const shadow = this.add.ellipse(0, displaySize / 2 - 6, displaySize * 0.8, 12, 0x06100d, 0.38);
      const sprite = this.add
        .sprite(0, 0, monster.texturePath)
        .setDisplaySize(displaySize, displaySize);
      if (monster.isBoss) {
        sprite.setTint(0xffe08a);
      }
      const label = this.createReadableLabel(0, -displaySize / 2 - 8, monster.enemyName, {
        backgroundColor: monster.isBoss ? "rgba(66, 28, 16, 0.92)" : "rgba(8, 22, 17, 0.9)",
        color: monster.isBoss ? "#fff1b8" : "#f8fafc",
        depth: monster.isBoss ? 8 : 6,
        fontSize: monster.isBoss ? "12px" : "11px",
        originY: 1,
      });
      const container = this.add
        .container(monster.x, monster.y, [shadow, sprite, label])
        .setDepth(monster.isBoss ? 7 : 5)
        .setAlpha(monster.inBattleBy ? 0.42 : 1);
      this.fieldMonsterSprites.set(monster.id, {
        container,
        sprite,
        label,
        texturePath: monster.texturePath,
        zoneId: monster.zoneId,
      });
      this.startMonsterWander(monster, this.fieldMonsterSprites.get(monster.id)!);
    });

    Array.from(this.fieldMonsterSprites.entries()).forEach(([monsterId, rendered]) => {
      if (!activeIds.has(monsterId)) {
        rendered.wanderTween?.stop();
        rendered.container.destroy();
        this.fieldMonsterSprites.delete(monsterId);
      }
    });
  }

  private startMonsterWander(monster: FieldMonsterState, rendered: FieldMonsterSprite): void {
    if (monster.isBoss || monster.inBattleBy || !monster.zoneId) {
      return;
    }

    const zone = this.sceneDefinition?.encounterZones.find((candidate) => candidate.id === monster.zoneId);
    if (!zone) {
      return;
    }

    const target = this.pickPointInZone(zone, 24);
    rendered.wanderTween = this.tweens.add({
      targets: rendered.container,
      x: target.x,
      y: target.y,
      duration: Phaser.Math.Between(2600, 5200),
      ease: "sine.inOut",
      onComplete: () => {
        rendered.wanderTween = undefined;
        const latestMonster = this.fieldMonsters.find((candidate) => candidate.id === monster.id);
        if (latestMonster) {
          this.startMonsterWander(latestMonster, rendered);
        }
      },
    });
  }

  private pickPointInZone(zone: EncounterZone, padding: number): { x: number; y: number } {
    const minX = zone.x + padding;
    const maxX = zone.x + zone.width - padding;
    const minY = zone.y + padding;
    const maxY = zone.y + zone.height - padding;
    return {
      x: Phaser.Math.Between(Math.round(Math.min(minX, maxX)), Math.round(Math.max(minX, maxX))),
      y: Phaser.Math.Between(Math.round(Math.min(minY, maxY)), Math.round(Math.max(minY, maxY))),
    };
  }

  private syncDeathGraveSprites(graves: DeathGraveState[]): void {
    const activeIds = new Set<string>();
    const texturePath = getDeathGraveTexturePath();
    graves.forEach((grave) => {
      activeIds.add(grave.id);
      const existing = this.deathGraveSprites.get(grave.id);
      if (existing) {
        existing.container.setPosition(grave.x, grave.y);
        existing.label.setText(grave.playerName);
        return;
      }

      const shadow = this.add.ellipse(0, 22, 48, 14, 0x050908, 0.42);
      const sprite = this.add
        .sprite(0, 0, texturePath)
        .setDisplaySize(54, 54);
      const label = this.createReadableLabel(0, -36, grave.playerName, {
        backgroundColor: "rgba(18, 22, 24, 0.92)",
        color: "#e5eef4",
        depth: 7,
        fontSize: "11px",
        originY: 1,
      });
      const container = this.add
        .container(grave.x, grave.y, [shadow, sprite, label])
        .setDepth(4);
      this.deathGraveSprites.set(grave.id, {
        container,
        label,
      });
    });

    Array.from(this.deathGraveSprites.entries()).forEach(([graveId, rendered]) => {
      if (!activeIds.has(graveId)) {
        rendered.container.destroy();
        this.deathGraveSprites.delete(graveId);
      }
    });
  }

  private syncGameplayCapture(gameplayInputBlocked: boolean): void {
    const keyboard = this.input.keyboard;
    if (!keyboard || gameplayInputBlocked === this.gameplayCaptureDisabled) {
      return;
    }

    if (gameplayInputBlocked) {
      keyboard.disableGlobalCapture();
      keyboard.resetKeys();
    } else {
      keyboard.enableGlobalCapture();
    }

    this.gameplayCaptureDisabled = gameplayInputBlocked;
  }

  private buildLocation(): void {
    if (!this.world || !this.playerState) {
      return;
    }

    const location = this.world.locations[this.playerState.locationKey];
    if (!location) {
      return;
    }

    this.sceneDefinition = location.scene;
    this.fieldMonsters = this.fieldMonsters.filter((monster) => monster.sceneId === location.scene.sceneId);
    this.deathGraves = this.deathGraves.filter((grave) => grave.sceneId === location.scene.sceneId);
    this.cameras.main.setBackgroundColor(location.scene.backgroundColor);

    this.children.removeAll(true);
    this.portals = [];
    this.encounterZones = [];
    this.collisionZones = [];
    this.npcMarkers = [];
    this.lastPromptKey = "";
    this.lastBroadcastKey = "";
    this.lastFieldMonsterContactId = "";
    this.remoteSprites.forEach((remote) => remote.container.destroy());
    this.remoteSprites.clear();
    this.fieldMonsterSprites.forEach((monster) => {
      monster.wanderTween?.stop();
      monster.container.destroy();
    });
    this.fieldMonsterSprites.clear();
    this.deathGraveSprites.forEach((grave) => grave.container.destroy());
    this.deathGraveSprites.clear();

    this.renderSceneMap(location.scene);

    const usesGeneratedSceneArt = Boolean(location.scene.assets.floorTexturePath);
    location.scene.collisionZones.forEach((zone) => {
      if (!usesGeneratedSceneArt) {
        const collisionHint = this.add.rectangle(
          zone.x + zone.width / 2,
          zone.y + zone.height / 2,
          zone.width,
          zone.height,
          Phaser.Display.Color.HexStringToColor("#182026").color,
          0.08,
        ).setDepth(1);
        collisionHint.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor("#0f1720").color, 0.16);
      }
      this.collisionZones.push(new Phaser.Geom.Rectangle(zone.x, zone.y, zone.width, zone.height));
    });

    location.scene.portals.forEach((portal) => {
      const isVerticalPortal = portal.height >= portal.width;
      const portalDisplayWidth = isVerticalPortal ? 72 : 88;
      const portalDisplayHeight = isVerticalPortal ? 112 : 80;
      const portalX = Phaser.Math.Clamp(
        portal.x + portal.width / 2,
        portalDisplayWidth / 2 + 4,
        location.scene.width - portalDisplayWidth / 2 - 4,
      );
      const portalY = Phaser.Math.Clamp(
        portal.y + portal.height / 2,
        portalDisplayHeight / 2 + 4,
        location.scene.height - portalDisplayHeight / 2 - 4,
      );
      const portalSprite = this.add
        .image(
          portalX,
          portalY,
          location.scene.assets.portalTexturePath,
        )
        .setDisplaySize(portalDisplayWidth, portalDisplayHeight)
        .setDepth(3);
      this.tweens.add({
        targets: portalSprite,
        y: portalSprite.y - 8,
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      const portalLabel = this.createReadableLabel(
        portalX,
        Math.min(portalY + portalDisplayHeight / 2 + 8, location.scene.height - 28),
        portal.label,
        {
          color: "#fefae0",
          depth: 4,
          fontFamily: "Space Mono, monospace",
          fontSize: "11px",
          originY: 0,
        },
      );
      portalLabel.setX(Phaser.Math.Clamp(
        portalLabel.x,
        portalLabel.displayWidth / 2 + 4,
        location.scene.width - portalLabel.displayWidth / 2 - 4,
      ));
      this.portals.push({
        zone: new Phaser.Geom.Rectangle(portal.x, portal.y, portal.width, portal.height),
        locationKey: portal.toLocationKey,
        label: portal.label,
      });
    });

    location.scene.encounterZones.forEach((encounterZone) => {
      const zoneCenterX = encounterZone.x + encounterZone.width / 2;
      const zoneCenterY = encounterZone.y + encounterZone.height / 2;
      const zoneDisplayWidth = Math.max(128, Math.min(encounterZone.width * 0.9, 280));
      const zoneDisplayHeight = Math.max(82, Math.min(encounterZone.height * 0.9, zoneDisplayWidth * 0.64));
      const encounterMarker = this.add
        .image(
          zoneCenterX,
          zoneCenterY,
          location.scene.assets.encounterTexturePath,
        )
        .setDisplaySize(zoneDisplayWidth, zoneDisplayHeight)
        .setAlpha(0.36)
        .setDepth(2);
      this.add
        .image(zoneCenterX, zoneCenterY, location.scene.assets.encounterTexturePath)
        .setDisplaySize(zoneDisplayWidth * 0.76, zoneDisplayHeight * 0.72)
        .setAlpha(0.14)
        .setDepth(3)
        .setBlendMode(Phaser.BlendModes.ADD);
      encounterMarker.setTint(0xc6f6d5);
      this.encounterZones.push({
        zone: new Phaser.Geom.Rectangle(encounterZone.x, encounterZone.y, encounterZone.width, encounterZone.height),
        data: encounterZone,
      });
    });

    location.scene.npcs.forEach((npc) => {
      const sprite = this.add
        .sprite(npc.x, npc.y, npc.texturePath)
        .setDisplaySize(32, 32)
        .setDepth(6);
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 6,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      this.createReadableLabel(npc.x, npc.y - 24, npc.name, {
        color: "#fff7d6",
        depth: 7,
        fontSize: "12px",
        originY: 1,
      });
      this.npcMarkers.push({ sprite, npc });
    });

    this.playerSprite = this.add
      .sprite(
        this.playerState.position.x,
        this.playerState.position.y,
        getPlayerAvatarTexturePath(this.callbacks?.getPlayerAvatarId() ?? ""),
      )
      .setDisplaySize(32, 32)
      .setDepth(8);
    this.syncFieldMonsterSprites(this.fieldMonsters);
    this.syncDeathGraveSprites(this.deathGraves);
    this.hintText = this.createReadableLabel(
      this.playerState.position.x,
      this.playerState.position.y - 34,
      "",
      {
        color: "#fff7d6",
        depth: 30,
        fontSize: "13px",
        originY: 1,
      },
    ).setVisible(false);
    this.overlayShade = this.add
      .rectangle(location.scene.width / 2, location.scene.height / 2, location.scene.width, location.scene.height, 0x070b09, 0)
      .setDepth(18);
    this.overlayText = this.add
      .text(20, 56, "", {
        color: "#f4efe3",
        fontFamily: "Space Mono, monospace",
        fontSize: "12px",
        letterSpacing: 2,
      })
      .setScrollFactor(0)
      .setDepth(21)
      .setPadding(8, 4, 8, 4)
      .setBackgroundColor("rgba(7, 15, 13, 0.86)");

    this.cameras.main.setBounds(0, 0, location.scene.width, location.scene.height);
    this.cameras.main.startFollow(this.playerSprite, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(220, 160);
    this.cameras.main.roundPixels = true;
  }

  private findActivePortal(x: number, y: number): { zone: Phaser.Geom.Rectangle; locationKey: string; label: string } | null {
    return this.portals.find((portal) => Phaser.Geom.Rectangle.Contains(portal.zone, x, y)) ?? null;
  }

  private findActiveNpc(x: number, y: number): { sprite: Phaser.GameObjects.Sprite; npc: DialogueNpc } | null {
    return this.npcMarkers.find(({ sprite }) => Phaser.Math.Distance.Between(sprite.x, sprite.y, x, y) < 64) ?? null;
  }

  private findActiveGrave(x: number, y: number): DeathGraveState | null {
    return this.deathGraves.find((grave) => (
      Phaser.Math.Distance.Between(grave.x, grave.y, x, y) <= GRAVE_INTERACTION_DISTANCE
    )) ?? null;
  }

  private findActiveFieldMonster(x: number, y: number): FieldMonsterState | null {
    return this.fieldMonsters.find((monster) => {
      if (monster.inBattleBy) {
        return false;
      }
      const contactDistance = monster.isBoss ? BOSS_CONTACT_DISTANCE : MONSTER_CONTACT_DISTANCE;
      const rendered = this.fieldMonsterSprites.get(monster.id);
      const monsterX = rendered?.container.x ?? monster.x;
      const monsterY = rendered?.container.y ?? monster.y;
      return Phaser.Math.Distance.Between(monsterX, monsterY, x, y) <= contactDistance;
    }) ?? null;
  }

  private resolvePrompt(params: {
    overlayMode: OverlayMode;
    hasPendingLocationStory: boolean;
    portal: { label: string } | null;
    npc: DialogueNpc | null;
    grave: DeathGraveState | null;
  }): FieldPrompt {
    if (params.overlayMode === "battle") {
      return {
        kind: "battle",
        title: "전투 진행 중",
        body: "오른쪽 전투 패널에서 행동을 선택하거나 1, 2, 3 키로 기본 행동을 실행하세요.",
        actionLabel: "전투 패널 / 숫자키 1-3",
        tone: "danger",
      };
    }

    if (params.overlayMode === "dialogue") {
      return {
        kind: "dialogue",
        title: "대화 진행 중",
        body: "Space 또는 Enter 로 다음 대사를 넘기고, 마지막 줄에서 대화를 닫을 수 있습니다.",
        actionLabel: "Space / Enter",
        tone: "accent",
      };
    }

    if (params.portal) {
      return {
        kind: "portal",
        title: `${params.portal.label} 이동 준비`,
        body: "출구 위에서 Enter 를 누르면 다음 씬으로 전환됩니다.",
        actionLabel: "Enter",
        tone: "accent",
      };
    }

    if (params.npc) {
      return {
        kind: "npc",
        title: `${params.npc.name}와 대화`,
        body: "NPC 근처에서 Space 를 누르면 대화 패널이 열립니다.",
        actionLabel: "Space",
        tone: "accent",
      };
    }

    if (params.grave) {
      return {
        kind: "grave",
        title: "묘지",
        body: "묘지 근처에서 Space를 누르면 남겨진 기록을 확인할 수 있습니다.",
        actionLabel: "Space",
        tone: "accent",
      };
    }

    if (params.hasPendingLocationStory) {
      return {
        kind: "story",
        title: "지역 이야기 확인 가능",
        body: "이 지역의 도입 대사를 아직 읽지 않았습니다. Space 또는 Enter 로 바로 열 수 있습니다.",
        actionLabel: "Space / Enter",
        tone: "accent",
      };
    }

    return {
      kind: "idle",
      title: this.sceneDefinition?.sceneId ?? "오버월드 탐험",
      body: "WASD 이동, Enter 씬 전환, Space 대화로 현재 지역을 탐험하세요.",
      actionLabel: "WASD / Space / Enter",
      tone: "neutral",
    };
  }

  private syncFieldPrompt(prompt: FieldPrompt): void {
    const promptKey = `${prompt.kind}:${prompt.title}:${prompt.body}:${prompt.actionLabel}:${prompt.tone}`;
    if (promptKey === this.lastPromptKey) {
      return;
    }
    this.lastPromptKey = promptKey;
    this.callbacks?.onFieldPromptChange(prompt);
  }

  private syncWorldHint(prompt: FieldPrompt): void {
    const hint = this.getWorldHintText(prompt);
    if (!hint) {
      this.hintText.setVisible(false);
      return;
    }

    if (this.hintText.text !== hint) {
      this.hintText.setText(hint);
    }
    this.hintText
      .setBackgroundColor(prompt.tone === "danger" ? "rgba(52, 16, 20, 0.9)" : "rgba(7, 32, 25, 0.9)")
      .setVisible(true);

    const cameraView = this.cameras.main.worldView;
    const halfWidth = this.hintText.displayWidth / 2;
    const x = Phaser.Math.Clamp(
      this.playerSprite.x,
      cameraView.left + halfWidth + 8,
      cameraView.right - halfWidth - 8,
    );
    const y = Phaser.Math.Clamp(
      this.playerSprite.y - 32,
      cameraView.top + this.hintText.displayHeight + 8,
      cameraView.bottom - 8,
    );
    this.hintText.setPosition(x, y);
  }

  private getWorldHintText(prompt: FieldPrompt): string | null {
    switch (prompt.kind) {
      case "portal":
        return `${prompt.title.replace(/ 준비$/, "")}하려면 ${prompt.actionLabel} 누르기`;
      case "npc":
        return `${prompt.title}하려면 ${prompt.actionLabel} 누르기`;
      case "grave":
        return `묘지를 살펴보려면 ${prompt.actionLabel} 누르기`;
      case "story":
        return `이야기 보려면 ${prompt.actionLabel} 누르기`;
      default:
        return null;
    }
  }

  private syncOverlayState(mode: OverlayMode): void {
    if (mode === "battle") {
      this.overlayShade.setAlpha(0.22).setFillStyle(0x2d1010, 0.22);
      this.overlayText.setText("BATTLE LOCK").setAlpha(1);
      return;
    }

    if (mode === "dialogue") {
      this.overlayShade.setAlpha(0.16).setFillStyle(0x10261d, 0.16);
      this.overlayText.setText("DIALOGUE LOCK").setAlpha(1);
      return;
    }

    this.overlayShade.setAlpha(0);
    this.overlayText.setText("").setAlpha(0);
  }

  private createReadableLabel(
    x: number,
    y: number,
    text: string,
    options: {
      align?: "left" | "center" | "right";
      backgroundColor?: string;
      color?: string;
      depth?: number;
      fontFamily?: string;
      fontSize?: string;
      originX?: number;
      originY?: number;
    } = {},
  ): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, {
      align: options.align ?? "center",
      color: options.color ?? "#f8fafc",
      fontFamily: options.fontFamily ?? "IBM Plex Sans KR, Pretendard, sans-serif",
      fontSize: options.fontSize ?? "12px",
      stroke: "#06100d",
      strokeThickness: 3,
    });
    return label
      .setOrigin(options.originX ?? 0.5, options.originY ?? 0.5)
      .setDepth(options.depth ?? 10)
      .setPadding(6, 3, 6, 3)
      .setBackgroundColor(options.backgroundColor ?? "rgba(7, 15, 13, 0.88)");
  }

  private renderSceneMap(scene: SceneDefinition): void {
    this.add
      .tileSprite(
        scene.width / 2,
        scene.height / 2,
        scene.width,
        scene.height,
        scene.assets.floorTexturePath ?? scene.assets.terrainTexturePath,
      )
      .setDepth(0);

    const mapData = this.cache.json.get(scene.assets.mapJsonPath) as TiledMapData | undefined;
    if (!mapData) {
      return;
    }

    const usesGeneratedFloor = Boolean(scene.assets.floorTexturePath);
    mapData.layers
      .filter((layer) => layer.type === "objectgroup")
      .forEach((layer) => {
        if (layer.name === "paths") {
          if (usesGeneratedFloor) {
            return;
          }

          layer.objects.forEach((object) => {
            this.add.rectangle(
              object.x + object.width / 2,
              object.y + object.height / 2,
              object.width,
              object.height,
              this.colorForPath(object.class),
              0.24,
            ).setDepth(1);
          });
          return;
        }

        if (layer.name === "props") {
          layer.objects.forEach((object) => {
            const propTexturePath = this.resolvePropTexturePath(scene, object);
            const usesGeneratedProp = propTexturePath !== scene.assets.propsTexturePath;
            const prop = this.add
              .image(
                object.x + object.width / 2,
                object.y + object.height / 2,
                propTexturePath,
              )
              .setDisplaySize(Math.max(object.width, 18), Math.max(object.height, 18))
              .setAlpha(this.readAlpha(object.properties))
              .setDepth(2);
            if (!usesGeneratedProp) {
              prop.setTint(this.colorForProp(object.class));
            }

            const label = this.readLabel(object.properties);
            if (label && !usesGeneratedProp) {
              this.createReadableLabel(prop.x, prop.y + object.height / 2 + 6, label, {
                depth: 3,
                fontFamily: "Space Mono, monospace",
                fontSize: "10px",
                originY: 0,
              });
            }
          });
        }
      });
  }

  private resolvePropTexturePath(scene: SceneDefinition, object: TiledObject): string {
    return scene.assets.propTexturePaths?.[object.name]
      ?? (object.class ? scene.assets.propTexturePaths?.[object.class] : undefined)
      ?? scene.assets.propsTexturePath;
  }

  private getObstacleSpeedMultiplier(currentX: number, currentY: number, intendedX: number, intendedY: number): number {
    const size = 20;
    const currentHitbox = new Phaser.Geom.Rectangle(currentX - size / 2, currentY - size / 2, size, size);
    const intendedHitbox = new Phaser.Geom.Rectangle(intendedX - size / 2, intendedY - size / 2, size, size);
    return this.collisionZones.some((zone) => (
      Phaser.Geom.Intersects.RectangleToRectangle(currentHitbox, zone)
      || Phaser.Geom.Intersects.RectangleToRectangle(intendedHitbox, zone)
    ))
      ? OBSTACLE_SPEED_MULTIPLIER
      : 1;
  }

  private colorForPath(kind?: string): number {
    switch (kind) {
      case "water":
        return Phaser.Display.Color.HexStringToColor("#5fa8d3").color;
      case "road":
        return Phaser.Display.Color.HexStringToColor("#d4a373").color;
      case "ritual":
        return Phaser.Display.Color.HexStringToColor("#9a5de0").color;
      default:
        return Phaser.Display.Color.HexStringToColor("#f2cc8f").color;
    }
  }

  private colorForProp(kind?: string): number {
    switch (kind) {
      case "tree":
        return Phaser.Display.Color.HexStringToColor("#386641").color;
      case "rock":
        return Phaser.Display.Color.HexStringToColor("#6b7280").color;
      case "stall":
        return Phaser.Display.Color.HexStringToColor("#b56576").color;
      case "bed":
        return Phaser.Display.Color.HexStringToColor("#84a59d").color;
      case "altar":
        return Phaser.Display.Color.HexStringToColor("#7b2cbf").color;
      case "building":
        return Phaser.Display.Color.HexStringToColor("#8d6e63").color;
      default:
        return Phaser.Display.Color.HexStringToColor("#f4d35e").color;
    }
  }

  private readAlpha(properties?: TiledProperty[]): number {
    const value = properties?.find((property) => property.name === "alpha")?.value;
    return typeof value === "number" ? value : 0.84;
  }

  private readLabel(properties?: TiledProperty[]): string | null {
    const value = properties?.find((property) => property.name === "label")?.value;
    return typeof value === "string" && value.trim() ? value : null;
  }
}
