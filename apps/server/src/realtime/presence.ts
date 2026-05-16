import type { Server } from "socket.io";
import type { ChatMessage, Facing, PresenceState, WorldContent } from "@rpg/game-core";
import type { ServerEnv } from "../config/env";
import { verifyToken } from "../http/auth";

type AuthenticatedSocketData = {
  username: string;
  color: string;
  sceneId?: string;
};

type PresenceEntry = PresenceState & {
  socketId: string;
};

type SceneBounds = {
  width: number;
  height: number;
};

type PresencePayload = {
  sceneId: string;
  x: number;
  y: number;
  facing: Facing;
};

const FACING_VALUES = new Set<Facing>(["up", "down", "left", "right"]);
const MAX_CHAT_LENGTH = 200;

function colorFromUsername(username: string): string {
  const palette = ["#f25f5c", "#247ba0", "#70c1b3", "#ffe066", "#50514f", "#f79d65"];
  const index = Array.from(username).reduce((acc, char) => acc + char.charCodeAt(0), 0) % palette.length;
  return palette[index]!;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function buildSceneBounds(world: WorldContent): Map<string, SceneBounds> {
  return new Map(
    Object.values(world.locations).map((location) => [
      location.scene.sceneId,
      {
        width: location.scene.width,
        height: location.scene.height,
      },
    ]),
  );
}

function isFacing(value: unknown): value is Facing {
  return typeof value === "string" && FACING_VALUES.has(value as Facing);
}

function isCoordinateInsideScene(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

function readPresencePayload(payload: unknown, sceneBounds: Map<string, SceneBounds>): PresencePayload | null {
  const record = asRecord(payload);
  if (!record || typeof record.sceneId !== "string") {
    return null;
  }

  const bounds = sceneBounds.get(record.sceneId);
  if (!bounds) {
    return null;
  }

  if (!isCoordinateInsideScene(record.x, bounds.width) || !isCoordinateInsideScene(record.y, bounds.height)) {
    return null;
  }

  if (!isFacing(record.facing)) {
    return null;
  }

  return {
    sceneId: record.sceneId,
    x: record.x,
    y: record.y,
    facing: record.facing,
  };
}

function readPositionPayload(payload: unknown, bounds: SceneBounds): Omit<PresencePayload, "sceneId"> | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  if (!isCoordinateInsideScene(record.x, bounds.width) || !isCoordinateInsideScene(record.y, bounds.height)) {
    return null;
  }

  if (!isFacing(record.facing)) {
    return null;
  }

  return {
    x: record.x,
    y: record.y,
    facing: record.facing,
  };
}

function readChatText(payload: unknown): string | null {
  const record = asRecord(payload);
  const text = typeof record?.text === "string" ? record.text.trim() : "";
  if (text.length === 0 || text.length > MAX_CHAT_LENGTH) {
    return null;
  }
  return text;
}

export function configureRealtime(io: Server, env: ServerEnv, world: WorldContent): void {
  const presenceByScene = new Map<string, Map<string, PresenceEntry>>();
  const sceneBounds = buildSceneBounds(world);

  const serializeRoom = (room: Map<string, PresenceEntry>): PresenceState[] =>
    Array.from(room.values()).map((entry) => ({
      username: entry.username,
      sceneId: entry.sceneId,
      x: entry.x,
      y: entry.y,
      facing: entry.facing,
      color: entry.color,
      updatedAt: entry.updatedAt,
    }));

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
        const current = room.get(data.username);
        if (current?.socketId === socket.id) {
          room.delete(data.username);
          socket.to(currentScene).emit("presence:left", data.username);
          if (room.size === 0) {
            presenceByScene.delete(currentScene);
          }
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

      const room = presenceByScene.get(sceneId) ?? new Map<string, PresenceEntry>();
      const hadExisting = room.has(data.username);
      room.set(data.username, {
        ...state,
        socketId: socket.id,
      });
      presenceByScene.set(sceneId, room);

      socket.emit("presence:snapshot", serializeRoom(room));
      socket.to(sceneId).emit(hadExisting ? "presence:update" : "presence:joined", state);
    };

    socket.on("presence:join", (payload: unknown) => {
      const nextPresence = readPresencePayload(payload, sceneBounds);
      if (!nextPresence) {
        return;
      }
      joinScene(nextPresence.sceneId, nextPresence.x, nextPresence.y, nextPresence.facing);
    });

    socket.on("scene:change", (payload: unknown) => {
      const nextPresence = readPresencePayload(payload, sceneBounds);
      if (!nextPresence) {
        return;
      }
      joinScene(nextPresence.sceneId, nextPresence.x, nextPresence.y, nextPresence.facing);
    });

    socket.on("presence:update", (payload: unknown) => {
      if (!data.sceneId) {
        return;
      }
      const bounds = sceneBounds.get(data.sceneId);
      if (!bounds) {
        return;
      }
      const nextPosition = readPositionPayload(payload, bounds);
      if (!nextPosition) {
        return;
      }
      const room = presenceByScene.get(data.sceneId);
      const current = room?.get(data.username);
      if (!room || !current || current.socketId !== socket.id) {
        return;
      }
      const next: PresenceEntry = {
        ...current,
        ...nextPosition,
        updatedAt: new Date().toISOString(),
        socketId: socket.id,
      };
      room.set(data.username, next);
      socket.to(data.sceneId).emit("presence:update", {
        username: next.username,
        sceneId: next.sceneId,
        x: next.x,
        y: next.y,
        facing: next.facing,
        color: next.color,
        updatedAt: next.updatedAt,
      } satisfies PresenceState);
    });

    socket.on("chat:send", (payload: unknown) => {
      if (!data.sceneId) {
        return;
      }
      const text = readChatText(payload);
      if (!text) {
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
