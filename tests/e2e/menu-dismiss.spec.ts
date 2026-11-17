import { test, expect } from "@playwright/test";

for (const [route, label, heading] of [
  ["/saved", "Saved designs", "Good ideas, kept close."],
  ["/account", "Your account", "Your little corner of the studio."],
]) {
  test("mobile same-route dismissal for " + label, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    const trigger = page.getByRole("button", { name: "Open navigation" });
    const dialog = page.getByRole("dialog", { name: "Site navigation" });
    for (let attempt = 0; attempt < 2; attempt++) {
      await trigger.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("link", { name: label, exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(dialog).not.toBeVisible();
      await expect(page).toHaveURL(new RegExp(route + "$"));
      await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    }
    await page.goto("/shop");
    await trigger.click();
    await dialog.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(route + "$"));
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
}
