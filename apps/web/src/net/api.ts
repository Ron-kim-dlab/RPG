import type {
  ApiResponse,
  BootstrapPayload,
  PlayerPayload,
  PlayerSave,
  SessionPayload,
  WorldContent,
} from "@rpg/game-core";

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async bootstrap(): Promise<WorldContent> {
    const payload = await this.readResponse<BootstrapPayload>(`${this.baseUrl}/content/bootstrap`);
    return payload.world;
  }

  async register(username: string, password: string): Promise<{ token: string; player: PlayerSave }> {
    return this.postAuth("/auth/register", { username, password });
  }

  async login(username: string, password: string): Promise<{ token: string; player: PlayerSave }> {
    return this.postAuth("/auth/login", { username, password });
  }

  async me(token: string): Promise<PlayerSave> {
    const payload = await this.readResponse<PlayerPayload>(`${this.baseUrl}/player/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return payload.player;
  }

  async save(token: string, player: PlayerSave): Promise<PlayerSave> {
    const payload = await this.readResponse<PlayerPayload>(`${this.baseUrl}/player/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ player }),
    });
    return payload.player;
  }

  private async postAuth(path: string, body: Record<string, unknown>): Promise<{ token: string; player: PlayerSave }> {
    const payload = await this.readResponse<SessionPayload>(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return {
      token: payload.token,
      player: payload.player,
    };
  }

  private async readResponse<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init);
    const payload = await response.json() as ApiResponse<T>;

    if (!response.ok || !payload.success) {
      const message = payload.success ? "요청 처리에 실패했습니다." : payload.error.message;
      throw new Error(message);
    }

    return payload.data;
  }
}
