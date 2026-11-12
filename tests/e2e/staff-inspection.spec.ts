import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const pending = () => ({
  id: "intake_test",
  lot_id: "lot_test",
  location_id: "shop",
  quantity: 10,
  state: "pending",
  accepted_units: 0,
  rejected_units: 0,
  defect: "none",
  received_at: "2026-11-12T21:00:00Z",
  inspected_at: null,
  inspection_request_id: null,
  lot_version: 1,
  actor: "synthetic_staff",
  actor_scope: "shared staff test credential; not individual identity",
  test_mode: true,
  checkout_authoritative: false,
});
const inspected = () => ({
  ...pending(),
  state: "inspected",
  accepted_units: 8,
  rejected_units: 2,
  defect: "chipped",
  inspected_at: "2026-11-12T22:00:00Z",
  inspection_request_id: "11111111-1111-4111-8111-111111111111",
  lot_version: 2,
});
async function open(page: Page) {
  await page.goto("/admin");
  await expect(page.getByLabel("Test intake reference")).toHaveCount(0);
  await page.getByLabel("Staff access code").fill("synthetic-staff");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByLabel("Test intake reference").waitFor();
}
async function read(page: Page) {
  await page.getByLabel("Test intake reference").fill("intake_test");
  await page
    .getByRole("button", { name: "Read test intake", exact: true })
    .click();
}
for (const width of [1440, 390])
  test(
    "synthetic inspection desktop/mobile access and accessibility " + width,
    async ({ page }, info) => {
      let reads = 0;
      let value: any = pending();
      await page.setViewportSize({ width, height: 900 });
      await page.route("https://commerce.qa.invalid/**", async (route) => {
        const req = route.request();
        expect(req.method()).toBe("GET");
        expect(req.headers().authorization).toBe("Bearer synthetic-staff");
        if (req.url().endsWith("/summary"))
          return route.fulfill({ json: { counts: {}, recent: [] } });
        expect(req.url()).toBe(
          "https://commerce.qa.invalid/v1/admin/retail-test/component-ledger/intakes/intake_test",
        );
        reads++;
        return route.fulfill({ json: { ...value, private: "DO_NOT_RENDER" } });
      });
      await open(page);
      expect(reads).toBe(0);
      const before = await page.evaluate(() => ({ ...localStorage }));
      await read(page);
      const result = page.getByLabel("Verified test intake readout");
      await expect(result).toContainText("all intake units remain quarantined");
      value = inspected();
      await page
        .getByRole("button", { name: "Read test intake", exact: true })
        .click();
      await expect(result).toContainText("Accepted at inspection8");
      await expect(result).toContainText("Rejected at inspection2");
      await expect(result).toContainText("not current free stock");
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
            .include('section[aria-labelledby="fixture-inspection-title"]')
            .analyze()
        ).violations,
      ).toEqual([]);
      await page
        .getByRole("heading", { name: "Test incoming inspection" })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath("inspection-" + width + ".png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Clear inspection view" }).click();
      await expect(result).toHaveCount(0);
      value = { ...pending(), lot_version: 9007199254740992 };
      await read(page);
      await expect(
        page.locator(
          'section[aria-labelledby="fixture-inspection-title"] [role="alert"]',
        ),
      ).toContainText("could not be verified");
      await expect(result).toHaveCount(0);
      await page.getByRole("button", { name: "Lock workspace" }).click();
      await expect(page.getByLabel("Test intake reference")).toHaveCount(0);
      await expect(page.getByLabel("Staff access code")).toHaveValue("");
    },
  );
for (const action of ["clear", "lock"])
  test("late inspection cannot undo " + action, async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let started = false;
    await page.route("https://commerce.qa.invalid/**", async (route) => {
      if (route.request().url().endsWith("/summary"))
        return route.fulfill({ json: { counts: {}, recent: [] } });
      started = true;
      await gate;
      return route.fulfill({ json: inspected() });
    });
    await open(page);
    await read(page);
    await expect.poll(() => started).toBe(true);
    await page
      .getByRole("button", {
        name: action === "clear" ? "Clear inspection view" : "Lock workspace",
      })
      .click();
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/intake_test"),
    );
    release();
    await response;
    await expect(page.getByLabel("Verified test intake readout")).toHaveCount(
      0,
    );
    await expect(
      page.locator(
        'section[aria-labelledby="fixture-inspection-title"] [role="alert"]',
      ),
    ).toHaveCount(0);
  });
