import {test,expect} from '@playwright/test';
for(const width of [1280,390])for(const mode of ['retained','loaded','pending'])test('artwork removal keyboard focus '+mode+' '+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>{if(!localStorage.getItem('sonoran:config:photo-crystal-heart'))localStorage.setItem('sonoran:config:photo-crystal-heart',JSON.stringify({expires:Date.now()+86400000,value:{id:'artwork-focus',slug:'photo-crystal-heart',text:'Keep caf\u00e9 words',secondary:'',font:'Classic serif',options:{'Crystal shape':'Heart',Size:'Small'},quantity:1,notes:'Keep notes',artworkName:'previous.png',gift:false,giftMessage:'',updated:'2026-11-17'}}));});
 await page.goto('/products/photo-crystal-heart');await expect(page.getByRole('button',{name:'Add your personal touch'})).toBeEnabled();await expect(page.locator('[role=tab]:focus')).toHaveCount(0);
 await page.getByRole('button',{name:'Add your personal touch'}).click();
 if(mode!=='retained'){
  await page.evaluate((pending)=>{const w=window as any;w.__closed=0;w.__created=0;const create=URL.createObjectURL;URL.createObjectURL=function(blob:Blob){w.__created++;return create.call(URL,blob);};window.createImageBitmap=async()=>pending?new Promise<any>(resolve=>{w.__release=()=>resolve({width:1000,height:1000,close:()=>w.__closed++});}):({width:1000,height:1000,close:()=>w.__closed++} as ImageBitmap);},mode==='pending');
  // Real file input; controlled bitmap decode isolates pending completion ownership.
  await page.locator('#artwork').setInputFiles({name:'current.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')});
  if(mode==='pending'){await expect.poll(()=>page.evaluate(()=>!!(window as any).__release)).toBe(true);await expect(page.locator('#artwork')).toBeDisabled();}
  else{await expect(page.getByText('current.png',{exact:true})).toBeVisible();await expect(page.getByAltText('Your local artwork layout')).toBeVisible();}
 }
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:config:photo-crystal-heart')!).value);const before=await read();
 await page.getByRole('button',{name:'Remove artwork'}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('#config-tab-1')).toBeFocused();await expect(page.locator('#config-tab-1')).toHaveAttribute('aria-selected','true');await expect(page.getByRole('button',{name:'Remove artwork'})).toHaveCount(0);await expect(page.locator('#artwork')).toBeEnabled();
 if(mode==='pending'){await page.evaluate(()=>(window as any).__release());await expect.poll(()=>page.evaluate(()=>(window as any).__closed)).toBe(1);expect(await page.evaluate(()=>(window as any).__created)).toBe(0);}
 await expect(page.getByAltText('Your local artwork layout')).toHaveCount(0);const after=await read();expect(after.artworkName).toBe('');const {artworkName:bn,updated:bu,...bf}=before,{artworkName:an,updated:au,...af}=after;expect(af).toEqual(bf);await expect(page.locator('#config-tab-1')).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(mode==='loaded')await page.screenshot({path:'artifacts/artwork-remove-'+width+'.png',fullPage:true});
 await page.reload();await expect(page.getByRole('button',{name:'Add your personal touch'})).toBeEnabled();await expect(page.locator('[role=tab]:focus')).toHaveCount(0);expect((await read()).artworkName).toBe('');
});
