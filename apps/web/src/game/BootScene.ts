import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0xf3efe0, 1);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("tile-floor", 16, 16);

    graphics.clear();
    graphics.fillStyle(0xe76f51, 1);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("player-local", 16, 16);

    graphics.clear();
    graphics.fillStyle(0x2a9d8f, 1);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("player-remote", 16, 16);

    graphics.clear();
    graphics.fillStyle(0xe9c46a, 1);
    graphics.fillRect(0, 0, 20, 20);
    graphics.generateTexture("npc-guide", 20, 20);

    graphics.clear();
    graphics.fillStyle(0x264653, 1);
    graphics.fillRect(0, 0, 28, 28);
    graphics.generateTexture("portal", 28, 28);

    graphics.destroy();
    this.scene.start("overworld");
  }
}
