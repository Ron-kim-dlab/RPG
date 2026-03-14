import type { Server } from "socket.io";
import type { ChatMessage, Facing, PresenceState } from "@rpg/game-core";
import type { ServerEnv } from "../config/env";
import { verifyToken } from "../http/auth";

type AuthenticatedSocketData = {
  username: string;
  color: string;
  sceneId?: string;
};

function colorFromUsername(username: string): string {
  const palette = ["#f25f5c", "#247ba0", "#70c1b3", "#ffe066", "#50514f", "#f79d65"];
  const index = Array.from(username).reduce((acc, char) => acc + char.charCodeAt(0), 0) % palette.length;
  return palette[index]!;
}

export function configureRealtime(io: Server, env: ServerEnv): void {
  const presenceByScene = new Map<string, Map<string, PresenceState>>();

  io.use((socket, next) => {
    const token = String(socket.handshake.auth.token ?? "");
    if (!token) {
      next(new Error("Missing auth token"));
      return;
    }

    try {
      const auth = verifyToken(env, token);
      socket.data.username = auth.username;
      socket.data.color = colorFromUsername(auth.username);
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    const data = socket.data as AuthenticatedSocketData;

    const leaveCurrentScene = () => {
      const currentScene = data.sceneId;
      if (!currentScene) {
        return;
      }

      socket.leave(currentScene);
      const room = presenceByScene.get(currentScene);
      if (room) {
        room.delete(data.username);
        socket.to(currentScene).emit("presence:left", data.username);
        if (room.size === 0) {
          presenceByScene.delete(currentScene);
        }
      }
      data.sceneId = undefined;
    };

    const joinScene = (sceneId: string, x: number, y: number, facing: Facing) => {
      leaveCurrentScene();
      data.sceneId = sceneId;
      socket.join(sceneId);

      const state: PresenceState = {
        username: data.username,
        sceneId,
        x,
        y,
        facing,
        color: data.color,
        updatedAt: new Date().toISOString(),
      };

      const room = presenceByScene.get(sceneId) ?? new Map<string, PresenceState>();
      room.set(data.username, state);
      presenceByScene.set(sceneId, room);

      socket.emit("presence:snapshot", Array.from(room.values()));
      socket.to(sceneId).emit("presence:update", state);
    };

    socket.on("presence:join", (payload: { sceneId: string; x: number; y: number; facing: Facing }) => {
      joinScene(payload.sceneId, payload.x, payload.y, payload.facing);
    });

    socket.on("scene:change", (payload: { sceneId: string; x: number; y: number; facing: Facing }) => {
      joinScene(payload.sceneId, payload.x, payload.y, payload.facing);
    });

    socket.on("presence:update", (payload: { x: number; y: number; facing: Facing }) => {
      if (!data.sceneId) {
        return;
      }
      const room = presenceByScene.get(data.sceneId);
      const current = room?.get(data.username);
      if (!room || !current) {
        return;
      }
      const next: PresenceState = {
        ...current,
        ...payload,
        updatedAt: new Date().toISOString(),
      };
      room.set(data.username, next);
      socket.to(data.sceneId).emit("presence:update", next);
    });

    socket.on("chat:send", (payload: { text: string }) => {
      if (!data.sceneId) {
        return;
      }
      const text = String(payload.text ?? "").trim();
      if (text.length === 0 || text.length > 200) {
        return;
      }

      const message: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        username: data.username,
        sceneId: data.sceneId,
        text,
        createdAt: new Date().toISOString(),
      };

      io.to(data.sceneId).emit("chat:message", message);
    });

    socket.on("disconnect", () => {
      leaveCurrentScene();
    });
  });
}
