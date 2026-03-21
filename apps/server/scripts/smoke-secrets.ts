import { io, type Socket } from "socket.io-client";
import type {
  ApiResponse,
  BootstrapPayload,
  ChatMessage,
  HealthPayload,
  PlayerPayload,
  PlayerSave,
  PresenceState,
  SessionPayload,
  WorldContent,
} from "@rpg/game-core";
import { readEnv } from "../src/config/env";

type Credentials = {
  username: string;
  password: string;
};

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createCredentials(prefix: string): Credentials {
  const suffix = randomSuffix();
  return {
    username: `${prefix}-${suffix}`,
    password: `secret-${suffix}-pw`,
  };
}

function readBaseUrl(): string {
  const fromEnv = process.env.SMOKE_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const env = readEnv(process.env);
  return `http://127.0.0.1:${env.port}`;
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    const message = payload.success ? "Unknown API error" : payload.error.message;
    throw new Error(message);
  }
  return payload.data;
}

async function api<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);
  return readResponse<T>(response);
}

async function waitForSocket(socket: Socket): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket connection timed out.")), 5_000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function waitForEvent<T>(socket: Socket, eventName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}.`)), 5_000);
    socket.once(eventName, (payload) => {
      clearTimeout(timeout);
      resolve(payload as T);
    });
  });
}

async function main(): Promise<void> {
  const baseUrl = readBaseUrl();
  console.log(`Running rotation smoke test against ${baseUrl}`);

  const health = await api<HealthPayload>(baseUrl, "/healthz");
  if (health.status !== "ok") {
    throw new Error("Health check did not return ok.");
  }

  const bootstrap = await api<BootstrapPayload>(baseUrl, "/content/bootstrap");
  const world: WorldContent = bootstrap.world;
  const startLocation = world.locations[world.startLocationKey];
  if (!startLocation) {
    throw new Error("Start location is missing from bootstrap payload.");
  }
  const sceneId = startLocation.scene.sceneId;

  const userA = createCredentials("rotation-smoke-a");
  const userB = createCredentials("rotation-smoke-b");

  const registerA = await api<SessionPayload>(baseUrl, "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userA),
  });

  const registerB = await api<SessionPayload>(baseUrl, "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userB),
  });

  const loginA = await api<SessionPayload>(baseUrl, "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userA),
  });

  const me = await api<PlayerPayload>(baseUrl, "/player/me", {
    headers: {
      Authorization: `Bearer ${loginA.token}`,
    },
  });

  const updatedPlayer: PlayerSave = {
    ...me.player,
    coins: me.player.coins + 1,
  };

  await api<PlayerPayload>(baseUrl, "/player/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginA.token}`,
    },
    body: JSON.stringify({ player: updatedPlayer }),
  });

  const socketA = io(baseUrl, { auth: { token: registerA.token } });
  const socketB = io(baseUrl, { auth: { token: registerB.token } });

  try {
    await Promise.all([waitForSocket(socketA), waitForSocket(socketB)]);

    const initialSnapshotA = waitForEvent<PresenceState[]>(socketA, "presence:snapshot");
    socketA.emit("presence:join", {
      sceneId,
      x: startLocation.scene.spawn.x,
      y: startLocation.scene.spawn.y,
      facing: "down",
    });
    await initialSnapshotA;

    const joinedSeenByA = waitForEvent<PresenceState>(socketA, "presence:joined");
    const snapshotB = waitForEvent<PresenceState[]>(socketB, "presence:snapshot");
    const chatSeenByA = waitForEvent<ChatMessage>(socketA, "chat:message");

    socketB.emit("presence:join", {
      sceneId,
      x: startLocation.scene.spawn.x + 32,
      y: startLocation.scene.spawn.y,
      facing: "right",
    });

    const [joined, snapshot] = await Promise.all([joinedSeenByA, snapshotB]);
    if (joined.username !== registerB.player.username) {
      throw new Error("Presence join event returned an unexpected user.");
    }
    if (!snapshot.some((entry) => entry.username === registerB.player.username)) {
      throw new Error("Presence snapshot did not include the joined player.");
    }

    socketB.emit("chat:send", { text: "rotation smoke test" });
    const chat = await chatSeenByA;
    if (chat.text !== "rotation smoke test") {
      throw new Error("Chat round trip failed.");
    }
  } finally {
    socketA.disconnect();
    socketB.disconnect();
  }

  console.log(`Rotation smoke test succeeded for ${loginA.player.username}.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown smoke test error";
  console.error(`Rotation smoke test failed: ${message}`);
  process.exit(1);
});
