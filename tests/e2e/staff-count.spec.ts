import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const source = () => ({
  lot_id: "count_lot",
  component_id: "blank",
  unit: "piece",
  version: 2,
  test_mode: true,
  checkout_authoritative: false,
  locations: [
    {
      location_id: "shop",
      condition_units: {
        available: 10,
        damaged: 1,
        sample: 0,
        in_production: 0,
        completed: 0,
        shipped: 0,
      },
      reserved_units: 2,
      free_units: 8,
    },
  ],
});
const result = () => ({
  lot_id: "count_lot",
  component_id: "blank",
  unit: "piece",
  version: 2,
  observations: [
    {
      location_id: "shop",
      condition: "available",
      observed_units: 1,
      recorded_units: 10,
      variance_units: -9,
      protected_reserved_units: 2,
      reservation_floor_conflict: true,
    },
  ],
  scope: "explicit_buckets_only",
  applied: false,
  correction_authorized: false,
  test_mode: true,
  checkout_authoritative: false,
});
async function open(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Staff access code").fill("synthetic-staff");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByLabel("Count lot reference").waitFor();
  await page.getByLabel("Count lot reference").fill("count_lot");
  await page.getByLabel("Count location reference").fill("shop");
  await page.getByLabel("Observed test units").fill("1");
}
for (const width of [1440, 390])
  test(
    "count read-only desktop/mobile and accessibility " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const calls: string[] = [];
      await page.route("https://commerce.qa.invalid/**", async (route) => {
        const req = route.request();
        expect(req.headers().authorization).toBe("Bearer synthetic-staff");
        if (req.url().endsWith("/summary"))
          return route.fulfill({ json: { counts: {}, recent: [] } });
        calls.push(req.method() + " " + req.url());
        if (req.url().endsWith("/availability")) {
          expect(req.method()).toBe("GET");
          return route.fulfill({ json: source() });
        }
        expect(req.url()).toBe(
          "https://commerce.qa.invalid/v1/admin/retail-test/component-ledger/lots/count_lot/count-preview",
        );
        expect(req.method()).toBe("POST");
        expect(req.postDataJSON()).toEqual({
          expected_version: 2,
          observations: [
            { location_id: "shop", condition: "available", observed_units: 1 },
          ],
        });
        return route.fulfill({
          json: { ...result(), private: "DO_NOT_RENDER" },
        });
      });
      await open(page);
      const before = await page.evaluate(() => ({ ...localStorage }));
      await page
        .getByRole("button", { name: "Compare test count", exact: true })
        .click();
      const view = page.getByLabel("Verified test count comparison");
      await expect(view).toContainText("Recorded units10");
      await expect(view).toContainText("Observed units1");
      await expect(view).toContainText("below protected reservations");
      await expect(view).toContainText("No stock was changed");
      expect(calls.length).toBe(2);
      await expect(
        page.getByText("DO_NOT_RENDER", { exact: true }),
      ).toHaveCount(0);
      expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include('section[aria-labelledby="fixture-count-title"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await page
        .getByRole("button", { name: "Clear count comparison" })
        .click();
      await expect(view).toHaveCount(0);
      await expect(page.getByLabel("Observed test units")).toHaveValue("");
      await page.getByRole("button", { name: "Lock workspace" }).click();
      await expect(page.getByLabel("Count lot reference")).toHaveCount(0);
    },
  );
for (const phase of ["availability", "count-preview"])
  for (const action of ["clear", "lock"])
    test("count late " + phase + " after " + action, async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let started = false,
        posts = 0;
      await page.route("https://commerce.qa.invalid/**", async (route) => {
        const url = route.request().url();
        if (url.endsWith("/summary"))
          return route.fulfill({ json: { counts: {}, recent: [] } });
        if (url.endsWith("/count-preview")) posts++;
        if (url.endsWith("/" + phase)) {
          started = true;
          await gate;
        }
        return route.fulfill({
          json: url.endsWith("/availability") ? source() : result(),
        });
      });
      await open(page);
      await page
        .getByRole("button", { name: "Compare test count", exact: true })
        .click();
      await expect.poll(() => started).toBe(true);
      await page
        .getByRole("button", {
          name:
            action === "clear" ? "Clear count comparison" : "Lock workspace",
        })
        .click();
      release();
      await page.waitForLoadState("networkidle");
      await expect(
        page.getByLabel("Verified test count comparison"),
      ).toHaveCount(0);
      if (phase === "availability") expect(posts).toBe(0);
    });
