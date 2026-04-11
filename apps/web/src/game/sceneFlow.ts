export type ManagedSceneKey = "loading" | "login" | "overworld";

export const INITIAL_SCENE: ManagedSceneKey = "loading";

export function shouldDisableGlobalKeyboardCapture(activeScene: ManagedSceneKey): boolean {
  return activeScene !== "overworld";
}
