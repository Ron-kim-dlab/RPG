import { test, expect } from "@playwright/test";

test("landing shell renders", async ({ page, baseURL }) => {
  test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL to run browser E2E against a live environment.");

  await page.goto(baseURL!);
  await expect(page.getByRole("heading", { name: "RPG Rebuild" })).toBeVisible();
});
