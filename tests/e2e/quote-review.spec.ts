import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const quote = () => ({
  id: "quo_browser",
  kind: "retail",
  version: 2,
  status: "offered",
  accepted_version: null as number | null,
  total_minor: 1234,
  currency: "USD",
  message: "Exact reviewed offer\nIncludes the displayed personalization.",
  items: [
    {
      product_slug: "synthetic-crystal",
      quantity: 1,
      text: "A memory to keep",
      secondary: "Always",
      font: "Classic serif",
    },
  ],
});
async function open(page: Page) {
  await page.goto("/quotes");
  await page.getByLabel("Request reference").fill("quo_browser");
  await page.getByLabel("Private access code").fill("synthetic-code");
  await page.getByRole("button", { name: "Open securely" }).click();
  await expect(
    page.getByRole("heading", { name: "Current request" }),
  ).toBeVisible();
}
test("exact acceptance and readable repeat lookup", async ({ page }) => {
  let p = quote(),
    count = 0;
  await page.route("https://commerce.qa.invalid/**", async (r) => {
    expect(r.request().headers().authorization).toBe("Bearer synthetic-code");
    if (r.request().url().endsWith("/accept")) {
      expect(r.request().postDataJSON()).toEqual({
        version: 2,
        decision: "accept",
      });
      p = { ...p, status: "accepted", accepted_version: 2 };
      count++;
    }
    await r.fulfill({ json: p });
  });
  await open(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept quote version 2" }).click();
  await expect(page.locator(".form-success[role=status]")).toBeVisible();
  expect(count).toBe(1);
  await page.getByRole("button", { name: "Close private record" }).click();
  await open(page);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.locator(".form-success[role=status]")).toHaveCount(0);
});
test("same-version changed terms cannot confirm", async ({ page }) => {
  await page.route("https://commerce.qa.invalid/**", (r) =>
    r.fulfill({
      json: r.request().url().endsWith("/accept")
        ? {
            ...quote(),
            status: "accepted",
            accepted_version: 2,
            total_minor: 9999,
          }
        : quote(),
    }),
  );
  await open(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept quote version 2" }).click();
  await expect(page.locator(".form-error[role=alert]")).toBeVisible();
  await expect(page.locator(".form-success[role=status]")).toHaveCount(0);
});
test("late acceptance after close cannot restore record", async ({ page }) => {
  let release: () => void = () => {},
    entered: () => void = () => {};
  const pending = new Promise<void>((r) => (release = r)),
    began = new Promise<void>((r) => (entered = r));
  await page.route("https://commerce.qa.invalid/**", async (r) => {
    if (r.request().url().endsWith("/accept")) {
      entered();
      await pending;
      await r.fulfill({
        json: { ...quote(), status: "accepted", accepted_version: 2 },
      });
    } else await r.fulfill({ json: quote() });
  });
  await open(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept quote version 2" }).click();
  await began;
  await page.getByRole("button", { name: "Close private record" }).click();
  release();
  await page.waitForTimeout(100);
  await expect(
    page.getByRole("heading", { name: "Current request" }),
  ).toHaveCount(0);
  await expect(page.locator(".form-success[role=status]")).toHaveCount(0);
});
for (const width of [1440, 390])
  test("quote layout keyboard and accessibility " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://commerce.qa.invalid/**", (r) =>
      r.fulfill({ json: quote() }),
    );
    await open(page);
    await page.getByRole("checkbox").focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: "Accept quote version 2" }),
    ).toBeEnabled();
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    expect(
      (await new AxeBuilder({ page }).include(".lookup-layout").analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "artifacts/quote-" + width + ".png",
      fullPage: true,
    });
  });
test("contact request is readable without offer acceptance", async ({
  page,
}) => {
  await page.route("https://commerce.qa.invalid/**", (r) =>
    r.fulfill({
      json: {
        ...quote(),
        kind: "contact",
        status: "submitted",
        total_minor: null,
        message: undefined,
      },
    }),
  );
  await open(page);
  await expect(
    page.getByText("This contact request is read only."),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});
