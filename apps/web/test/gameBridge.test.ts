import { describe, expect, it } from "vitest";
import { shouldDisableGlobalKeyboardCapture } from "../src/game/GameBridge";

describe("GameBridge keyboard capture", () => {
  it("disables global capture for loading and login scenes", () => {
    expect(shouldDisableGlobalKeyboardCapture("loading")).toBe(true);
    expect(shouldDisableGlobalKeyboardCapture("login")).toBe(true);
  });

  it("keeps global capture enabled for overworld gameplay", () => {
    expect(shouldDisableGlobalKeyboardCapture("overworld")).toBe(false);
  });
});
