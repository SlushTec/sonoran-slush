import { test, expect } from "@playwright/test";

for (const width of [1280, 390]) {
  test("shopping bag quantity label matches badge at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      if (!localStorage.getItem("sonoran:cart")) {
        const base = {slug:"makertwist-40oz-tumbler",text:"Synthetic",secondary:"",font:"Classic serif",options:{},quantity:3,notes:"",artworkName:"",gift:false,giftMessage:"",updated:"2026-11-16"};
        localStorage.setItem("sonoran:cart", JSON.stringify({expires:Date.now()+86400000,value:[{...base,id:"count-one"},{...base,id:"count-two",quantity:2}]}));
      }
    });
    await page.goto("/cart");
    const bag = page.locator('.header-tools a[href="/cart"]');
    await expect(bag).toHaveAccessibleName("Shopping bag (5)");
    await expect(bag.locator(".count-dot")).toHaveText("5");
    await page.getByRole("button", {name:/Increase quantity for/}).first().click();
    await expect(bag).toHaveAccessibleName("Shopping bag (6)");
    await expect(bag.locator(".count-dot")).toHaveText("6");
    await page.reload();
    await expect(bag).toHaveAccessibleName("Shopping bag (6)");
    await page.getByRole("button", {name:"Remove",exact:true}).first().click();
    await expect(bag).toHaveAccessibleName("Shopping bag (2)");
    await expect(bag.locator(".count-dot")).toHaveText("2");
    await page.getByRole("button", {name:"Remove",exact:true}).click();
    await expect(bag).toHaveAccessibleName("Shopping bag");
    await expect(bag.locator(".count-dot")).toHaveCount(0);
    await page.reload();
    await expect(bag).toHaveAccessibleName("Shopping bag");
    await expect(bag.locator(".count-dot")).toHaveCount(0);
  });
}
