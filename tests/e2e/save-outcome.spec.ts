import {test,expect} from "@playwright/test";
for(const mode of ["healthy","denied","noop"])for(const another of [false,true])test(mode+" save another="+another,async({page})=>{
 await page.goto("/products/makertwist-40oz-tumbler");
 await page.getByRole("tab",{name:"Make it personal"}).click();await page.getByLabel("Name, initials, or message").fill("Synthetic saved design");
 await page.evaluate(m=>{
  const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k:string,v:string){
   if(this===localStorage && k.startsWith("sonoran:") && m!=="healthy"){if(m==="denied")throw new DOMException("Synthetic","QuotaExceededError");return;}
   return orig.call(this,k,v);
  };
 },mode);
 await page.getByRole("button",{name:another?"Save & start another design":"Save this design for later",exact:true}).click();
 await expect(page.locator(".toast")).toContainText(mode==="healthy"?"saved on this device":"visit only");
 const values=await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:designs")||'{"value":[]}').value);
 expect(values.some((d:any)=>d.text==="Synthetic saved design")).toBe(mode==="healthy");
 if(!another)await expect(page.getByLabel("Name, initials, or message")).toHaveValue("Synthetic saved design");
 await page.getByRole("link",{name:"Saved gifts",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Good ideas, kept close.",exact:true})).toBeVisible(); await expect(page.locator("main article")).toContainText("Synthetic saved design");
});

