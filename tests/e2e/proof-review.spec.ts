import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const time = "2026-11-11T12:00:00+00:00",
  hash = "a".repeat(64);
function fixture() {
  return {
    id: "prf_browser",
    kind: "proof",
    order_id: "ord_browser",
    version: 2,
    status: "awaiting_approval",
    approved_version: null as number | null,
    proof_text: "A memory to keep, exactly as written.",
    binding_schema: 1,
    context_hash: hash,
  };
}
function detail(p = fixture(), version = 2) {
  return {
    revision: {
      schema_version: 1,
      proof_id: p.id,
      order_id: p.order_id,
      version,
      proof_text: version === 2 ? p.proof_text : "Earlier inscription",
      context_hash: hash,
      prepared_at: time,
      limitations:
        "Local text/configuration evidence only; no image/export, physical, identity or machine qualification.",
    },
    material_context: {
      order_id: p.order_id,
      items: [
        {
          product_slug: "synthetic-crystal",
          quantity: 1,
          text: "A memory to keep",
        },
      ],
      lines: null,
      total_minor: 1000,
      currency: "USD",
    },
    decisions:
      p.status === "approved"
        ? [
            {
              schema_version: 1,
              proof_id: p.id,
              order_id: p.order_id,
              version,
              context_hash: hash,
              sequence: 1,
              action: "approve",
              comment: "",
              recorded_at: time,
              actor_scope: "holder of this private proof capability",
            },
          ]
        : [],
  };
}
async function open(page: Page) {
  await page.goto("/proofs");
  await page.getByLabel("Proof reference").fill("prf_browser");
  await page.getByLabel("Private access code").fill("synthetic-browser-code");
  await page.getByRole("button", { name: "Open securely" }).click();
}
test("bound current proof, historical separation, exact action and private close", async ({
  page,
}) => {
  let p = fixture(),
    mutations = 0,
    requests = 0;
  await page.route("https://commerce.qa.invalid/**", async (route) => {
    requests++;
    expect(route.request().headers().authorization).toBe(
      "Bearer synthetic-browser-code",
    );
    const url = route.request().url();
    let data: any = p;
    if (url.endsWith("/approve")) {
      mutations++;
      expect(route.request().postDataJSON()).toEqual({
        version: 2,
        decision: "approve",
        comment: "",
      });
      p = { ...p, status: "approved", approved_version: p.version };
      data = p;
    } else if (url.includes("/history?"))
      data = {
        proof_id: p.id,
        items: [
          { version: 1, context_hash: hash, prepared_at: time },
          { version: 2, context_hash: hash, prepared_at: time },
        ],
        next_cursor: null,
        legacy_history_unknown: false,
      };
    else if (url.endsWith("/history/1")) data = detail(p, 1);
    else if (url.endsWith("/history/2")) data = detail(p);
    await route.fulfill({ json: data });
  });
  await open(page);
  await expect(
    page.getByRole("button", { name: "Approve version 2" }),
  ).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Past versions" }).click();
  await page.getByRole("button", { name: "View version 1" }).click();
  await expect(
    page.getByText("Earlier inscription", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Return to current proof" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve version 2" }).click();
  await expect(page.locator(".form-success[role=status]")).toContainText(
    "approval",
  );
  expect(mutations).toBe(1);
  await expect(page.getByText("synthetic-browser-code")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "synthetic-browser-code",
  );
  await page.getByRole("button", { name: "Close private record" }).click();
  await expect(page.getByLabel("Private access code")).toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Current proof" }),
  ).toHaveCount(0);
});
test("late lookup after Close and navigation Back never restores private record", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((r) => (release = r));
  await page.route("https://commerce.qa.invalid/**", async (route) => {
    await pending;
    await route.fulfill({ json: fixture() });
  });
  await open(page);
  await page.getByRole("button", { name: "Close private record" }).click();
  release();
  await page.waitForTimeout(100);
  await expect(
    page.getByRole("heading", { name: "Current proof" }),
  ).toHaveCount(0);
  await page.goto("/help");
  await page.goBack();
  await expect(page.getByLabel("Private access code")).toHaveValue("");
});
for (const mobile of [false, true])
  test(
    "proof review accessible keyboard and bounded layout " +
      (mobile ? "mobile" : "desktop"),
    async ({ page }) => {
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      );
      await page.route("https://commerce.qa.invalid/**", (route) =>
        route.fulfill({
          json: route.request().url().endsWith("/history/2")
            ? detail()
            : fixture(),
        }),
      );
      await open(page);
      await expect(page.getByRole("checkbox")).toBeVisible();
      await page.getByRole("checkbox").focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("checkbox")).toBeChecked();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: "artifacts/proof-" + (mobile ? "mobile" : "desktop") + ".png",
        fullPage: true,
      });
    },
  );
test("legacy record cannot approve and evidence errors can retry", async ({
  page,
}) => {
  let legacy = true,
    fail = true;
  await page.route("https://commerce.qa.invalid/**", async (route) => {
    const p: any = fixture();
    if (legacy) {
      delete p.binding_schema;
      delete p.context_hash;
    }
    if (route.request().url().endsWith("/history/2")) {
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 409,
          json: { detail: "Evidence needs reconciliation" },
        });
      }
      return route.fulfill({ json: detail() });
    }
    return route.fulfill({ json: p });
  });
  await open(page);
  await expect(page.getByText(/retained legacy proof/)).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  legacy = false;
  await page.getByRole("button", { name: "Refresh current proof" }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "reconciliation",
  );
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh current proof" }).click();
  await expect(page.getByRole("checkbox")).toBeVisible();
});
test("tracked preview brand assets return exact content and images load", async ({
  page,
  request,
}) => {
  const fs = await import("node:fs"),
    path = await import("node:path"),
    crypto = await import("node:crypto");
  for (const name of [
    "sonoran-slush-southwest.svg",
    "sonoran-slush-southwest-light.svg",
  ]) {
    const response = await request.get("/brand/" + name);
    expect(response.status()).toBe(200);
    const expected = fs.readFileSync(
      path.join(process.cwd(), "apps/storefront/public/brand", name),
    );
    expect(
      crypto
        .createHash("sha256")
        .update(await response.body())
        .digest("hex"),
    ).toBe(crypto.createHash("sha256").update(expected).digest("hex"));
  }
  await page.goto("/proofs");
  for (const image of await page.locator('img[src^="/brand/"]:visible').all())
    expect(
      await image.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    ).toBeTruthy();
});
