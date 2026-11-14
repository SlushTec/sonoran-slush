import {test,expect} from "@playwright/test";
for(const count of [99,100])test("bag capacity "+count+" gives truthful result and preserves work",async({page})=>{
 await page.addInitScript((n)=>{
  const d={slug:"makertwist-40oz-tumbler",text:"Synthetic",secondary:"",font:"Classic serif",options:{},quantity:1,notes:"",artworkName:"",gift:false,giftMessage:"",updated:"2026-11-14"};
  localStorage.setItem("sonoran:cart",JSON.stringify({expires:Date.now()+60000,value:Array.from({length:n},(_,i)=>({...d,id:"existing-"+i}))}));
 },count);
 await page.goto("/products/makertwist-40oz-tumbler");
 await page.getByRole("tab",{name:"Make it personal"}).click();
 await page.getByLabel("Name, initials, or message").fill("New synthetic design");
 await page.getByRole("tab",{name:"Finishing touches"}).click();
 await page.getByRole("button",{name:"Add design to bag"}).click();
 await expect(page.locator(".toast")).toContainText(count===100?"Your bag is full (100 designs).":"Design added to your bag.");
 const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).value.map((d:any)=>d.id));
 expect(ids).toHaveLength(100);
 expect(ids.some((id:string)=>!id.startsWith("existing-"))).toBe(count===99);
 if(count===100){
  expect(ids).toEqual(Array.from({length:100},(_,i)=>"existing-"+i));
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:designs")!).value)).toEqual([]);
  await page.getByRole("tab",{name:"Make it personal"}).click();
  await expect(page.getByLabel("Name, initials, or message")).toHaveValue("New synthetic design");
 }
});
test("existing bag design can be updated at capacity",async({page})=>{
 await page.addInitScript(()=>{
  const d={slug:"makertwist-40oz-tumbler",text:"Synthetic",secondary:"",font:"Classic serif",options:{},quantity:1,notes:"",artworkName:"",gift:false,giftMessage:"",updated:"2026-11-14"};
  localStorage.setItem("sonoran:cart",JSON.stringify({expires:Date.now()+60000,value:Array.from({length:100},(_,i)=>({...d,id:"existing-"+i}))}));
 });
 await page.goto("/products/makertwist-40oz-tumbler?design=existing-0&from=bag");
 await page.getByRole("tab",{name:"Make it personal"}).click();
 await page.getByLabel("Name, initials, or message").fill("Updated synthetic design");
 await page.getByRole("tab",{name:"Finishing touches"}).click();
 await page.getByRole("button",{name:"Add design to bag"}).click();
 await expect(page.locator(".toast")).toContainText("Design added to your bag.");
 const bag=await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).value);
 expect(bag).toHaveLength(100);expect(bag[0].text).toBe("Updated synthetic design");
 expect(bag.slice(1).every((d:any)=>d.text==="Synthetic")).toBe(true);
});
