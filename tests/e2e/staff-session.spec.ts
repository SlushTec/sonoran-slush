import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const summary = { counts: { submitted: 1 }, recent: [] };
const quote = () => ({
  id: "quo_browser",
  kind: "retail",
  status: "offered",
  version: 2,
  total_minor: 1234,
  message: "Synthetic reviewed terms",
  items: [],
});
async function open(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Staff access code").fill("synthetic-staff");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByLabel("Record reference").fill("quo_browser");
  await page.getByRole("button", { name: "Open record", exact: true }).click();
  await page
    .getByRole("button", { name: "Offer a new quote version" })
    .waitFor();
}
test("Lock pending write stays locked and old summary is never requested", async ({
  page,
}) => {
  let release: () => void = () => {},
    entered: () => void = () => {};
  const pending = new Promise<void>((r) => (release = r)),
    began = new Promise<void>((r) => (entered = r));
  let summaries = 0;
  await page.route("https://commerce.qa.invalid/**", async (r) => {
    const url = r.request().url();
    if (url.endsWith("/summary")) {
      summaries++;
      await r.fulfill({ json: summary });
    } else if (url.endsWith("/offer")) {
      entered();
      await pending;
      await r.fulfill({ json: { ...quote(), version: 3 } });
    } else await r.fulfill({ json: quote() });
  });
  await open(page);
  await page.getByRole("button", { name: "Offer a new quote version" }).click();
  await began;
  await page.getByRole("button", { name: "Lock workspace" }).click();
  release();
  await page.waitForTimeout(100);
  await expect(page.getByLabel("Staff access code")).toHaveValue("");
  await expect(page.getByLabel("Record reference")).toHaveCount(0);
  expect(summaries).toBe(1);
});
test("write confirmed but overview failure does not invite repeating mutation", async ({
  page,
}) => {
  let summaries = 0;
  await page.route("https://commerce.qa.invalid/**", (r) => {
    const url = r.request().url();
    if (url.endsWith("/summary"))
      return r.fulfill(
        ++summaries === 1
          ? { json: summary }
          : { status: 503, json: { detail: "refresh unavailable" } },
      );
    return r.fulfill({
      json: url.endsWith("/offer") ? { ...quote(), version: 3 } : quote(),
    });
  });
  await open(page);
  await page.getByRole("button", { name: "Offer a new quote version" }).click();
  await expect(page.locator(".form-success[role=status]")).toContainText(
    "confirmed this action",
  );
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "Do not repeat",
  );
});
for (const width of [1440, 390])
  test("staff session visual and accessibility " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://commerce.qa.invalid/**", (r) =>
      r.fulfill({
        json: r.request().url().endsWith("/summary") ? summary : quote(),
      }),
    );
    await open(page);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    expect(
      (await new AxeBuilder({ page }).include("main").analyze()).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "artifacts/staff-" + width + ".png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Lock workspace" }).click();
    await expect(page.getByLabel("Staff access code")).toHaveValue("");
  });
