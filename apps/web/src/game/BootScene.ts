import Phaser from "phaser";
import { getSceneAssetManifest } from "@rpg/game-core";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    const manifest = getSceneAssetManifest();
    manifest.jsonPaths.forEach((path) => {
      this.load.json(path, path);
    });

    manifest.texturePaths.forEach((path) => {
      this.load.svg(path, path);
    });
  }

  create(): void {
    this.scene.start("overworld");
  }
}
