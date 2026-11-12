import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const record = () => ({
  id: "ord_history_fixture",
  kind: "order",
  version: 1,
  status: "awaiting_payment",
  payment_status: "unpaid",
  proof_status: "awaiting_proof",
  items: [],
  timeline: Array.from({ length: 51 }, (_, i) => ({
    label: "Recorded José 🌵 " + i,
    at: "2030-01-01T12:34:56.123456+00:00",
  })),
});
async function login(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Staff access code").fill("synthetic-staff");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByLabel("Record reference").fill("ord_history_fixture");
  await page.getByRole("button", { name: "Open record", exact: true }).click();
}
test("staff history mobile keyboard pagination and private dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://commerce.qa.invalid/**", (r) =>
    r.fulfill({
      json: r.request().url().endsWith("/summary")
        ? { counts: {}, recent: [] }
        : record(),
    }),
  );
  await login(page);
  const region = page.getByRole("region", { name: "Recorded history" });
  await expect(region.getByRole("listitem")).toHaveCount(25);
  await region.getByRole("button", { name: "Next history page" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    region.getByText("Recorded José 🌵 25", { exact: true }),
  ).toBeVisible();
  await region.getByRole("button", { name: "Next history page" }).click();
  await expect(region.getByRole("listitem")).toHaveCount(1);
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-label="Recorded history"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/staff-history-mobile-browser.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lock workspace" }).click();
  await expect(region).toHaveCount(0);
});
test("invalid calendar history reconciles without partial labels", async ({
  page,
}) => {
  const value = record();
  value.timeline[1].at = "2030-02-30T00:00:00Z";
  await page.route("https://commerce.qa.invalid/**", (r) =>
    r.fulfill({
      json: r.request().url().endsWith("/summary")
        ? { counts: {}, recent: [] }
        : value,
    }),
  );
  await login(page);
  const region = page.getByRole("region", { name: "Recorded history" });
  await expect(region.getByRole("alert")).toContainText(
    "could not be verified",
  );
  await expect(
    region.getByText("Recorded José 🌵 0", { exact: true }),
  ).toHaveCount(0);
});
test("delayed history does not restore locked session", async ({ page }) => {
  let release = () => {},
    started = () => {};
  const pending = new Promise<void>((r) => (release = r)),
    began = new Promise<void>((r) => (started = r));
  await page.route("https://commerce.qa.invalid/**", async (r) => {
    if (r.request().url().endsWith("/summary"))
      return r.fulfill({ json: { counts: {}, recent: [] } });
    started();
    await pending;
    await r.fulfill({ json: record() });
  });
  await login(page);
  await began;
  await page.getByRole("button", { name: "Lock workspace" }).click();
  release();
  await page.waitForTimeout(100);
  await expect(
    page.getByRole("region", { name: "Recorded history" }),
  ).toHaveCount(0);
});
