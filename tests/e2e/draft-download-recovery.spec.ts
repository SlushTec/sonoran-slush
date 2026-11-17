import {test,expect} from "@playwright/test";
import fs from "node:fs/promises";
for(const width of [1280,390])test("draft download recovers when device saving is unavailable "+width,async({page})=>{
 await page.setViewportSize({width,height:900});let requests=0;await page.route("https://commerce.qa.invalid/**",async r=>{requests++;await r.abort();});
 await page.goto("/contact");await page.waitForLoadState("networkidle");await page.getByLabel("Your name").fill("Synthetic Person");await page.getByLabel("Email address").fill("person@example.test");await page.getByLabel("How can we help?").fill("Synthetic caf\u00e9\nKeep these details.");await page.locator("form.inquiry-form input[type=checkbox]").check();
 await expect(page.getByLabel("Your name")).toHaveValue("Synthetic Person");await expect(page.getByLabel("Email address")).toHaveValue("person@example.test");
 const before=await page.evaluate(()=>({...localStorage}));
 await page.evaluate(()=>{const w=window as any;w.oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage)throw Error("blocked storage");return w.oldSet.call(this,k,v);};w.oldCreate=URL.createObjectURL;URL.createObjectURL=()=>{throw Error("blocked download");};});
 await page.getByRole("button",{name:"Save draft on this device"}).click();await expect(page.getByRole("status").filter({hasText:"This draft could not be verified on this device. Keep this page open and download your draft before leaving."})).toBeVisible();
 const button=page.getByRole("button",{name:"Download draft",exact:true});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await button.focus();await page.keyboard.press("Enter");
 await expect(page.getByRole("status").filter({hasText:"Draft download could not start"})).toBeVisible();await expect(button).toBeFocused();expect(errors).toEqual([]);
 await expect(page.getByLabel("How can we help?")).toHaveValue("Synthetic caf\u00e9\nKeep these details.");expect(await page.evaluate(()=>({...localStorage}))).toEqual(before);expect(requests).toBe(0);
 await page.evaluate(()=>{URL.createObjectURL=(window as any).oldCreate;});const wait=page.waitForEvent("download");await page.keyboard.press("Enter");const file=await wait;
 expect(file.suggestedFilename()).toBe("sonoran-slush-contact-draft.json");const data=JSON.parse(await fs.readFile((await file.path())!,"utf8"));expect(data.name).toBe("Synthetic Person");expect(data.email).toBe("person@example.test");expect(data.details).toBe("Synthetic caf\u00e9\nKeep these details.");expect(data.consent).toBe(false);expect(data.status).toBe("unsent_draft");expect(data.kind).toBe("contact");expect(data.request_id).toBeTruthy();
 await expect(page.getByRole("status").filter({hasText:"Draft download started"})).toBeVisible();expect(requests).toBe(0);expect(await page.evaluate(()=>({...localStorage}))).toEqual(before);
 await page.getByLabel("How can we help?").fill("Newer unsent text");await expect(page.getByText("Draft download started",{exact:false})).toHaveCount(0);await expect(page.locator("form.inquiry-form input[type=checkbox]")).toBeChecked();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
