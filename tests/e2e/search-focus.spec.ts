import { test, expect } from "@playwright/test";

for (const width of [1280, 390]) {
  test("catalog recovery keeps keyboard focus at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop?campaign=test&sort=za#results");
    const search = page.getByRole("searchbox", { name: "Search the collection" });
    await expect(page.getByLabel("Sort by")).toHaveValue("za");
    for (const action of ["Clear search", "Reset filters", "Clear filters"]) {
      await search.fill("zznomatch");
      await expect(page.getByRole("heading", { name: "No gifts found, just yet." })).toBeVisible();
      const button = page.getByRole("button", { name: action, exact: true });
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(search).toHaveValue("");
      await expect(search).toBeFocused();
      await expect(page.getByRole("heading", { name: "No gifts found, just yet." })).toHaveCount(0);
      const url = new URL(page.url());
      expect(url.searchParams.has("q")).toBe(false);
      expect(url.searchParams.get("sort")).toBe("za");
      expect(url.searchParams.get("campaign")).toBe("test");
      expect(url.hash).toBe("#results");
    }
    await page.getByRole("button", { name: /Bar & glassware/ }).click();
    await search.fill("zznomatch");
    await page.getByRole("button", { name: "Clear search", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(search).toBeFocused();
    await expect(page.getByRole("button", { name: /Bar & glassware/ })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(search).toHaveValue("");
    await expect(page.getByRole("button", { name: /Bar & glassware/ })).toHaveAttribute("aria-pressed", "true");
  });
}
