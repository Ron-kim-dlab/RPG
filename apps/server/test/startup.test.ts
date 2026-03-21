import { describe, expect, it } from "vitest";

import { formatStartupError } from "../src/startup";

describe("formatStartupError", () => {
  it("explains port conflicts with a clear next step", () => {
    const error = Object.assign(new Error("listen EADDRINUSE"), {
      code: "EADDRINUSE",
      port: 4000,
    });

    expect(formatStartupError(error, 4000)).toContain("Port 4000 is already in use.");
    expect(formatStartupError(error, 4000)).toContain("apps/server/.env");
  });

  it("falls back to the original error message for unknown failures", () => {
    expect(formatStartupError(new Error("boom"), 4000)).toBe("boom");
  });
});
