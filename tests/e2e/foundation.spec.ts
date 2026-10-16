import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import catalog from "../../packages/contracts/catalog.reference.json";
const routes = [
  "/",
  "/shop",
  "/custom-orders",
  "/events",
  "/our-work",
  "/help",
  "/about",
  "/cart",
  "/checkout",
  "/account",
  "/orders",
  "/proofs",
  "/admin",
  "/privacy",
  "/terms",
  "/help/photo-guide",
  "/help/shipping",
  "/help/returns",
  "/gift-finder",
  "/saved",
  "/quotes",
  "/contact",
  "/accessibility",
];
for (const path of routes)
  test("route and accessibility: " + path, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText("Private storefront review", { exact: false }),
    ).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
test("all category and product routes resolve; archive is never public", async ({
  request,
}) => {
  for (const c of catalog.categories)
    expect((await request.get("/shop/" + c.slug)).status()).toBe(200);
  for (const p of catalog.products)
    expect((await request.get("/products/" + p.slug)).status()).toBe(200);
  expect((await request.get("/products/not-a-product")).status()).toBe(404);
  expect(
    (
      await request.get("/archive/2026-10-14-pre-native/snapshot/README.md")
    ).status(),
  ).toBe(404);
});
test("search, no matches, and recovery", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("searchbox").fill("decanter");
  await expect(
    page.getByText("2 thoughtful gifts", { exact: false }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("no such thing");
  await expect(
    page.getByRole("heading", { name: "No gifts found, just yet." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByText("29 thoughtful gifts", { exact: false }),
  ).toBeVisible();
});
test("mobile navigation opens, closes with Escape, and follows a route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const open = page.getByRole("button", { name: "Open navigation" });
  await open.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(open).toBeFocused();
  await open.click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Live events" })
    .click();
  await expect(page).toHaveURL(/events\/?$/);
});
test("personalized bag persists across refresh and keeps checkout a request", async ({
  page,
}) => {
  await page.goto("/products/makertwist-40oz-tumbler");
  await page.getByRole("button", { name: "Add your personal touch" }).click();
  await page
    .getByLabel("Name, initials, or message", { exact: false })
    .fill("A memory to keep");
  await page
    .getByRole("button", { name: "Finishing touches", exact: false })
    .click();
  await page.getByRole("button", { name: "Add design to bag" }).click();
  await page.goto("/cart");
  await expect(page.getByText("“A memory to keep”")).toBeVisible();
  await page.reload();
  await expect(page.getByText("“A memory to keep”")).toBeVisible();
  await page.getByRole("link", { name: "Review your request" }).click();
  await expect(
    page.getByRole("button", { name: "Request reviewed pricing" }),
  ).toBeVisible();
  await expect(
    page.getByText("No payment is collected here.", { exact: false }),
  ).toBeVisible();
});
for (const width of [320, 390, 768, 1440])
  test("responsive overflow check at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/shop",
      "/products/makertwist-40oz-tumbler",
      "/events",
      "/checkout",
      "/gift-finder",
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
test("production readiness remains closed", async ({ page, request }) => {
  await page.goto("/products/photo-crystal-collection");
  await expect(page.getByLabel("Crystal shape")).toBeVisible();
  expect((await request.get("/api/ready")).status()).toBe(503);
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /",
  );
  expect((await request.get("/")).headers()["x-robots-tag"]).toBe(
    "noindex, nofollow",
  );
});
