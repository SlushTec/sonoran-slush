import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const fixture = () => ({
  id: "ord_browser",
  kind: "order",
  version: 2,
  status: "awaiting_payment",
  payment_status: "unpaid",
  proof_status: "awaiting_proof",
  total_minor: 1234,
  currency: "USD",
  test_payment_available: true,
  items: [{ product_slug: "synthetic-crystal", quantity: 1 }],
  timeline: [{ label: "Order prepared", at: "2026-11-11T12:00:00Z" }],
});
async function open(page: Page) {
  await page.goto("/orders");
  await page.getByLabel("Order reference").fill("ord_browser");
  await page.getByLabel("Private access code").fill("synthetic-code");
  await page.getByRole("button", { name: "Open securely" }).click();
  await expect(
    page.getByRole("heading", { name: "Current order" }),
  ).toBeVisible();
}
test("Square sandbox exact endpoint contract and navigation intercepted before network", async ({
  page,
}) => {
  let navigations = 0,
    posts = 0;
  await page.route("https://sandbox.square.link/**", async (route) => {
    navigations++;
    await route.fulfill({
      body: "Offline sandbox navigation fixture",
      contentType: "text/plain",
    });
  });
  await page.route("https://commerce.qa.invalid/**", async (route) => {
    const req = route.request();
    expect(req.headers().authorization).toBe("Bearer synthetic-code");
    if (req.url().endsWith("/sessions")) {
      posts++;
      expect(req.postDataJSON()).toEqual({
        order_id: "ord_browser",
        version: 2,
      });
      await route.fulfill({
        json: {
          url: "https://sandbox.square.link/u/offline",
          provider: "square",
          test_mode: true,
          session_id: "fixture-link",
        },
      });
    } else await route.fulfill({ json: fixture() });
  });
  await open(page);
  await page
    .getByRole("button", { name: "Open Square sandbox checkout" })
    .click();
  await expect(page).toHaveURL("https://sandbox.square.link/u/offline");
  expect(posts).toBe(1);
  expect(navigations).toBe(1);
});
test("late checkout response after Close cannot navigate", async ({ page }) => {
  let release: () => void = () => {};
  let entered: () => void = () => {};
  const began = new Promise<void>((r) => (entered = r));
  const pending = new Promise<void>((r) => (release = r));
  let nav = 0;
  await page.route("https://sandbox.square.link/**", async (r) => {
    nav++;
    await r.abort();
  });
  await page.route("https://commerce.qa.invalid/**", async (r) => {
    if (r.request().url().endsWith("/sessions")) {
      entered();
      await pending;
      await r.fulfill({
        json: {
          url: "https://sandbox.square.link/u/offline",
          provider: "square",
          test_mode: true,
          session_id: "fixture",
        },
      });
    } else await r.fulfill({ json: fixture() });
  });
  await open(page);
  await page
    .getByRole("button", { name: "Open Square sandbox checkout" })
    .click();
  await began;
  await page.getByRole("button", { name: "Close private record" }).click();
  release();
  await page.waitForTimeout(100);
  expect(nav).toBe(0);
  await expect(
    page.getByRole("heading", { name: "Current order" }),
  ).toHaveCount(0);
});
for (const width of [1440, 390])
  test("order sandbox layout and accessibility " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://commerce.qa.invalid/**", (r) =>
      r.fulfill({ json: fixture() }),
    );
    await open(page);
    await expect(
      page.getByRole("button", { name: "Open Square sandbox checkout" }),
    ).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(result.violations).toEqual([]);
    expect((await new AxeBuilder({page}).include(".lookup-layout").analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Open Square sandbox checkout" })
      .focus();
    await expect(
      page.getByRole("button", { name: "Open Square sandbox checkout" }),
    ).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "artifacts/order-" + width + ".png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Close private record" }).click();
    await expect(page.getByLabel("Private access code")).toHaveValue("");
  });
test("malformed provider and conflicts stay in private portal, explicit retry", async ({
  page,
}) => {
  let count = 0;
  await page.route("https://commerce.qa.invalid/**", async (r) => {
    if (r.request().url().endsWith("/sessions")) {
      count++;
      await r.fulfill(
        count === 1
          ? {
              json: {
                url: "https://checkout.stripe.com/a",
                provider: "square",
                test_mode: true,
                session_id: "x",
              },
            }
          : { status: 409, json: { detail: "changed" } },
      );
    } else await r.fulfill({ json: fixture() });
  });
  await open(page);
  await page
    .getByRole("button", { name: "Open Square sandbox checkout" })
    .click();
  await expect(page.locator(".form-error[role=alert]")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Square sandbox checkout" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Open securely" }).click();
  await page
    .getByRole("button", { name: "Open Square sandbox checkout" })
    .click();
  await expect(page.locator(".form-error[role=alert]")).toBeVisible();
  expect(count).toBe(2);
});
