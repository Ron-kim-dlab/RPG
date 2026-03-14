import type { PlayerSave } from "@rpg/game-core";

export type StoredAccount = {
  username: string;
  passwordHash: string;
  player: PlayerSave | null;
};

export type UserRepository = {
  connect(): Promise<void>;
  findByUsername(username: string): Promise<StoredAccount | null>;
  saveAccount(account: StoredAccount): Promise<void>;
};
