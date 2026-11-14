import {test,expect} from "@playwright/test";
for(const source of ["bag","saved"]){
 test(source+" edit uses the selected collection",async({page})=>{
  await page.addInitScript(()=>{
   const design={id:"synthetic-design",slug:"makertwist-40oz-tumbler",text:"Synthetic",secondary:"",font:"Classic serif",options:{},quantity:1,notes:"",artworkName:"",gift:false,giftMessage:"",updated:"2026-11-14T00:00:00Z"};
   for(const key of ["cart","designs"])localStorage.setItem("sonoran:"+key,JSON.stringify({expires:Date.now()+60000,value:[design]}));
  });
  await page.goto("/cart");
  const increase=page.getByRole("button",{name:/Increase quantity/});
  await increase.click();await increase.click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).value[0].quantity)).toBe(3);
  if(source==="bag")await page.getByRole("link",{name:"Edit design",exact:true}).click();
  else{
   await page.getByRole("link",{name:"Saved gifts",exact:true}).click();
   await page.getByRole("link",{name:"Continue designing"}).click();
  }
  await expect(page.getByRole("spinbutton",{name:"Quantity",exact:true})).toHaveValue(source==="bag"?"3":"1");
  if(source==="bag"){
   await page.getByRole("tab",{name:"Finishing touches"}).click();
   await page.getByRole("button",{name:"Add design to bag"}).click();
   expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).value[0].quantity)).toBe(3);
  }
 });
}
