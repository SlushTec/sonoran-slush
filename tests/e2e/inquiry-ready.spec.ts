import {test,expect} from "@playwright/test";
for(const width of [1280,390])test("cold inquiry cannot silently discard an early visible edit "+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 await page.route("**/_next/static/**/*.js*",async r=>{await gate;await r.continue();});
 await page.goto("/contact",{waitUntil:"commit"});
 const name=page.getByLabel("Your name");await expect(name).toBeVisible();
 const before=await name.isEditable();
 if(before){await name.fill("Early synthetic name");await expect(name).toHaveValue("Early synthetic name");}
 else{await expect(page.getByRole("status").filter({hasText:"Preparing your form"})).toBeVisible();await expect(page.getByRole("button",{name:"Save draft on this device"})).toBeDisabled();}
 release();await page.waitForLoadState("networkidle");
 if(before)await expect(name).toHaveValue("Early synthetic name");
 await expect(name).toBeEditable();await expect(page.getByRole("status").filter({hasText:"Preparing your form"})).toHaveCount(0);await name.fill("Ready synthetic name");await page.getByLabel("Email address").fill("ready@example.test");await expect(name).toHaveValue("Ready synthetic name");
 await page.getByLabel("How can we help?").fill("Synthetic saved draft");await page.getByRole("button",{name:"Save draft on this device"}).click();
 await expect(page.getByRole("status").filter({hasText:"Request draft saved on this device"})).toBeVisible();await page.reload();await expect(name).toHaveValue("Ready synthetic name");await expect(page.getByLabel("Email address")).toHaveValue("ready@example.test");await expect(page.getByLabel("How can we help?")).toHaveValue("Synthetic saved draft");
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo({top:0,left:0,behavior:"instant"});});await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await page.screenshot({path:"D:/dot-workspace/store-inquiry-ready-settled-"+width+".png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
