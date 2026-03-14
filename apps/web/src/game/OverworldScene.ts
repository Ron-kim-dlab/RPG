import Phaser from "phaser";
import type { DialogueNpc, EncounterZone, Facing, PlayerSave, PresenceState, SceneDefinition, WorldContent } from "@rpg/game-core";

type SceneCallbacks = {
  canMove: () => boolean;
  onPositionChange: (x: number, y: number, facing: Facing) => void;
  onSceneChange: (locationKey: string) => void;
  onInteractNpc: (npc: DialogueNpc) => void;
  onEncounter: (zone: EncounterZone) => void;
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
  private lastPresenceSentAt = 0;

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

    this.playerSprite = this.add.sprite(512, 384, "player-local").setDisplaySize(26, 26);
    this.hintText = this.add
      .text(20, 20, "", {
        color: "#f3efe0",
        fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
        fontSize: "18px",
      })
      .setScrollFactor(0)
      .setDepth(10);

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

        const sprite = this.add.sprite(0, 0, "player-remote").setDisplaySize(22, 22);
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
    if (!this.playerState || !this.callbacks || !this.sceneDefinition) {
      return;
    }

    const canMove = this.callbacks.canMove();
    const speed = canMove ? 160 : 0;
    let velocityX = 0;
    let velocityY = 0;
    let facing: Facing = this.playerState.facing;

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

    const distance = speed * (delta / 1000);
    const nextX = Phaser.Math.Clamp(this.playerSprite.x + velocityX * distance, 36, this.sceneDefinition.width - 36);
    const nextY = Phaser.Math.Clamp(this.playerSprite.y + velocityY * distance, 36, this.sceneDefinition.height - 36);
    this.playerSprite.setPosition(nextX, nextY);
    this.playerState = {
      ...this.playerState,
      position: { x: nextX, y: nextY },
      facing,
    };

    if (time - this.lastPresenceSentAt > 120) {
      this.callbacks.onPositionChange(nextX, nextY, facing);
      this.lastPresenceSentAt = time;
    }

    let hint = `${this.sceneDefinition.sceneId}  |  이동: WASD / 화살표  |  상호작용: Space  |  전투: B  |  출구: Enter`;

    this.portals.forEach((portal) => {
      if (Phaser.Geom.Rectangle.Contains(portal.zone, nextX, nextY) && Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        this.callbacks?.onSceneChange(portal.locationKey);
      }
    });

    this.npcMarkers.forEach(({ sprite, npc }) => {
      if (Phaser.Math.Distance.Between(sprite.x, sprite.y, nextX, nextY) < 64) {
        hint = `${npc.name}와 대화하려면 Space`;
        if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
          this.callbacks?.onInteractNpc(npc);
        }
      }
    });

    this.encounterZones.forEach(({ zone, data }) => {
      if (Phaser.Geom.Rectangle.Contains(zone, nextX, nextY)) {
        hint = "전투 지역입니다. B 를 눌러 적과 교전할 수 있습니다.";
        if (Phaser.Input.Keyboard.JustDown(this.keyBattle)) {
          this.callbacks?.onEncounter(data);
        }
      }
    });

    this.hintText.setText(hint);
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
    this.npcMarkers = [];
    this.remoteSprites.forEach((sprite) => sprite.destroy());
    this.remoteSprites.clear();

    const floor = this.add.rectangle(
      location.scene.width / 2,
      location.scene.height / 2,
      location.scene.width - 48,
      location.scene.height - 48,
      Phaser.Display.Color.HexStringToColor("#f4e7d3").color,
    );
    floor.setStrokeStyle(6, Phaser.Display.Color.HexStringToColor("#22333b").color);

    location.scene.portals.forEach((portal) => {
      this.add.rectangle(
        portal.x + portal.width / 2,
        portal.y + portal.height / 2,
        portal.width,
        portal.height,
        Phaser.Display.Color.HexStringToColor("#264653").color,
      );
      this.add.text(portal.x + portal.width / 2, portal.y + portal.height / 2, portal.label, {
        color: "#fefae0",
        fontFamily: "Space Mono, monospace",
        fontSize: "11px",
        align: "center",
      }).setOrigin(0.5);
      this.portals.push({
        zone: new Phaser.Geom.Rectangle(portal.x, portal.y, portal.width, portal.height),
        locationKey: portal.toLocationKey,
        label: portal.label,
      });
    });

    location.scene.encounterZones.forEach((encounterZone) => {
      this.add.rectangle(
        encounterZone.x + encounterZone.width / 2,
        encounterZone.y + encounterZone.height / 2,
        encounterZone.width,
        encounterZone.height,
        Phaser.Display.Color.HexStringToColor("#e76f51").color,
        0.18,
      );
      this.encounterZones.push({
        zone: new Phaser.Geom.Rectangle(encounterZone.x, encounterZone.y, encounterZone.width, encounterZone.height),
        data: encounterZone,
      });
    });

    location.scene.npcs.forEach((npc) => {
      const sprite = this.add.sprite(npc.x, npc.y, "npc-guide").setDisplaySize(24, 24);
      this.add.text(npc.x, npc.y - 22, npc.name, {
        color: "#111827",
        fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
        fontSize: "12px",
      }).setOrigin(0.5, 1);
      this.npcMarkers.push({ sprite, npc });
    });

    this.playerSprite = this.add.sprite(this.playerState.position.x, this.playerState.position.y, "player-local").setDisplaySize(26, 26).setDepth(6);
    this.hintText = this.add
      .text(20, 20, "", {
        color: "#f3efe0",
        fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
        fontSize: "18px",
      })
      .setScrollFactor(0)
      .setDepth(10);

    this.cameras.main.setBounds(0, 0, location.scene.width, location.scene.height);
  }
}
