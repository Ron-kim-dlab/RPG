import type { StoredAccount, UserRepository } from "./types";

export class MemoryUserRepository implements UserRepository {
  private readonly accounts = new Map<string, StoredAccount>();

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async findByUsername(username: string): Promise<StoredAccount | null> {
    return this.accounts.get(username) ?? null;
  }

  async saveAccount(account: StoredAccount): Promise<void> {
    this.accounts.set(account.username, account);
  }
}
