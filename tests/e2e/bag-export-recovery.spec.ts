import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
for(const mode of ["create","click"])test("bag export "+mode+" failure supports unchanged retry",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("sonoran:cart",JSON.stringify({expires:Date.now()+86400000,value:[{id:"export-one",slug:"makertwist-40oz-tumbler",text:"Synthetic caf\u00e9",secondary:"",font:"Classic serif",options:{},quantity:2,notes:"",artworkName:"",gift:false,giftMessage:"",updated:"2026-11-16"}]})));
 await page.goto("/cart");const button=page.getByRole("button",{name:"Download your designs",exact:true});await expect(button).toBeVisible();
 const before=await page.evaluate(()=>localStorage.getItem("sonoran:cart"));const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.evaluate(mode=>{const w=window as any;w.oldCreate=URL.createObjectURL;w.oldClick=HTMLAnchorElement.prototype.click;w.oldRevoke=URL.revokeObjectURL;w.created=[];w.revoked=[];
 URL.createObjectURL=function(b){if(mode==="create")throw Error("forced create");const u=w.oldCreate.call(URL,b);w.created.push(u);return u;};
 HTMLAnchorElement.prototype.click=function(){if(mode==="click")throw Error("forced click");return w.oldClick.call(this);};
 URL.revokeObjectURL=function(u){w.revoked.push(u);return w.oldRevoke.call(URL,u);};},mode);
 await button.focus();await page.keyboard.press("Enter");
 await expect(page.getByRole("status").filter({hasText:"Download could not start"})).toBeVisible();await expect(button).toBeFocused();
 expect(await page.evaluate(()=>localStorage.getItem("sonoran:cart"))).toBe(before);expect(errors).toEqual([]);
 if(mode==="click")expect(await page.evaluate(()=>{const w=window as any;return w.created.length===1&&w.revoked.includes(w.created[0]);})).toBe(true);
 await page.evaluate(()=>{const w=window as any;URL.createObjectURL=w.oldCreate;HTMLAnchorElement.prototype.click=w.oldClick;URL.revokeObjectURL=w.oldRevoke;});
 const wait=page.waitForEvent("download");await button.click();const file=await wait;expect(file.suggestedFilename()).toBe("sonoran-slush-designs.json");
 const value=JSON.parse(await readFile((await file.path())!,"utf8"));expect(value.items).toEqual(JSON.parse(before!).value);expect(value.paid).toBe(false);expect(value.type).toBe("design_request");
 await expect(page.getByRole("status").filter({hasText:"Download started"})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem("sonoran:cart"))).toBe(before);
});