import Phaser from "phaser";
import type {
  DialogueNpc,
  EncounterZone,
  Facing,
  PlayerSave,
  PresenceState,
  SceneDefinition,
  WorldContent,
} from "@rpg/game-core";
import type { FieldPrompt, OverlayMode } from "../gameplay";

type SceneCallbacks = {
  canMove: () => boolean;
  isGameplayInputBlocked: () => boolean;
  getOverlayMode: () => OverlayMode;
  hasPendingLocationStory: () => boolean;
  onPositionChange: (x: number, y: number, facing: Facing) => void;
  onSceneChange: (locationKey: string) => void;
  onOpenLocationStory: () => void;
  onInteractNpc: (npc: DialogueNpc) => void;
  onEncounter: (zone: EncounterZone) => void;
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

export class OverworldScene extends Phaser.Scene {
  private world: WorldContent | null = null;
  private playerState: PlayerSave | null = null;
  private sceneDefinition: SceneDefinition | null = null;
  private callbacks: SceneCallbacks | null = null;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private remoteSprites = new Map<string, Phaser.GameObjects.Container>();
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
  private keyBattle!: Phaser.Input.Keyboard.Key;
  private hintText!: Phaser.GameObjects.Text;
  private overlayShade!: Phaser.GameObjects.Rectangle;
  private overlayText!: Phaser.GameObjects.Text;
  private lastPresenceSentAt = 0;
  private lastBroadcastKey = "";
  private lastPromptKey = "";
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
    this.keyBattle = this.input.keyboard!.addKey("B");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.enableGlobalCapture();
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

  sync(player: PlayerSave, nearbyPlayers: PresenceState[]): void {
    this.playerState = player;
    const location = this.world?.locations[player.locationKey];
    if (location && location.scene.sceneId !== this.sceneDefinition?.sceneId) {
      this.buildLocation();
    }

    if (this.playerSprite) {
      this.playerSprite.setPosition(player.position.x, player.position.y);
    }

    const activeUsers = new Set<string>();
    nearbyPlayers
      .filter((presence) => presence.username !== player.username && presence.sceneId === this.sceneDefinition?.sceneId)
      .forEach((presence) => {
        activeUsers.add(presence.username);
        const existing = this.remoteSprites.get(presence.username);
        if (existing) {
          existing.setPosition(presence.x, presence.y);
          return;
        }

        const remoteTexturePath = this.sceneDefinition?.assets.remotePlayerTexturePath;
        if (!remoteTexturePath) {
          return;
        }

        const sprite = this.add
          .sprite(0, 0, remoteTexturePath)
          .setDisplaySize(22, 22);
        const label = this.add.text(0, -18, presence.username, {
          color: "#fefae0",
          fontFamily: "Space Mono, monospace",
          fontSize: "12px",
        }).setOrigin(0.5, 1);
        const container = this.add.container(presence.x, presence.y, [sprite, label]).setDepth(5);
        this.remoteSprites.set(presence.username, container);
      });

    Array.from(this.remoteSprites.entries()).forEach(([username, sprite]) => {
      if (!activeUsers.has(username)) {
        sprite.destroy();
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

    const distance = speed * (delta / 1000);
    const desiredX = Phaser.Math.Clamp(this.playerSprite.x + velocityX * distance, 36, this.sceneDefinition.width - 36);
    const desiredY = Phaser.Math.Clamp(this.playerSprite.y + velocityY * distance, 36, this.sceneDefinition.height - 36);
    const nextX = this.isBlocked(desiredX, this.playerSprite.y) ? this.playerSprite.x : desiredX;
    const nextY = this.isBlocked(nextX, desiredY) ? this.playerSprite.y : desiredY;

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
    const activeEncounter = this.findActiveEncounter(nextX, nextY);
    const hasPendingLocationStory = this.callbacks.hasPendingLocationStory();
    const prompt = this.resolvePrompt({
      overlayMode,
      hasPendingLocationStory,
      portal: activePortal,
      npc: activeNpc?.npc ?? null,
      encounter: activeEncounter?.data ?? null,
    });
    this.syncFieldPrompt(prompt);
    this.syncOverlayState(overlayMode);
    this.hintText.setText(`${prompt.title}  |  ${prompt.actionLabel}`);

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

    if (activeEncounter && Phaser.Input.Keyboard.JustDown(this.keyBattle)) {
      this.callbacks.onEncounter(activeEncounter.data);
    }
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
    this.cameras.main.setBackgroundColor(location.scene.backgroundColor);

    this.children.removeAll(true);
    this.portals = [];
    this.encounterZones = [];
    this.collisionZones = [];
    this.npcMarkers = [];
    this.lastPromptKey = "";
    this.lastBroadcastKey = "";
    this.remoteSprites.forEach((sprite) => sprite.destroy());
    this.remoteSprites.clear();

    this.renderSceneMap(location.scene);

    location.scene.collisionZones.forEach((zone) => {
      const collisionHint = this.add.rectangle(
        zone.x + zone.width / 2,
        zone.y + zone.height / 2,
        zone.width,
        zone.height,
        Phaser.Display.Color.HexStringToColor("#182026").color,
        0.12,
      ).setDepth(1);
      collisionHint.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor("#0f1720").color, 0.2);
      this.collisionZones.push(new Phaser.Geom.Rectangle(zone.x, zone.y, zone.width, zone.height));
    });

    location.scene.portals.forEach((portal) => {
      const portalSprite = this.add
        .image(
          portal.x + portal.width / 2,
          portal.y + portal.height / 2,
          location.scene.assets.portalTexturePath,
        )
        .setDisplaySize(Math.max(portal.width, 28), Math.max(portal.height, 28))
        .setDepth(3);
      this.tweens.add({
        targets: portalSprite,
        y: portalSprite.y - 8,
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      this.add.text(portal.x + portal.width / 2, portal.y + portal.height / 2, portal.label, {
        color: "#fefae0",
        fontFamily: "Space Mono, monospace",
        fontSize: "11px",
        align: "center",
      }).setOrigin(0.5).setDepth(4);
      this.portals.push({
        zone: new Phaser.Geom.Rectangle(portal.x, portal.y, portal.width, portal.height),
        locationKey: portal.toLocationKey,
        label: portal.label,
      });
    });

    location.scene.encounterZones.forEach((encounterZone) => {
      const encounterMarker = this.add
        .image(
          encounterZone.x + encounterZone.width / 2,
          encounterZone.y + encounterZone.height / 2,
          location.scene.assets.encounterTexturePath,
        )
        .setDisplaySize(encounterZone.width, encounterZone.height)
        .setAlpha(0.22)
        .setDepth(2);
      this.tweens.add({
        targets: encounterMarker,
        alpha: 0.34,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      this.encounterZones.push({
        zone: new Phaser.Geom.Rectangle(encounterZone.x, encounterZone.y, encounterZone.width, encounterZone.height),
        data: encounterZone,
      });
    });

    location.scene.npcs.forEach((npc) => {
      const sprite = this.add
        .sprite(npc.x, npc.y, location.scene.assets.npcTexturePath)
        .setDisplaySize(24, 24)
        .setDepth(6);
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 6,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      this.add.text(npc.x, npc.y - 22, npc.name, {
        color: "#111827",
        fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
        fontSize: "12px",
      }).setOrigin(0.5, 1).setDepth(7);
      this.npcMarkers.push({ sprite, npc });
    });

    this.playerSprite = this.add
      .sprite(this.playerState.position.x, this.playerState.position.y, location.scene.assets.playerTexturePath)
      .setDisplaySize(26, 26)
      .setDepth(8);
    this.hintText = this.add
      .text(20, 20, "", {
        color: "#f3efe0",
        fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
        fontSize: "18px",
      })
      .setScrollFactor(0)
      .setDepth(20);
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
      .setDepth(21);

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

  private findActiveEncounter(x: number, y: number): { zone: Phaser.Geom.Rectangle; data: EncounterZone } | null {
    return this.encounterZones.find(({ zone }) => Phaser.Geom.Rectangle.Contains(zone, x, y)) ?? null;
  }

  private resolvePrompt(params: {
    overlayMode: OverlayMode;
    hasPendingLocationStory: boolean;
    portal: { label: string } | null;
    npc: DialogueNpc | null;
    encounter: EncounterZone | null;
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

    if (params.hasPendingLocationStory) {
      return {
        kind: "story",
        title: "지역 이야기 확인 가능",
        body: "이 지역의 도입 대사를 아직 읽지 않았습니다. Space 또는 Enter 로 바로 열 수 있습니다.",
        actionLabel: "Space / Enter",
        tone: "accent",
      };
    }

    if (params.encounter) {
      return {
        kind: "encounter",
        title: "적 조우 가능 구역",
        body: "B 키를 눌러 현재 지역 적과 교전할 수 있습니다.",
        actionLabel: "B",
        tone: "danger",
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

    return {
      kind: "idle",
      title: this.sceneDefinition?.sceneId ?? "오버월드 탐험",
      body: "WASD 이동, Enter 씬 전환, Space 대화, B 전투로 현재 지역을 탐험하세요.",
      actionLabel: "WASD / Space / Enter / B",
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

  private renderSceneMap(scene: SceneDefinition): void {
    this.add
      .tileSprite(scene.width / 2, scene.height / 2, scene.width, scene.height, scene.assets.terrainTexturePath)
      .setDepth(0);

    const mapData = this.cache.json.get(scene.assets.mapJsonPath) as TiledMapData | undefined;
    if (!mapData) {
      return;
    }

    mapData.layers
      .filter((layer) => layer.type === "objectgroup")
      .forEach((layer) => {
        if (layer.name === "paths") {
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
            const prop = this.add
              .image(
                object.x + object.width / 2,
                object.y + object.height / 2,
                scene.assets.propsTexturePath,
              )
              .setDisplaySize(Math.max(object.width, 18), Math.max(object.height, 18))
              .setTint(this.colorForProp(object.class))
              .setAlpha(this.readAlpha(object.properties))
              .setDepth(2);

            const label = this.readLabel(object.properties);
            if (label) {
              this.add.text(prop.x, prop.y + object.height / 2 + 6, label, {
                color: "#f8fafc",
                fontFamily: "Space Mono, monospace",
                fontSize: "10px",
              }).setOrigin(0.5, 0).setDepth(3);
            }
          });
        }
      });
  }

  private isBlocked(x: number, y: number): boolean {
    const size = 20;
    const hitbox = new Phaser.Geom.Rectangle(x - size / 2, y - size / 2, size, size);
    return this.collisionZones.some((zone) => Phaser.Geom.Intersects.RectangleToRectangle(hitbox, zone));
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
