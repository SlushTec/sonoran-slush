import {test,expect} from "@playwright/test";
test("leave pending inquiry then return recovers the same saved request",async({page})=>{
 const calls:any[]=[];let release!:()=>void;
 const pending=new Promise<void>(r=>{release=r});
 await page.route("https://commerce.qa.invalid/**",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"content-type"}});
  calls.push(route.request().postDataJSON());if(calls.length===1)await pending;
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({id:"msg_"+"a".repeat(32),status:"submitted",access_token:"b".repeat(43)})});
 });
 await page.goto("/contact");await page.getByLabel("Your name").fill("Synthetic Person");
 await page.getByLabel("Email address").fill("person@example.test");
 await page.getByLabel("How can we help?").fill("Synthetic inquiry");
 await page.locator("form input[type=checkbox]").check();
 await page.getByRole("button",{name:"Save draft on this device"}).click();
 const saved=await page.evaluate(()=>localStorage.getItem("sonoran:inquiry:contact"));
 await page.locator("form button[type=submit]").click();await expect.poll(()=>calls.length).toBe(1);
 await page.locator('a[href="/shop"]').first().click();await expect(page).toHaveURL(/\/shop$/);
 const completed=page.waitForResponse(r=>r.url().startsWith("https://commerce.qa.invalid/")&&r.request().method()==="POST");
 release();await (await completed).finished();
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 expect(await page.evaluate(()=>localStorage.getItem("sonoran:inquiry:contact"))).toBe(saved);
 await page.goBack();await expect(page.getByLabel("Your name")).toHaveValue("Synthetic Person");
 await page.locator("form input[type=checkbox]").check();await page.locator("form button[type=submit]").click();
 await expect(page.getByText("Your request is with the studio.")).toBeVisible();
 expect(calls).toHaveLength(2);expect(calls[1]).toEqual(calls[0]);
 expect(await page.evaluate(()=>localStorage.getItem("sonoran:inquiry:contact"))).toBeNull();
});
