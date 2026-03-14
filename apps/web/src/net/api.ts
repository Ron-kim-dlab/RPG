import type { PlayerSave, WorldContent } from "@rpg/game-core";

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async bootstrap(): Promise<WorldContent> {
    const response = await fetch(`${this.baseUrl}/content/bootstrap`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "콘텐츠를 불러오지 못했습니다.");
    }
    return payload.world as WorldContent;
  }

  async register(username: string, password: string): Promise<{ token: string; player: PlayerSave }> {
    return this.postAuth("/auth/register", { username, password });
  }

  async login(username: string, password: string): Promise<{ token: string; player: PlayerSave }> {
    return this.postAuth("/auth/login", { username, password });
  }

  async me(token: string): Promise<PlayerSave> {
    const response = await fetch(`${this.baseUrl}/player/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "세션이 만료되었습니다.");
    }
    return payload.player as PlayerSave;
  }

  async save(token: string, player: PlayerSave): Promise<PlayerSave> {
    const response = await fetch(`${this.baseUrl}/player/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ player }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "세이브에 실패했습니다.");
    }
    return payload.player as PlayerSave;
  }

  private async postAuth(path: string, body: Record<string, unknown>): Promise<{ token: string; player: PlayerSave }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "인증 요청에 실패했습니다.");
    }
    return {
      token: payload.token as string,
      player: payload.player as PlayerSave,
    };
  }
}
