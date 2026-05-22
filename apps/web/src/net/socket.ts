import { io, type Socket } from "socket.io-client";
import type {
  ChatMessage,
  DeathGraveState,
  Facing,
  FieldMonsterClaimResult,
  FieldMonsterState,
  PresenceState,
} from "@rpg/game-core";

type PresenceIntent = {
  sceneId: string;
  x: number;
  y: number;
  facing: Facing;
  avatarId: string;
};

type RealtimeHandlers = {
  onSnapshot: (snapshot: PresenceState[]) => void;
  onPresenceJoined: (presence: PresenceState) => void;
  onPresenceUpdate: (presence: PresenceState) => void;
  onPresenceLeft: (username: string) => void;
  onChatMessage: (message: ChatMessage) => void;
  onFieldMonstersSnapshot: (snapshot: FieldMonsterState[]) => void;
  onFieldMonstersUpdate: (snapshot: FieldMonsterState[]) => void;
  onDeathGravesSnapshot: (snapshot: DeathGraveState[]) => void;
  onDeathGravesUpdate: (snapshot: DeathGraveState[]) => void;
  onConnect: () => void;
  onDisconnect: (reason: string) => void;
  onConnectError: (message: string) => void;
};

export class PresenceClient {
  private socket: Socket | null = null;
  private desiredPresence: PresenceIntent | null = null;
  private isConnected = false;

  constructor(
    private readonly baseUrl: string,
    private readonly handlers: RealtimeHandlers,
    private readonly socketFactory: (baseUrl: string, token: string) => Socket = (baseUrl, token) =>
      io(baseUrl, {
        auth: { token },
      }),
  ) {}

  connect(token: string): void {
    this.socket?.disconnect();
    this.desiredPresence = null;
    this.socket = this.socketFactory(this.baseUrl, token);
    this.isConnected = false;

    this.socket.on("connect", () => {
      this.isConnected = true;
      this.rejoinCurrentScene();
      this.handlers.onConnect();
    });
    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      this.handlers.onDisconnect(reason);
    });
    this.socket.on("connect_error", (error) => {
      this.isConnected = false;
      this.handlers.onConnectError(error.message);
    });
    this.socket.on("presence:snapshot", this.handlers.onSnapshot);
    this.socket.on("presence:joined", this.handlers.onPresenceJoined);
    this.socket.on("presence:update", this.handlers.onPresenceUpdate);
    this.socket.on("presence:left", this.handlers.onPresenceLeft);
    this.socket.on("chat:message", this.handlers.onChatMessage);
    this.socket.on("field-monsters:snapshot", this.handlers.onFieldMonstersSnapshot);
    this.socket.on("field-monsters:update", this.handlers.onFieldMonstersUpdate);
    this.socket.on("death-graves:snapshot", this.handlers.onDeathGravesSnapshot);
    this.socket.on("death-graves:update", this.handlers.onDeathGravesUpdate);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.desiredPresence = null;
    this.isConnected = false;
  }

  joinScene(sceneId: string, x: number, y: number, facing: Facing, avatarId: string): void {
    this.desiredPresence = { sceneId, x, y, facing, avatarId };
    if (this.isConnected) {
      this.socket?.emit("presence:join", this.desiredPresence);
    }
  }

  changeScene(sceneId: string, x: number, y: number, facing: Facing, avatarId: string): void {
    this.desiredPresence = { sceneId, x, y, facing, avatarId };
    if (this.isConnected) {
      this.socket?.emit("scene:change", this.desiredPresence);
    }
  }

  updatePosition(x: number, y: number, facing: Facing): void {
    if (this.desiredPresence) {
      this.desiredPresence = {
        ...this.desiredPresence,
        x,
        y,
        facing,
      };
    }
    if (this.isConnected) {
      this.socket?.emit("presence:update", { x, y, facing });
    }
  }

  sendChat(text: string): void {
    if (this.isConnected) {
      this.socket?.emit("chat:send", { text });
    }
  }

  claimFieldMonster(monsterId: string): Promise<FieldMonsterClaimResult> {
    if (!this.isConnected || !this.socket) {
      return Promise.resolve({ ok: false, reason: "offline" });
    }

    return new Promise((resolve) => {
      let settled = false;
      const timer = globalThis.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({ ok: false, reason: "offline" });
      }, 1500);

      this.socket?.emit("field-monsters:claim", { monsterId }, (result: FieldMonsterClaimResult) => {
        if (settled) {
          return;
        }
        globalThis.clearTimeout(timer);
        settled = true;
        resolve(result);
      });
    });
  }

  releaseFieldMonster(monsterId: string): void {
    if (this.isConnected) {
      this.socket?.emit("field-monsters:release", { monsterId });
    }
  }

  createDeathGrave(sceneId: string, x: number, y: number, defeatedBy: string): void {
    if (this.isConnected) {
      this.socket?.emit("death-graves:create", { sceneId, x, y, defeatedBy });
    }
  }

  private rejoinCurrentScene(): void {
    if (this.desiredPresence) {
      this.socket?.emit("presence:join", this.desiredPresence);
    }
  }
}