test("count stale version is manual retry with no automatic correction", async ({
  page,
}) => {
  let posts = 0;
  await page.route("https://commerce.qa.invalid/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/summary"))
      return route.fulfill({ json: { counts: {}, recent: [] } });
    if (url.endsWith("/availability")) return route.fulfill({ json: source() });
    posts++;
    return route.fulfill({ status: 409, json: { detail: "PRIVATE" } });
  });
  await open(page);
  await page
    .getByRole("button", { name: "Compare test count", exact: true })
    .click();
  await expect(
    page
      .locator('section[aria-labelledby="fixture-count-title"]')
      .getByRole("alert"),
  ).toContainText("Compare again after reviewing");
  await expect(page.getByLabel("Verified test count comparison")).toHaveCount(
    0,
  );
  expect(posts).toBe(1);
  await expect(page.getByText("PRIVATE", { exact: true })).toHaveCount(0);
});
for (const width of [320, 1280])
  test(
    "multi-bucket keyboard comparison and row ownership " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const requests: any[] = [];
      await page.route("https://commerce.qa.invalid/**", async (route) => {
        const req = route.request();
        if (req.url().endsWith("/summary"))
          return route.fulfill({ json: { counts: {}, recent: [] } });
        requests.push({ method: req.method(), body: req.postDataJSON() });
        if (req.url().endsWith("/availability"))
          return route.fulfill({ json: source() });
        const body = req.postDataJSON();
        return route.fulfill({
          json: {
            ...result(),
            observations: body.observations.map((o: any) => ({
              ...o,
              recorded_units: o.condition === "available" ? 10 : 1,
              variance_units:
                o.observed_units - (o.condition === "available" ? 10 : 1),
              protected_reserved_units: o.condition === "available" ? 2 : 0,
              reservation_floor_conflict:
                o.condition === "available" && o.observed_units < 2,
            })),
          },
        });
      });
      await open(page);
      const before = await page.evaluate(() => ({ ...localStorage }));
      const add = page.getByRole("button", {
        name: "Add count bucket",
        exact: true,
      });
      await add.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByLabel("Count location reference 2", { exact: true }),
      ).toBeFocused();
      await page
        .getByLabel("Count location reference 2", { exact: true })
        .fill("shop");
      await page
        .getByRole("combobox", { name: "Count condition 2", exact: true })
        .selectOption("damaged");
      await page.getByLabel("Observed test units 2", { exact: true }).fill("3");
      await page
        .getByRole("button", { name: "Compare test count", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      const view = page.getByLabel("Verified test count comparison");
      await expect(view).toContainText("Observed units3");
      await expect(view).toContainText(
        "Difference (observed minus recorded)+2",
      );
      expect(requests.map((x) => x.method)).toEqual(["GET", "POST"]);
      expect(requests[1].body.observations).toEqual([
        { location_id: "shop", condition: "available", observed_units: 1 },
        { location_id: "shop", condition: "damaged", observed_units: 3 },
      ]);
      await page
        .getByRole("button", { name: "Remove count bucket 1", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByLabel("Count location reference", { exact: true }),
      ).toBeFocused();
      await expect(
        page.getByRole("combobox", { name: "Count condition", exact: true }),
      ).toHaveValue("damaged");
      await expect(view).toHaveCount(0);
      await add.click();
      await page
        .getByLabel("Count location reference 2", { exact: true })
        .fill(" shop ");
      await page
        .getByRole("combobox", { name: "Count condition 2", exact: true })
        .selectOption("damaged");
      await page.getByLabel("Observed test units 2", { exact: true }).fill("0");
      await page
        .getByRole("button", { name: "Compare test count", exact: true })
        .click();
      await expect(
        page.getByText(
          "Compare each location and condition only once. No comparison was requested.",
        ),
      ).toBeVisible();
      expect(requests).toHaveLength(2);
      expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.locator("#fixture-count-title").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "artifacts/count-multi-" + width + ".png",
        fullPage: true,
      });
      await page.reload();
      await expect(page.getByLabel("Staff access code")).toHaveValue("");
      await expect(page.getByLabel("Count lot reference")).toHaveCount(0);
    },
  );
test("multi-bucket UI enforces100 rows without requests", async ({ page }) => {
  test.setTimeout(60000);
  let requests = 0;
  await page.route("https://commerce.qa.invalid/**", (route) => {
    requests++;
    return route.fulfill({ json: { counts: {}, recent: [] } });
  });
  await open(page);
  await page.evaluate(async () => {
    for (let i = 1; i < 100; i++) {
      const button = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "Add count bucket",
      )!;
      button.click();
      await new Promise(requestAnimationFrame);
    }
  });
  await expect(
    page.getByRole("button", { name: "Add count bucket", exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator('section[aria-labelledby="fixture-count-title"] fieldset'),
  ).toHaveCount(100);
  expect(requests).toBe(1);
  await page
    .getByRole("button", { name: "Remove count bucket 100", exact: true })
    .click();
  await expect(
    page.getByLabel("Count location reference 99", { exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Add count bucket", exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(1);
});
