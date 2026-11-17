import {test,expect} from "@playwright/test";
import fs from "node:fs/promises";
for(const mode of ["create","click"])test("inquiry receipt "+mode+" failure preserves recovery",async({page})=>{
 await page.setViewportSize({width:mode==="create"?1280:390,height:900});let calls=0;
 const receipt={id:"msg_"+"a".repeat(32),status:"submitted",access_token:"b".repeat(43)};
 await page.route("https://commerce.qa.invalid/**",async route=>{
 if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"content-type"}});
 calls++;await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({...receipt,internal_notes:"must-not-download"})});});
 await page.goto("/contact");await page.getByLabel("Your name").fill("Synthetic Person");await page.getByLabel("Email address").fill("person@example.test");await page.getByLabel("How can we help?").fill("Synthetic inquiry");await page.locator("form.inquiry-form input[type=checkbox]").check();await page.locator("form.inquiry-form button[type=submit]").click();await expect(page.getByText("Your request is with the studio.")).toBeVisible();
 const before=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.evaluate(mode=>{const w=window as any;w.oldCreate=URL.createObjectURL;w.oldClick=HTMLAnchorElement.prototype.click;w.oldRevoke=URL.revokeObjectURL;w.created=[];w.revoked=[];
 URL.createObjectURL=function(b){if(mode==="create")throw Error("forced create");const u=w.oldCreate.call(URL,b);w.created.push(u);return u;};
 HTMLAnchorElement.prototype.click=function(){if(mode==="click")throw Error("forced click");return w.oldClick.call(this);};URL.revokeObjectURL=function(u){w.revoked.push(u);return w.oldRevoke.call(URL,u);};},mode);
 const button=page.getByRole("button",{name:"Download private receipt"});await button.focus();await page.keyboard.press("Enter");
 await expect(page.getByRole("status").filter({hasText:"Receipt download could not start"})).toBeVisible();await expect(button).toBeFocused();expect(errors).toEqual([]);expect(calls).toBe(1);
 expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).toEqual(before);expect(JSON.stringify(before)).not.toContain(receipt.access_token);
 if(mode==="click")expect(await page.evaluate(()=>{const w=window as any;return w.created.length===1&&w.revoked.includes(w.created[0]);})).toBe(true);
 await page.evaluate(()=>{const w=window as any;URL.createObjectURL=w.oldCreate;HTMLAnchorElement.prototype.click=w.oldClick;URL.revokeObjectURL=w.oldRevoke;});const wait=page.waitForEvent("download");await page.keyboard.press("Enter");const file=await wait;
 expect(file.suggestedFilename()).toBe("sonoran-slush-private-receipt.json");expect(JSON.parse(await fs.readFile((await file.path())!,"utf8"))).toEqual(receipt);await expect(page.getByRole("status").filter({hasText:"Receipt download started"})).toBeVisible();
 expect(calls).toBe(1);expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).toEqual(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
