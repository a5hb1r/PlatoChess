import { test, expect } from "../playwright-fixture";

test.describe("smoke routes", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/platochess/i).first()).toBeVisible();
  });

  test("play page loads", async ({ page }) => {
    await page.goto("/play");
    await expect(page.getByText(/play chess/i)).toBeVisible();
  });

  test("game page loads", async ({ page }) => {
    await page.goto("/game?level=2");
    await expect(page.getByText(/vs stockfish/i)).toBeVisible();
  });

  test("practice mode shows eval bar", async ({ page }) => {
    await page.goto("/game?level=2&mode=practice");
    await expect(page.getByTestId("eval-bar")).toBeVisible();
  });

  test("online mode hides eval bar", async ({ page }) => {
    await page.goto("/game?level=2&mode=online");
    await expect(page.getByTestId("eval-bar")).toHaveCount(0);
  });

  test("puzzles page loads", async ({ page }) => {
    await page.goto("/puzzles");
    await expect(page.getByText(/chess puzzles/i)).toBeVisible();
  });

  test("analyze page loads", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.getByText(/game analysis/i)).toBeVisible();
  });
});
