import { io, type Socket } from "socket.io-client";
import type { ChatMessage, Facing, PresenceState } from "@rpg/game-core";

type RealtimeHandlers = {
  onSnapshot: (snapshot: PresenceState[]) => void;
  onPresenceUpdate: (presence: PresenceState) => void;
  onPresenceLeft: (username: string) => void;
  onChatMessage: (message: ChatMessage) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export class PresenceClient {
  private socket: Socket | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly handlers: RealtimeHandlers,
  ) {}

  connect(token: string): void {
    this.socket?.disconnect();
    this.socket = io(this.baseUrl, {
      auth: { token },
    });

    this.socket.on("connect", this.handlers.onConnect);
    this.socket.on("disconnect", this.handlers.onDisconnect);
    this.socket.on("presence:snapshot", this.handlers.onSnapshot);
    this.socket.on("presence:update", this.handlers.onPresenceUpdate);
    this.socket.on("presence:left", this.handlers.onPresenceLeft);
    this.socket.on("chat:message", this.handlers.onChatMessage);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinScene(sceneId: string, x: number, y: number, facing: Facing): void {
    this.socket?.emit("presence:join", { sceneId, x, y, facing });
  }

  changeScene(sceneId: string, x: number, y: number, facing: Facing): void {
    this.socket?.emit("scene:change", { sceneId, x, y, facing });
  }

  updatePosition(x: number, y: number, facing: Facing): void {
    this.socket?.emit("presence:update", { x, y, facing });
  }

  sendChat(text: string): void {
    this.socket?.emit("chat:send", { text });
  }
}
