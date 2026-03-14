import Phaser from "phaser";

export class LoginScene extends Phaser.Scene {
  constructor() {
    super("login");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#1a2c24");

    const frame = this.add.rectangle(
      512,
      384,
      820,
      500,
      Phaser.Display.Color.HexStringToColor("#203a2c").color,
      0.94,
    );
    frame.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor("#f2cc8f").color, 0.35);

    this.add.text(512, 236, "Adventurer Gate", {
      color: "#f7f2e7",
      fontFamily: "Space Mono, monospace",
      fontSize: "18px",
      letterSpacing: 6,
    }).setOrigin(0.5);

    this.add.text(512, 314, "탐험을 시작하려면 접속 카드를 작성하세요", {
      color: "#f5eee1",
      fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
      fontSize: "34px",
      fontStyle: "700",
      align: "center",
    }).setOrigin(0.5);

    this.add.text(512, 380, "로그인 후에는 맵 이동, 상호작용, 씬 전환이 즉시 오버월드에서 이어집니다.", {
      color: "#d5cab8",
      fontFamily: "IBM Plex Sans KR, Pretendard, sans-serif",
      fontSize: "17px",
      align: "center",
      wordWrap: { width: 560 },
    }).setOrigin(0.5);

    const sigil = this.add.star(512, 470, 6, 24, 56, Phaser.Display.Color.HexStringToColor("#2a9d8f").color, 0.18);
    this.tweens.add({
      targets: sigil,
      angle: 360,
      duration: 16000,
      repeat: -1,
      ease: "linear",
    });
  }
}
