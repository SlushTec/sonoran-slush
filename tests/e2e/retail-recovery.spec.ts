import {test,expect} from "@playwright/test";
const receipt={id:"quo_"+"a".repeat(32),status:"submitted",access_token:"b".repeat(43)};
async function seed(page:any){
 await page.addInitScript(()=>{
  if(!localStorage.getItem("sonoran:cart"))localStorage.setItem("sonoran:cart",JSON.stringify({expires:Date.now()+60000,value:[{id:"synthetic",slug:"makertwist-40oz-tumbler",text:"Synthetic",secondary:"",font:"Classic serif",options:{},quantity:1,notes:"",artworkName:"",gift:false,giftMessage:"",updated:"2026-11-14"}]}));
 });
}
async function fill(page:any,name="Synthetic Person"){
 await page.getByLabel("Full name").fill(name);await page.getByLabel("Email address").fill("person@example.test");await page.locator("input[type=checkbox][required]").check();
}
test("explicit reload retry reuses identity, changed details conflict, new request requires confirmation",async({page})=>{
 await seed(page);const calls:any[]=[];let original:any;
 await page.route("https://commerce.qa.invalid/**",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"content-type"}});
  const body=route.request().postDataJSON();calls.push(body);
  let status=200,data:any=receipt;
  if(!original){original=body;data={};}
  else if(body.request_id===original.request_id && JSON.stringify(body)!==JSON.stringify(original)){status=409;data={detail:"This request reference has already been used with different details."};}
  await route.fulfill({status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(data)});
 });
 await page.goto("/checkout");await fill(page);await page.getByRole("button",{name:"Request reviewed pricing"}).click();
 await expect(page.locator("form").getByRole("alert")).toContainText("may have received");
 const marker=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("sonoran:retail-attempt")!));
 expect(Object.keys(marker).sort()).toEqual(["id","state","version"]);expect(marker.state).toBe("pending");
 await page.reload();await expect(page.getByLabel("Full name")).toHaveValue("");expect(calls).toHaveLength(1);
 await fill(page,"Different Person");await page.getByRole("button",{name:"Request reviewed pricing"}).click();
 await expect(page.locator("form").getByRole("alert")).toContainText("already been used");
 expect(calls[1].request_id).toBe(calls[0].request_id);
 await page.getByLabel("Full name").fill("Synthetic Person");await page.getByRole("button",{name:"Request reviewed pricing"}).click();
 await expect(page.getByText("Your request is with the studio.")).toBeVisible();expect(calls[2]).toEqual(calls[0]);
 const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("sonoran:retail-attempt")!));
 expect(stored).toEqual({version:1,id:marker.id,state:"confirmed"});expect(JSON.stringify(stored)).not.toContain(receipt.access_token);
 await page.reload();await expect(page.getByText("An earlier request was confirmed in this tab.")).toBeVisible();expect(calls).toHaveLength(3);
 await page.getByRole("button",{name:"Start another request"}).click();await fill(page);await page.getByRole("button",{name:"Request reviewed pricing"}).click();
 await expect(page.getByText("Your request is with the studio.")).toBeVisible();expect(calls[3].request_id).not.toBe(calls[0].request_id);
});
test("unavailable session storage prevents dispatch until explicitly retried",async({page})=>{
 await seed(page);let calls=0;
 await page.route("https://commerce.qa.invalid/**",async route=>{if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"content-type"}});calls++;return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(receipt)});});
 await page.goto("/checkout");await fill(page);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;(window as any).__restore=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k:string,v:string){if(this===sessionStorage)throw new DOMException("Synthetic denial","SecurityError");return original.call(this,k,v);};});
 await page.getByRole("button",{name:"Request reviewed pricing"}).click();await expect(page.locator("form").getByRole("alert")).toContainText("No new submission was started");expect(calls).toBe(0);
 await page.evaluate(()=>(window as any).__restore());expect(calls).toBe(0);
 await page.getByRole("button",{name:"Request reviewed pricing"}).click();await expect(page.getByText("Your request is with the studio.")).toBeVisible();expect(calls).toBe(1);
});
