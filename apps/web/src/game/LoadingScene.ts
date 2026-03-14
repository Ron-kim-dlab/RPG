import Phaser from "phaser";

export class LoadingScene extends Phaser.Scene {
  constructor() {
    super("loading");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#10231b");

    this.add.rectangle(512, 384, 760, 460, Phaser.Display.Color.HexStringToColor("#18392b").color, 0.92)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor("#d4a373").color, 0.4);

    this.add.text(512, 270, "RPG Rebuild", {
      color: "#f4efe3",
      fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
      fontSize: "40px",
      fontStyle: "700",
    }).setOrigin(0.5);

    this.add.text(512, 330, "월드 데이터와 플레이스홀더 맵을 불러오는 중", {
      color: "#d6c6ac",
      fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
      fontSize: "18px",
    }).setOrigin(0.5);

    const pulse = this.add.circle(512, 418, 18, Phaser.Display.Color.HexStringToColor("#e9c46a").color, 0.85);
    this.tweens.add({
      targets: pulse,
      scale: 1.45,
      alpha: 0.28,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
  }
}
