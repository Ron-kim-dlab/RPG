import { describe, expect, it } from "vitest";
import {
  clampFloatingPanelLayout,
  cloneFloatingLayouts,
  isFloatingLayoutEnabled,
  sanitizeStoredLayouts,
} from "../src/ui/layout";

describe("floating panel layout helpers", () => {
  it("enables floating layouts only above the desktop breakpoint", () => {
    expect(isFloatingLayoutEnabled(921)).toBe(true);
    expect(isFloatingLayoutEnabled(920)).toBe(false);
  });

  it("sanitizes malformed stored layout payloads", () => {
    const layouts = sanitizeStoredLayouts({
      chat: {
        x: 32,
        y: 48,
        width: 320,
        height: 280,
        z: 9,
      },
      broken: {
        x: "nope",
      },
      battle: null,
    });

    expect(layouts.chat).toEqual({
      x: 32,
      y: 48,
      width: 320,
      height: 280,
      z: 9,
    });
    expect("broken" in layouts).toBe(false);
    expect(layouts.battle).toBeUndefined();
  });

  it("clamps panel bounds to the visible container and minimum sizes", () => {
    const clamped = clampFloatingPanelLayout("chat", {
      x: 900,
      y: -24,
      width: 120,
      height: 1000,
      z: 0,
    }, {
      width: 800,
      height: 600,
    });

    expect(clamped).toEqual({
      x: 520,
      y: 0,
      width: 280,
      height: 600,
      z: 1,
    });
  });

  it("clones layout records without sharing object references", () => {
    const original = {
      hud: {
        x: 18,
        y: 18,
        width: 800,
        height: 220,
        z: 2,
      },
    };

    const cloned = cloneFloatingLayouts(original);
    expect(cloned).toEqual(original);
    expect(cloned.hud).not.toBe(original.hud);
  });
});
