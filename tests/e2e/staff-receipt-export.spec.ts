import {test,expect} from "@playwright/test";
import fs from "node:fs/promises";
for(const fail of [false,true])test("staff receipt export remains bounded and recoverable "+fail,async({page})=>{
 await page.setViewportSize({width:fail?390:1280,height:900});let mutations=0;
 const receipt={id:"ord_synthetic",status:"prepared",access_token:"synthetic-private-receipt"};
 const quote={id:"quo_synthetic",kind:"retail",status:"accepted",version:2,total_minor:1234,message:"Synthetic accepted terms",items:[]};
 await page.route("https://commerce.qa.invalid/**",async r=>{
 const u=r.request().url();if(u.endsWith("/summary"))return r.fulfill({json:{counts:{accepted:1},recent:[]}});
 if(u.endsWith("/v1/admin/orders")){mutations++;return r.fulfill({json:{...receipt,internal_notes:"staff-only-must-not-download"}});}
 return r.fulfill({json:quote});});
 await page.goto("/admin");await page.waitForLoadState("networkidle");await page.getByLabel("Staff access code").fill("synthetic-staff");
 await page.getByRole("button",{name:"Open workspace",exact:true}).click();await page.getByLabel("Record reference").fill(quote.id);await page.getByRole("button",{name:"Open record",exact:true}).click();
 await page.getByRole("button",{name:"Prepare order from accepted version"}).click();const button=page.getByRole("button",{name:"Download receipt",exact:true});await expect(button).toBeVisible();
 const before=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await button.focus();
 if(fail){await page.evaluate(()=>{const w=window as any;w.oldCreate=URL.createObjectURL;URL.createObjectURL=()=>{throw Error("forced download");};});await page.keyboard.press("Enter");
 await expect(page.getByRole("status").filter({hasText:"Receipt download could not start"})).toBeVisible();await expect(button).toBeFocused();expect(errors).toEqual([]);
 await page.evaluate(()=>{URL.createObjectURL=(window as any).oldCreate;});}
 const wait=page.waitForEvent("download");await page.keyboard.press("Enter");const file=await wait;
 expect(file.suggestedFilename()).toBe("sonoran-slush-private-receipt.json");expect(JSON.parse(await fs.readFile((await file.path())!,"utf8"))).toEqual(receipt);
 expect(mutations).toBe(1);expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).toEqual(before);
 await page.getByRole("button",{name:"Lock workspace",exact:true}).click();await expect(page.getByLabel("Staff access code")).toHaveValue("");await expect(button).toHaveCount(0);await expect(page.getByText("Receipt download started",{exact:false})).toHaveCount(0);expect(mutations).toBe(1);
});
