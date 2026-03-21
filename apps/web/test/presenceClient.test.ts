import type { Socket } from "socket.io-client";
import { describe, expect, it, vi } from "vitest";
import { PresenceClient } from "../src/net/socket";

class FakeSocket {
  private readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  public readonly emitted: Array<{ eventName: string; payload: unknown }> = [];

  on(eventName: string, handler: (...args: unknown[]) => void): this {
    const nextHandlers = this.handlers.get(eventName) ?? [];
    nextHandlers.push(handler);
    this.handlers.set(eventName, nextHandlers);
    return this;
  }

  emit(eventName: string, payload: unknown): this {
    this.emitted.push({ eventName, payload });
    return this;
  }

  disconnect(): this {
    return this;
  }

  trigger(eventName: string, ...args: unknown[]): void {
    (this.handlers.get(eventName) ?? []).forEach((handler) => handler(...args));
  }

  clearEmitted(): void {
    this.emitted.length = 0;
  }
}

describe("PresenceClient", () => {
  it("rejoins the latest scene state after reconnect", () => {
    const socket = new FakeSocket();
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();

    const client = new PresenceClient(
      "http://localhost:4000",
      {
        onSnapshot: vi.fn(),
        onPresenceJoined: vi.fn(),
        onPresenceUpdate: vi.fn(),
        onPresenceLeft: vi.fn(),
        onChatMessage: vi.fn(),
        onConnect,
        onDisconnect,
        onConnectError: vi.fn(),
      },
      () => socket as unknown as Socket,
    );

    client.connect("token-value");
    client.joinScene("scene-start", 10, 20, "down");
    expect(socket.emitted).toEqual([]);

    socket.trigger("connect");
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(socket.emitted).toEqual([
      {
        eventName: "presence:join",
        payload: { sceneId: "scene-start", x: 10, y: 20, facing: "down" },
      },
    ]);

    socket.clearEmitted();
    client.updatePosition(14, 28, "left");
    expect(socket.emitted).toEqual([
      {
        eventName: "presence:update",
        payload: { x: 14, y: 28, facing: "left" },
      },
    ]);

    socket.trigger("disconnect", "transport close");
    expect(onDisconnect).toHaveBeenCalledWith("transport close");

    socket.clearEmitted();
    client.changeScene("scene-plaza", 120, 220, "up");
    expect(socket.emitted).toEqual([]);

    socket.trigger("connect");
    expect(onConnect).toHaveBeenCalledTimes(2);
    expect(socket.emitted).toEqual([
      {
        eventName: "presence:join",
        payload: { sceneId: "scene-plaza", x: 120, y: 220, facing: "up" },
      },
    ]);
  });
});
