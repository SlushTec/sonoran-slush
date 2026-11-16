import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1280]) {
  for (const scale of [1, 2]) {
    test(`product names remain readable at ${width} with text scale ${scale}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/shop", "/shop?q=decanter"]) {
        await page.goto(route);
        const titles = page.locator(".product-card h3 a");
        await expect(titles).toHaveCount(route.includes("?") ? 2 : 41);
        await expect(titles.first()).toBeVisible();
        const original = await titles.allTextContents();
        if (scale === 2) {
          // Explicit doubled-text simulation, not native zoom or mobile-device acceptance.
          await page.evaluate(() => {
            const rows = Array.from(
              document.querySelectorAll<HTMLElement>("body *"),
              (el) => {
                const s = getComputedStyle(el);
                return { el, font: parseFloat(s.fontSize), line: s.lineHeight };
              },
            );
            for (const { el, font, line } of rows) {
              el.style.setProperty("font-size", `${font * 2}px`, "important");
              if (line !== "normal")
                el.style.setProperty(
                  "line-height",
                  `${parseFloat(line) * 2}px`,
                  "important",
                );
            }
          });
        }
        expect(await titles.allTextContents()).toEqual(original);
        const violations = await titles.evaluateAll((elements) =>
          elements.flatMap((el) => {
            const card = el.closest(".product-card")!.getBoundingClientRect();
            const clipped = Array.from(el.getClientRects()).some(
              (r) => r.left < card.left - 1 || r.right > card.right + 1,
            );
            return clipped ? [el.textContent] : [];
          }),
        );
        expect(violations).toEqual([]);
        const focused = titles.first();
        await focused.focus();
        await expect(focused).toBeFocused();
        expect(
          await focused.evaluate((el) => {
            let node: Element | null = el;
            while (node && !node.classList.contains("product-grid")) {
              const style = getComputedStyle(node);
              if (
                ["hidden", "clip"].includes(style.overflowX) ||
                ["hidden", "clip"].includes(style.overflowY)
              )
                return false;
              node = node.parentElement;
            }
            return true;
          }),
        ).toBe(true);
        const destination = await focused.getAttribute("href");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(new RegExp(`${destination}/?$`));
      }
    });
  }
}
