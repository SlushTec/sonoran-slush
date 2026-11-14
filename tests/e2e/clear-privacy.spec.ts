import {test,expect} from "@playwright/test";
test("failed saved-data cleanup remains visible and explicit retry clears it",async({page})=>{
 await page.goto("/saved");
 await page.evaluate(()=>{
  localStorage.setItem("sonoran:inquiry:contact",JSON.stringify({value:{values:{name:"Synthetic draft"}},expires:Date.now()+60000}));
  localStorage.setItem("other-app:keep","synthetic unrelated");
  const original=Storage.prototype.removeItem;
  (window as any).__restoreRemoval=()=>{Storage.prototype.removeItem=original;};
  Storage.prototype.removeItem=function(key:string){if(key==="sonoran:inquiry:contact")throw new DOMException("Synthetic denial","SecurityError");return original.call(this,key);};
 });
 await page.getByRole("button",{name:"Clear data on this device"}).click();
 await page.getByRole("button",{name:"Clear all saved work"}).click();
 await expect(page.locator("main").getByRole("alert")).toContainText("Some saved data could not be cleared");
 await page.waitForTimeout(4500);
 await expect(page.locator("main").getByRole("alert")).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem("sonoran:inquiry:contact"))).toBeTruthy();
 await page.evaluate(()=>(window as any).__restoreRemoval());
 await page.getByRole("button",{name:"Clear data on this device"}).click();
 await page.getByRole("button",{name:"Clear all saved work"}).click();
 await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
 await expect(page.getByText("Saved designs and browsing data cleared from this device.")).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem("sonoran:inquiry:contact"))).toBeNull();
 expect(await page.evaluate(()=>localStorage.getItem("other-app:keep"))).toBe("synthetic unrelated");
});
