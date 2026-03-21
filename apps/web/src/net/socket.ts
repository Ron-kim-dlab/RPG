import { io, type Socket } from "socket.io-client";
import type { ChatMessage, Facing, PresenceState } from "@rpg/game-core";

type PresenceIntent = {
  sceneId: string;
  x: number;
  y: number;
  facing: Facing;
};

type RealtimeHandlers = {
  onSnapshot: (snapshot: PresenceState[]) => void;
  onPresenceJoined: (presence: PresenceState) => void;
  onPresenceUpdate: (presence: PresenceState) => void;
  onPresenceLeft: (username: string) => void;
  onChatMessage: (message: ChatMessage) => void;
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
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.desiredPresence = null;
    this.isConnected = false;
  }

  joinScene(sceneId: string, x: number, y: number, facing: Facing): void {
    this.desiredPresence = { sceneId, x, y, facing };
    if (this.isConnected) {
      this.socket?.emit("presence:join", this.desiredPresence);
    }
  }

  changeScene(sceneId: string, x: number, y: number, facing: Facing): void {
    this.desiredPresence = { sceneId, x, y, facing };
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

  private rejoinCurrentScene(): void {
    if (this.desiredPresence) {
      this.socket?.emit("presence:join", this.desiredPresence);
    }
  }
}
