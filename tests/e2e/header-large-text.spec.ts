import { test, expect } from "@playwright/test";

// Text-resize simulation, not native zoom or physical-device certification.
for (const width of [320, 390, 768]) {
  test(`mobile header remains usable with doubled text at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop");
    await page.evaluate(() => {
      const styles = Array.from(
        document.querySelectorAll<HTMLElement>("body *"),
        (el) => {
          const css = getComputedStyle(el);
          return {
            el,
            fontSize: parseFloat(css.fontSize),
            lineHeight: css.lineHeight,
          };
        },
      );
      for (const { el, fontSize, lineHeight } of styles) {
        el.style.setProperty("font-size", `${fontSize * 2}px`, "important");
        if (lineHeight !== "normal") {
          el.style.setProperty(
            "line-height",
            `${parseFloat(lineHeight) * 2}px`,
            "important",
          );
        }
      }
    });
    // This slice qualifies the header; full-catalog title overflow is tracked separately.
    const header = page.locator(".site-header");
    expect(
      await header.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    for (const control of [
      header.getByRole("button", { name: "Open navigation" }),
      header.getByRole("link", { name: "Sonoran Slush home" }),
      header.getByRole("button", { name: "Search gifts" }),
      header.getByRole("link", { name: "Shopping bag", exact: true }),
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await control.focus();
      await expect(control).toBeFocused();
    }
    const menu = header.getByRole("button", { name: "Open navigation" });
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    const search = header.getByRole("button", { name: "Search gifts" });
    await search.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(search).toBeFocused();
    const bag = header.getByRole("link", { name: "Shopping bag", exact: true });
    await bag.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/cart\/?$/);
  });
}
