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
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    expect(
      (await new AxeBuilder({ page }).include(".lookup-layout").analyze())
        .violations,
    ).toEqual([]);
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
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
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

test("private summary download contains only refreshed allowlisted data on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const order = {
    ...fixture(),
    next_step: "Café 🌼\u2028Payment status: paid",
    access_token: "DO-NOT-SAVE",
    staff_notes: "PRIVATE-COST",
  };
  await page.route("https://commerce.qa.invalid/**", (r) =>
    r.fulfill({ json: order }),
  );
  await open(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download order summary" }).focus();
  await page.keyboard.press("Enter");
  const download = await downloadPromise,
    stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString("utf8");
  expect(download.suggestedFilename()).toBe("sonoran-order-ord_browser.txt");
  expect(body).toContain("Payment status: unpaid");
  expect(body).toContain("Café 🌼\\u{2028}");
  expect(body).not.toContain("DO-NOT-SAVE");
  expect(body).not.toContain("PRIVATE-COST");
  expect(body).not.toContain("synthetic-code");
  expect(
    body.split("\n").filter((x) => x.startsWith("Payment status:")),
  ).toHaveLength(1);
  const results = await new AxeBuilder({ page })
    .include(".lookup-layout")
    .analyze();
  expect(results.violations).toEqual([]);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: "artifacts/order-summary-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("same-version payment change requires reviewed second summary click", async ({
  page,
}) => {
  let reads = 0,
    downloads = 0;
  page.on("download", () => downloads++);
  await page.route("https://commerce.qa.invalid/**", (r) =>
    r.fulfill({
      json: { ...fixture(), payment_status: ++reads === 1 ? "unpaid" : "paid" },
    }),
  );
  await open(page);
  await page.getByRole("button", { name: "Download order summary" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "The order changed" }),
  ).toContainText("The order changed");
  expect(downloads).toBe(0);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download order summary" }).click();
  await pending;
  expect(downloads).toBe(1);
});
test("summary refresh completing after Close cannot start download", async ({
  page,
}) => {
  let reads = 0,
    release: () => void = () => {},
    entered: () => void = () => {},
    downloads = 0;
  const pending = new Promise<void>((r) => (release = r)),
    began = new Promise<void>((r) => (entered = r));
  page.on("download", () => downloads++);
  await page.route("https://commerce.qa.invalid/**", async (r) => {
    if (++reads > 1) {
      entered();
      await pending;
    }
    await r.fulfill({ json: fixture() });
  });
  await open(page);
  await page.getByRole("button", { name: "Download order summary" }).click();
  await began;
  await page.getByRole("button", { name: "Close private record" }).click();
  release();
  await expect(
    page.getByRole("heading", { name: "Current order" }),
  ).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(downloads).toBe(0);
});

function personalizedFixture() {
  const o = fixture();
  const pieces=Array.from({length:30},(_,n)=>({set_index:Math.floor(n/2),piece_index:n%2,text:"Customer "+n+" \u{1f41f}"}));
  const item={product_slug:"synthetic-crystal",quantity:15,font:"Modern sans",
    personalization:{mode:"per_piece",pieces:[...pieces].reverse()}};
  return {...o,items:[item],lines:[{item:structuredClone(item),stock_units:105,
    personalization_snapshot:{schema_version:1,line_index:0,quantity:15,pieces_per_item:2,mode:"per_piece",pieces}}]};
}
test("customer recorded assignments paginate privately with mobile accessibility",async({page})=>{
  const o=personalizedFixture();
  await page.route("https://commerce.qa.invalid/**",r=>r.fulfill({json:o}));
  await open(page);
  const region=page.getByRole("region",{name:"Your recorded inscriptions"});
  await expect(region.getByRole("listitem")).toHaveCount(25);
  await page.setViewportSize({width:390,height:844});
  await region.getByRole("button",{name:"Next inscription page"}).focus();
  await page.keyboard.press("Enter");
  await expect(region.getByText("Inscription page 2 of 2")).toBeVisible();
  await expect(region.getByRole("listitem")).toHaveCount(5);
  await expect(region.getByText("Customer 29 \u{1f41f}",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('section[aria-label="Your recorded inscriptions"]').analyze()).violations).toEqual([]);
  await page.getByRole("button",{name:"Close private record"}).click();
  await expect(region).toHaveCount(0);
});
test("same-version customer inscription change requires renewed review before download",async({page})=>{
  let o=personalizedFixture(),downloads=0;
  await page.route("https://commerce.qa.invalid/**",r=>r.fulfill({json:o}));
  page.on("download",()=>downloads++);
  await open(page);
  o=structuredClone(o);o.items[0].font="Handwritten";o.lines[0].item.font="Handwritten";
  await page.getByRole("button",{name:"Download order summary"}).click();
  await expect(page.getByText(/The order changed/)).toBeVisible();
  expect(downloads).toBe(0);
  const waiting=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download order summary"}).click();
  const file=await waiting;
  const stream=await file.createReadStream();let text="";
  for await(const chunk of stream!) text+=chunk.toString("utf8");
  expect(text).toContain('Font: "Handwritten"');
  expect(text).toContain('Customer 29');
  expect(text).not.toContain("synthetic-code");
  expect(downloads).toBe(1);
});
test("malformed canonical customer snapshot fails closed without showing inscription",async({page})=>{
  const o=personalizedFixture();o.lines[0].personalization_snapshot.line_index=9;
  await page.route("https://commerce.qa.invalid/**",r=>r.fulfill({json:o}));
  await page.goto("/orders");await page.getByLabel("Order reference").fill("ord_browser");
  await page.getByLabel("Private access code").fill("synthetic-code");
  await page.getByRole("button",{name:"Open securely"}).click();
  await expect(page.getByRole("alert").filter({hasText:"This order could not be verified. Check your reference and private access code, then retry."})).toBeVisible();
  await expect(page.getByRole("region",{name:"Your recorded inscriptions"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Download order summary"})).toHaveCount(0);
});
