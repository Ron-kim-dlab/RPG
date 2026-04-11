import { describe, expect, it } from "vitest";
import { INITIAL_SCENE, shouldDisableGlobalKeyboardCapture } from "../src/game/sceneFlow";

describe("scene flow", () => {
  it("boots into the loading scene before auth or overworld", () => {
    expect(INITIAL_SCENE).toBe("loading");
  });

  it("disables global capture for loading and login scenes", () => {
    expect(shouldDisableGlobalKeyboardCapture("loading")).toBe(true);
    expect(shouldDisableGlobalKeyboardCapture("login")).toBe(true);
  });

  it("keeps global capture enabled for overworld gameplay", () => {
    expect(shouldDisableGlobalKeyboardCapture("overworld")).toBe(false);
  });
});
