import {test,expect} from "@playwright/test";
for(const action of ["remove","new-design"]){
 test("pending local preview respects "+action,async({page})=>{
  await page.goto("/products/photo-crystal-heart");
  await page.getByRole("button",{name:"Add your personal touch"}).click();
  await page.evaluate(()=>{
   const w=window as any;
   w.__closed=0;w.__created=0;
   const create=URL.createObjectURL;
   URL.createObjectURL=function(blob:Blob){w.__created++;return create.call(URL,blob);};
   window.createImageBitmap=async()=>new Promise<any>(resolve=>{w.__release=()=>resolve({width:1000,height:1000,close:()=>w.__closed++});});
  });
  // Establish a current attachment with a real synthetic PNG and controlled decode.
  const file={name:"previous.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==","base64")};
  await page.locator("input[type=file]").setInputFiles(file);
  await expect.poll(()=>page.evaluate(()=>!!(window as any).__release)).toBe(true);
  await page.evaluate(()=>(window as any).__release());
  await expect(page.getByText("previous.png",{exact:true})).toBeVisible();
  await page.evaluate(()=>{(window as any).__release=undefined;});
  await page.locator("input[type=file]").setInputFiles({...file,name:"pending.png"});
  await expect.poll(()=>page.evaluate(()=>!!(window as any).__release)).toBe(true);
  if(action==="remove")await page.getByRole("button",{name:"Remove artwork"}).click();
  else await page.getByRole("button",{name:"Save & start another design"}).click();
  await page.evaluate(()=>(window as any).__release());
  await expect.poll(()=>page.evaluate(()=>(window as any).__closed)).toBe(2);
  expect(await page.evaluate(()=>(window as any).__created)).toBe(1);
  await expect(page.getByAltText("Your local artwork layout")).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:config:photo-crystal-heart")!).value.artworkName)).toBe("");
 });
}

test("artwork later stays selected after pending preview completes",async({page})=>{
 await page.goto("/products/photo-crystal-heart");
 await page.getByRole("button",{name:"Add your personal touch"}).click();
 await page.evaluate(()=>{
  const w=window as any;w.__closed=0;w.__created=0;
  const create=URL.createObjectURL;
  URL.createObjectURL=function(blob:Blob){w.__created++;return create.call(URL,blob);};
  window.createImageBitmap=async()=>new Promise<any>(resolve=>{w.__release=()=>resolve({width:1000,height:1000,close:()=>w.__closed++});});
 });
 await page.locator("input[type=file]").setInputFiles({name:"pending.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==","base64")});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__release)).toBe(true);
 await page.getByRole("checkbox",{name:"I will add artwork later."}).check();
 await page.evaluate(()=>(window as any).__release());
 await expect.poll(()=>page.evaluate(()=>(window as any).__closed)).toBe(1);
 await expect(page.getByRole("checkbox",{name:"I will add artwork later."})).toBeChecked();
 expect(await page.evaluate(()=>(window as any).__created)).toBe(0);
 await expect(page.getByAltText("Your local artwork layout")).toHaveCount(0);
 await page.getByRole("button",{name:"Finishing touches"}).click();
 await page.getByRole("button",{name:"Add design to bag"}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sonoran:cart")!).value[0].artworkName)).toBe("");
});
