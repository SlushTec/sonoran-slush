import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const summary = { counts: {}, recent: [] };
const fixture = () => ({
  lot_id: "lot_test",
  component_id: "blank",
  unit: "piece",
  version: 2,
  locations: [
    {
      location_id: "shop",
      condition_units: {
        available: 10,
        damaged: 3,
        sample: 2,
        in_production: 4,
        completed: 5,
        shipped: 6,
      },
      reserved_units: 2,
      free_units: 8,
    },
  ],
  test_mode: true,
  checkout_authoritative: false,
});
async function open(page: Page) {
  await page.goto("/admin");
  await expect(page.getByLabel("Test lot reference")).toHaveCount(0);
  await page.getByLabel("Staff access code").fill("synthetic-staff");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByLabel("Test lot reference").waitFor();
}
async function read(page: Page, reference = "lot_test") {
  await page.getByLabel("Test lot reference").fill(reference);
  await page
    .getByRole("button", { name: "Read test availability", exact: true })
    .click();
}
for (const width of [1440, 390]) {
  test(
    "read-only fixture availability visual/accessibility " + width,
    async ({ page }, info) => {
      let reads = 0;
      await page.setViewportSize({ width, height: 900 });
      await page.route("https://commerce.qa.invalid/**", async (route) => {
        const request = route.request();
        expect(request.method()).toBe("GET");
        expect(new URL(request.url()).search).toBe("");
        expect(request.headers().authorization).toBe("Bearer synthetic-staff");
        if (request.url().endsWith("/summary"))
          return route.fulfill({ json: summary });
        reads++;
        expect(request.url()).toBe(
          "https://commerce.qa.invalid/v1/admin/retail-test/component-ledger/lots/lot_test/availability",
        );
        return route.fulfill({
          json: { ...fixture(), private: "DO_NOT_RENDER" },
        });
      });
      await open(page);
      const storageBefore = await page.evaluate(() => ({ ...localStorage }));
      expect(reads).toBe(0);
      await read(page);
      const result = page.getByLabel("Verified test lot readout");
      await expect(result).toContainText("Observed lot version 2");
      await expect(
        result.getByRole("heading", { name: "Location shop" }),
      ).toBeVisible();
      for (const [label, value] of [
        ["Available-condition physical", 10],
        ["Reserved (active)", 2],
        ["Free (unreserved)", 8],
        ["Damaged", 3],
        ["Sample", 2],
        ["In production", 4],
        ["Completed", 5],
        ["Shipped", 6],
      ] as const)
        await expect(
          result
            .locator("dl div")
            .filter({ has: page.getByText(label, { exact: true }) }),
        ).toHaveText(label + value);
      await expect(
        page.getByText("DO_NOT_RENDER", { exact: true }),
      ).toHaveCount(0);
      const storageAfter = await page.evaluate(() => ({ ...localStorage }));
      expect(storageAfter).toEqual(storageBefore);
      expect(JSON.stringify(storageAfter)).not.toContain("synthetic-staff");
      expect(JSON.stringify(storageAfter)).not.toContain("lot_test");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include('section[aria-labelledby="fixture-availability-title"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath("staff-availability-" + width + ".png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Lock workspace" }).click();
      await expect(result).toHaveCount(0);
      await expect(page.getByLabel("Staff access code")).toHaveValue("");
      expect(reads).toBe(1);
    },
  );
}
test("late fixture response cannot reopen a locked staff session", async ({
  page,
}) => {
  let release = () => {},
    started = () => {};
  const pending = new Promise<void>((r) => (release = r)),
    began = new Promise<void>((r) => (started = r));
  await page.route("https://commerce.qa.invalid/**", async (route) => {
    if (route.request().url().endsWith("/summary"))
      return route.fulfill({ json: summary });
    started();
    await pending;
    await route.fulfill({ json: fixture() });
  });
  await open(page);
  await read(page);
  await began;
  await page.getByRole("button", { name: "Lock workspace" }).click();
  release();
  await page.waitForTimeout(100);
  await expect(page.getByLabel("Verified test lot readout")).toHaveCount(0);
  await expect(page.getByLabel("Test lot reference")).toHaveCount(0);
  await expect(page.getByLabel("Staff access code")).toHaveValue("");
});
test("clear during pending fixture read and newer lookup defeat old responses", async ({
  page,
}) => {
  let release = () => {},
    started = () => {};
  const pending = new Promise<void>((r) => (release = r)),
    began = new Promise<void>((r) => (started = r));
  let original = true;
  await page.route("https://commerce.qa.invalid/**", async (route) => {
    if (route.request().url().endsWith("/summary"))
      return route.fulfill({ json: summary });
    if (original) {
      original = false;
      started();
      await pending;
      return route.fulfill({ json: fixture() });
    }
    return route.fulfill({ json: { ...fixture(), lot_id: "other" } });
  });
  await open(page);
  await read(page);
  await began;
  await page.getByRole("button", { name: "Clear inventory view" }).click();
  await read(page, "other");
  await expect(page.getByLabel("Verified test lot readout")).toContainText(
    "Test lot other",
  );
  release();
  await page.waitForTimeout(100);
  await expect(page.getByLabel("Verified test lot readout")).toContainText(
    "Test lot other",
  );
  await expect(page.getByLabel("Verified test lot readout")).not.toContainText(
    "Test lot lot_test",
  );
});
test("conflict clears old fixture data and never echoes raw errors", async ({
  page,
}) => {
  let reads = 0;
  await page.route("https://commerce.qa.invalid/**", (route) => {
    if (route.request().url().endsWith("/summary"))
      return route.fulfill({ json: summary });
    return ++reads === 1
      ? route.fulfill({ json: fixture() })
      : route.fulfill({ status: 409, json: { detail: "PRIVATE RAW ERROR" } });
  });
  await open(page);
  await read(page);
  await expect(page.getByLabel("Verified test lot readout")).toBeVisible();
  await page
    .getByRole("button", { name: "Read test availability", exact: true })
    .click();
  await expect(page.locator(".form-error[role=alert]")).toHaveText(
    "Test availability needs reconciliation. No quantities can be shown safely.",
  );
  await expect(page.getByLabel("Verified test lot readout")).toHaveCount(0);
  await expect(page.getByText("PRIVATE RAW ERROR")).toHaveCount(0);
});
test("numeric scope and wrong arithmetic are not presented as inventory", async ({
  page,
}) => {
  let reads = 0;
  await page.route("https://commerce.qa.invalid/**", (route) => {
    if (route.request().url().endsWith("/summary"))
      return route.fulfill({ json: summary });
    const invalid = fixture();
    if (++reads === 1) invalid.locations[0].free_units = 9;
    else Object.assign(invalid, { test_mode: 1 });
    return route.fulfill({ json: invalid });
  });
  await open(page);
  await read(page);
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "could not be verified",
  );
  await expect(page.getByLabel("Verified test lot readout")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Read test availability", exact: true })
    .click();
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "could not be verified",
  );
  await expect(page.getByLabel("Verified test lot readout")).toHaveCount(0);
});
