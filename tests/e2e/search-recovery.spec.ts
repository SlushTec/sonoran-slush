import { test, expect } from "@playwright/test";

for (const width of [1280, 390]) {
  test("explicit typo recovery preserves usable catalog state at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop?category=drinkware&q=tumblre&sort=za&campaign=test#results");
    const search = page.getByRole("searchbox", { name: "Search the collection" });
    await expect(search).toHaveValue("tumblre");
    await expect(page.getByLabel("Sort by")).toHaveValue("za");
    const suggestion = page.getByRole("button", { name: "Search for tumbler", exact: true });
    await expect(suggestion).toBeVisible();
    await suggestion.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".empty-state").screenshot({path: "D:/dot-workspace/store-recovery-artifacts/typo-panel-" + width + ".png"});
    const history = await page.evaluate(() => window.history.length);
    await suggestion.focus();
    await page.keyboard.press("Enter");
    await expect(search).toHaveValue("tumbler");
    await expect(search).toBeFocused();
    await expect(page.getByRole("group", {name:"Search suggestions"})).toHaveCount(0);
    await expect(page.locator(".catalog-grid .product-card").first()).toBeVisible();
    const url = new URL(page.url());
    expect(url.searchParams.get("category")).toBe("drinkware");
    expect(url.searchParams.get("sort")).toBe("za");
    expect(url.searchParams.get("campaign")).toBe("test");
    expect(url.hash).toBe("#results");
    expect(await page.evaluate(() => window.history.length)).toBe(history);
    await page.locator(".catalog-grid .product-card h3 a").first().click();
    await expect(page).toHaveURL(/\/products\//);
    await page.goBack();
    await expect(search).toHaveValue("tumbler");
    await page.reload();
    await expect(search).toHaveValue("tumbler");
    await expect(page.getByLabel("Sort by")).toHaveValue("za");
    await page.goto("/shop?category=photo-crystals&material=Wood&q=tumblre");
    await expect(search).toHaveValue("tumblre");
    await expect(page.getByLabel("Material")).toHaveValue("Wood");
    await expect(page.getByRole("group", {name:"Search suggestions"})).toHaveCount(0);
    await expect(page.getByRole("heading", {name:"No gifts found, just yet."})).toBeVisible();
  });
}
