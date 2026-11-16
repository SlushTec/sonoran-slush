import {test,expect} from "@playwright/test";
for(const width of [1280,390])test("saved-work confirmation supports safe keyboard dismissal "+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>localStorage.setItem("sonoran:favorites",JSON.stringify({expires:Date.now()+86400000,value:["makertwist-40oz-tumbler"]})));
 await page.goto("/saved");const trigger=page.getByRole("button",{name:"Clear data on this device",exact:true}),keep=page.getByRole("button",{name:"Keep it",exact:true});
 await expect(page.getByRole("button",{name:"Favorite gifts (1)",exact:true})).toBeVisible();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem("sonoran:favorites")!).expires>Date.now()+29*86400000);
 const before=await page.evaluate(()=>localStorage.getItem("sonoran:favorites"));
 await trigger.focus();await page.keyboard.press("Enter");await expect(keep).toBeFocused();
 await page.keyboard.press("Escape");await expect(keep).toHaveCount(0);await expect(trigger).toBeFocused();expect(await page.evaluate(()=>localStorage.getItem("sonoran:favorites"))).toBe(before);
 await trigger.click();await keep.click();await expect(trigger).toBeFocused();expect(await page.evaluate(()=>localStorage.getItem("sonoran:favorites"))).toBe(before);
 await trigger.click();await page.getByRole("button",{name:"Clear all saved work",exact:true}).click();await expect(trigger).toBeFocused();
 await expect(page.getByRole("button",{name:"Favorite gifts (0)",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:favorites") || "null")?.value || [])).toEqual([]);
 await trigger.click();await expect(keep).toBeFocused();await page.keyboard.press("Escape");await expect(trigger).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});