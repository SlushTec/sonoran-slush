import {test,expect} from "@playwright/test";
for(const width of [1280,390])test("bag removal preserves keyboard position "+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>{if(!sessionStorage.getItem("seeded-remove")){sessionStorage.setItem("seeded-remove","1");localStorage.setItem("sonoran:cart",JSON.stringify({expires:Date.now()+86400000,value:[1,2,3].map(n=>({id:"remove-"+n,slug:"makertwist-40oz-tumbler",text:"Synthetic "+n,secondary:"",font:"Classic serif",options:{},quantity:n,notes:"",artworkName:"",gift:false,giftMessage:"",updated:"2026-11-17"}))}));}});
 await page.goto("/cart");const items=page.locator(".bag-item");await expect(items).toHaveCount(3);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).expires>Date.now()+29*86400000)).toBe(true);
 const original=await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).value);
 const remove=()=>page.getByRole("button",{name:"Remove",exact:true});
 await remove().nth(1).focus();await page.keyboard.press("Enter");await expect(items).toHaveCount(2);await expect(remove().nth(1)).toBeFocused();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).value)).toEqual([original[0],original[2]]);
 await page.keyboard.press("Enter");await expect(items).toHaveCount(1);await expect(remove()).toBeFocused();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).value)).toEqual([original[0]]);
 await page.reload();await expect(items).toHaveCount(1);expect(await remove().evaluate(e=>e===document.activeElement)).toBe(false);
 await remove().focus();await page.keyboard.press("Enter");await expect(items).toHaveCount(0);await expect(page.getByRole("link",{name:"Find their gift"})).toBeFocused();
 await page.reload();await expect(page.getByRole("link",{name:"Find their gift"})).toBeVisible();
 expect(await page.evaluate(()=>{const s=localStorage.getItem("sonoran:cart");return !s||JSON.parse(s).value.length===0;})).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
