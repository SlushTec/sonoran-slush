import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
function order() {
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    set_index: i,
    piece_index: 0,
    text: "Synthetic José 🌵 " + i,
  }));
  const item = {
    product_slug: "makertwist-40oz-tumbler",
    quantity: 30,
    text: "",
    secondary: "",
    font: "Classic serif",
    options: {},
    personalization: { mode: "per_piece", pieces: [...pieces].reverse() },
  };
  return {
    id: "ord_browser_pieces",
    kind: "order",
    status: "awaiting_payment",
    version: 1,
    payment_status: "unpaid",
    proof_status: "awaiting_proof",
    items: [item],
    lines: [
      {
        item,
        stock_units: 210,
        personalization_snapshot: {
          schema_version: 1,
          mode: "per_piece",
          line_index: 0,
          quantity: 30,
          pieces_per_item: 1,
          pieces,
        },
      },
    ],
  };
}
async function login(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Staff access code").fill("synthetic-staff");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByLabel("Record reference").fill("ord_browser_pieces");
  await page.getByRole("button", { name: "Open record", exact: true }).click();
}
test("staff recorded pieces support mobile keyboard pagination, axe and Lock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://commerce.qa.invalid/**", (r) =>
    r.fulfill({
      json: r.request().url().endsWith("/summary")
        ? { counts: {}, recent: [] }
        : order(),
    }),
  );
  await login(page);
  const region = page.getByRole("region", { name: "Recorded personalization" });
  await expect(region.getByRole("listitem")).toHaveCount(25);
  await region.getByRole("button", { name: "Next piece page" }).focus();
  await page.keyboard.press("Enter");
  await expect(region.getByRole("listitem")).toHaveCount(5);
  await expect(
    region.getByText("Synthetic José 🌵 29", { exact: true }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include('section[aria-label="Recorded personalization"]')
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/staff-pieces-mobile-browser.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lock workspace" }).click();
  await expect(region).toHaveCount(0);
});
test("invalid staff mapping shows reconciliation rather than partial assignment", async ({
  page,
}) => {
  const value = order();
  value.lines[0].personalization_snapshot.line_index = 99;
  await page.route("https://commerce.qa.invalid/**", (r) =>
    r.fulfill({
      json: r.request().url().endsWith("/summary")
        ? { counts: {}, recent: [] }
        : value,
    }),
  );
  await login(page);
  await expect(
    page
      .getByRole("region", { name: "Recorded personalization" })
      .getByRole("alert"),
  ).toContainText("could not be verified");
  await expect(
    page.getByText("Synthetic José 🌵 0", { exact: true }),
  ).toHaveCount(0);
});
test("late mapped record cannot reopen locked staff session", async ({
  page,
}) => {
  let release: () => void = () => {},
    started: () => void = () => {};
  const pending = new Promise<void>((r) => (release = r)),
    began = new Promise<void>((r) => (started = r));
  await page.route("https://commerce.qa.invalid/**", async (r) => {
    if (r.request().url().endsWith("/summary"))
      return r.fulfill({ json: { counts: {}, recent: [] } });
    started();
    await pending;
    await r.fulfill({ json: order() });
  });
  await login(page);
  await began;
  await page.getByRole("button", { name: "Lock workspace" }).click();
  release();
  await page.waitForTimeout(100);
  await expect(
    page.getByRole("region", { name: "Recorded personalization" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Staff access code")).toHaveValue("");
});
