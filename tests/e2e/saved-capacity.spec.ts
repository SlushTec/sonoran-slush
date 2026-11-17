import {test,expect} from '@playwright/test';
for(const width of [1280,390])for(const action of ['save','another','bag'])test('full saved collection '+action+' '+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/products/makertwist-40oz-tumbler');
 await page.evaluate(()=>{
  const d={slug:'makertwist-40oz-tumbler',text:'Synthetic kept',secondary:'',font:'Classic serif',options:{},quantity:1,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-17'};
  localStorage.setItem('sonoran:designs',JSON.stringify({expires:Date.now()+86400000,value:Array.from({length:100},(_,i)=>({...d,id:'kept-'+i}))}));
 });
 await page.reload();await page.getByRole('tab',{name:'Make it personal'}).click();
 const input=page.getByLabel('Name, initials, or message'),text='Synthetic caf\u00e9 capacity';
 await input.fill(text);
 const before=await page.evaluate(()=>localStorage.getItem('sonoran:designs'));
 const values=JSON.parse(before!).value;
 if(action==='bag')await page.getByRole('tab',{name:'Finishing touches'}).click();
 const button=page.getByRole('button',{name:action==='another'?'Save & start another design':action==='bag'?'Add design to bag':'Save this design for later',exact:true});
 for(let i=0;i<2;i++){
  await button.click();await expect(page.locator('.toast')).toContainText(action==='bag'?'saved designs are full':'Your saved designs are full');
  if(action==='bag')expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:designs')!).value)).toEqual(values);
  else expect(await page.evaluate(()=>localStorage.getItem('sonoran:designs'))).toBe(before);
 }
 if(action==='bag'){
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:cart')!).value.map((d:any)=>d.text))).toEqual([text]);
  await page.getByRole('tab',{name:'Make it personal'}).click();
 }
 await expect(input).toHaveValue(text);
 await page.reload();await page.getByRole('tab',{name:'Make it personal'}).click();await expect(input).toHaveValue(text);
 // Normal hydration refreshes retention metadata; preserve the full collection value and order.
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:designs')!).value)).toEqual(values);
 expect(values.map((d:any)=>d.id)).toEqual(Array.from({length:100},(_,i)=>'kept-'+i));
 await page.screenshot({path:'artifacts/saved-capacity-'+action+'-'+width+'.png',fullPage:true});
});

test('capacity rejection preserves pending photo ownership and draft',async({page})=>{
 await page.goto('/products/photo-crystal-heart');
 await page.evaluate(()=>{
  const d={slug:'makertwist-40oz-tumbler',text:'Synthetic',secondary:'',font:'Classic serif',options:{},quantity:1,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-17'};
  localStorage.setItem('sonoran:designs',JSON.stringify({expires:Date.now()+86400000,value:Array.from({length:100},(_,i)=>({...d,id:'kept-'+i}))}));
 });await page.reload();await page.getByRole('button',{name:'Add your personal touch'}).click();
 await page.evaluate(()=>{const w=window as any;w.__closed=0;w.__created=0;const create=URL.createObjectURL;URL.createObjectURL=function(b:Blob){w.__created++;return create.call(URL,b);};window.createImageBitmap=async()=>new Promise<any>(resolve=>{w.__release=()=>resolve({width:1000,height:1000,close:()=>w.__closed++});});});
 await page.locator('input[type=file]').setInputFiles({name:'capacity-pending.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__release)).toBe(true);
 const raw=await page.evaluate(()=>localStorage.getItem('sonoran:config:photo-crystal-heart'));
 await page.getByRole('button',{name:'Save & start another design',exact:true}).click();await expect(page.locator('.toast')).toContainText('Your saved designs are full');
 expect(await page.evaluate(()=>localStorage.getItem('sonoran:config:photo-crystal-heart'))).toBe(raw);
 await page.evaluate(()=>(window as any).__release());
 await expect(page.getByText('capacity-pending.png',{exact:true})).toBeVisible();await expect(page.getByAltText('Your local artwork layout')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__created)).toBe(1);expect(await page.evaluate(()=>(window as any).__closed)).toBe(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:config:photo-crystal-heart')!).value.artworkName)).toBe('capacity-pending.png');
});
