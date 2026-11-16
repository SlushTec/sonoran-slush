import {test,expect} from "@playwright/test";
import fs from "node:fs/promises";
for(const width of [1280,390])test("private receipt download can recover without resubmission "+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>localStorage.setItem("sonoran:cart",JSON.stringify({expires:Date.now()+86400000,value:[{id:"synthetic-receipt",slug:"makertwist-40oz-tumbler",text:"Synthetic",secondary:"",font:"",options:{},quantity:1,notes:"",artworkName:"",gift:false,giftMessage:"",updated:"2026-11-17"}]})));
 let calls=0;const receipt={id:"quo_"+"a".repeat(32),status:"reviewed",access_token:"b".repeat(43)};
 await page.route("https://commerce.qa.invalid/**",async route=>{
 if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"content-type"}});
 calls++;await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({...receipt,internal_notes:"must-not-download"})});});
 await page.goto("/checkout");await page.getByLabel("Full name").fill("Synthetic Person");await page.getByLabel("Email address").fill("person@example.test");await page.locator("input[type=checkbox][required]").check();await page.getByRole("button",{name:"Request reviewed pricing"}).click();await expect(page.getByText("Your request is with the studio.")).toBeVisible();
 const before=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.evaluate(()=>{const w=window as any;w.oldCreate=URL.createObjectURL;URL.createObjectURL=()=>{throw Error("forced");};});
 const button=page.getByRole("button",{name:"Download private receipt"});await button.focus();await page.keyboard.press("Enter");
 await expect(page.getByRole("status").filter({hasText:"Receipt download could not start"})).toBeVisible();await expect(button).toBeFocused();expect(errors).toEqual([]);expect(calls).toBe(1);
 expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).toEqual(before);
 expect(JSON.stringify(before)).not.toContain(receipt.access_token);
 await page.evaluate(()=>{URL.createObjectURL=(window as any).oldCreate;});const wait=page.waitForEvent("download");await page.keyboard.press("Enter");const file=await wait;
 expect(file.suggestedFilename()).toBe("sonoran-slush-private-receipt.json");expect(JSON.parse(await fs.readFile((await file.path())!,"utf8"))).toEqual(receipt);
 await expect(page.getByRole("status").filter({hasText:"Receipt download started"})).toBeVisible();expect(calls).toBe(1);expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).toEqual(before);
 await page.getByRole("button",{name:"Start another request"}).click();await expect(page.getByLabel("Full name")).toHaveValue("");await expect(page.getByText("Receipt download started",{exact:false})).toHaveCount(0);expect(calls).toBe(1);
});
