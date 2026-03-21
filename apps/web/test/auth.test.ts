import { describe, expect, it } from "vitest";

import { validateAuthCredentials } from "../src/auth";

describe("web auth validation", () => {
  it("rejects usernames shorter than the minimum length", () => {
    expect(validateAuthCredentials("a", "password123")).toBe("사용자 이름은 2자 이상이어야 합니다.");
  });

  it("rejects passwords shorter than the minimum length", () => {
    expect(validateAuthCredentials("tester", "short")).toBe("비밀번호는 최소 8자 이상이어야 합니다.");
  });

  it("accepts valid credentials", () => {
    expect(validateAuthCredentials("tester", "password123")).toBeNull();
  });
});
