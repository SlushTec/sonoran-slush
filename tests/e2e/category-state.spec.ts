import { test, expect } from "@playwright/test";

for (const width of [1280, 390]) {
  test("category pressed state survives keyboard choice, reset and history " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop");
    const categories = page.getByRole("navigation", { name: "Gift categories" });
    const all = categories.getByRole("button", { name: /All gifts/ });
    const glass = categories.getByRole("button", { name: /Bar & glassware/ });
    await expect(categories.getByRole("button", { pressed: true })).toHaveCount(1);
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await glass.focus();
    await page.keyboard.press("Enter");
    await expect(glass).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");
    await expect(categories.getByRole("button", { pressed: true })).toHaveCount(1);
    await page.reload();
    await expect(glass).toHaveAttribute("aria-pressed", "true");
    await page.locator(".catalog-grid a").first().click();
    await expect(page).toHaveURL(/\/products\//);
    await page.goBack();
    await expect(page).toHaveURL(/\/shop/);
    await expect(glass).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(categories.getByRole("button", { pressed: true })).toHaveCount(1);
    await page.goto("/shop/photo-crystals");
    const crystal = categories.getByRole("button", { name: /Photo crystals/ });
    await expect(crystal).toHaveAttribute("aria-pressed", "true");
    await all.focus();
    await page.keyboard.press("Space");
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("searchbox").fill("crystal");
    await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    await expect(crystal).toHaveAttribute("aria-pressed", "true");
    await expect(categories.getByRole("button", { pressed: true })).toHaveCount(1);
  });
}
