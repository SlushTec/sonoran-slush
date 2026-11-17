import { test, expect } from "@playwright/test";

test("named search dialog survives Escape, reopen and same-route result navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/shop");
  const trigger = page.getByRole("button", { name: "Search gifts", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Find something personal.", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Search products" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("textbox", { name: "Search products" }).fill("decanter");
  await dialog.getByRole("link", { name: "Browse all results" }).click();
  await expect(page).toHaveURL(/\/shop\?q=decanter/);
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close search" }).click();
  await expect(trigger).toBeFocused();
});

test("named mobile navigation keeps exact current-route parity on nested and new pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/shop/drinkware");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Site navigation", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(dialog.getByRole("link", { name: "Shop gifts" })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Help", exact: true }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole("heading", { level: 1, name: "A little guidance. A clear next step." })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await expect(dialog.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(dialog.getByRole("link", { name: "Help", exact: true })).toHaveAttribute("aria-current", "page");
  await dialog.getByRole("link", { name: "Help", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await dialog.getByRole("button", { name: "Close navigation" }).click();
  await expect(trigger).toBeFocused();
});
