import type { BattleState, ChatMessage, PlayerSave, PresenceState, WorldContent } from "@rpg/game-core";
import type { BattleReport, FieldPrompt } from "../gameplay";

export type DialogueState = {
  title: string;
  locationKey: string;
  lines: string[];
  index: number;
};

export type AppState = {
  token: string | null;
  world: WorldContent | null;
  player: PlayerSave | null;
  battle: BattleState | null;
  battleReport: BattleReport | null;
  presence: PresenceState[];
  chatMessages: ChatMessage[];
  dialogue: DialogueState | null;
  fieldPrompt: FieldPrompt | null;
  logs: string[];
  authMode: "login" | "register";
  connectionStatus: "offline" | "connecting" | "online";
  pending: boolean;
};

type Listener = (state: AppState) => void;

export class AppStore {
  private state: AppState = {
    token: null,
    world: null,
    player: null,
    battle: null,
    battleReport: null,
    presence: [],
    chatMessages: [],
    dialogue: null,
    fieldPrompt: null,
    logs: [],
    authMode: "login",
    connectionStatus: "offline",
    pending: false,
  };

  private readonly listeners = new Set<Listener>();

  getState(): AppState {
    return this.state;
  }

  setState(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  update(updater: (state: AppState) => AppState): void {
    this.state = updater(this.state);
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  pushLog(message: string): void {
    this.state = {
      ...this.state,
      logs: [message, ...this.state.logs].slice(0, 30),
    };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}
