import {test,expect} from '@playwright/test';
for(const width of [1280,390])test('changed choices require deliberate review '+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>{
 const old={id:'old-options',slug:'photo-crystal-heart',text:'Exact caf\u00e9 words',secondary:'',font:'Classic serif',options:{'Crystal shape':'Wrong old shape',Size:'Retired large'},quantity:3,notes:'Keep original notes',artworkName:'',gift:true,giftMessage:'Original gift',updated:'2026-11-17'};
 if(!localStorage.getItem('sonoran:config:photo-crystal-heart'))localStorage.setItem('sonoran:config:photo-crystal-heart',JSON.stringify({expires:Date.now()+86400000,value:old}));
 });await page.goto('/products/photo-crystal-heart');await expect(page.getByRole('heading',{name:'Review changed choices'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:config:photo-crystal-heart')!).value)).toMatchObject({id:'old-options',options:{'Crystal shape':'Wrong old shape',Size:'Retired large'}});
 const original=await page.evaluate(()=>localStorage.getItem('sonoran:config:photo-crystal-heart'));
 await page.reload();await expect(page.getByRole('heading',{name:'Review changed choices'})).toBeVisible();
 await expect(page.getByText('Retired large',{exact:true})).toBeVisible();
 for(const name of ['Save this design for later','Save & start another design'])await expect(page.getByRole('button',{name,exact:true})).toBeDisabled();
 await page.getByRole('tab',{name:/Finishing touches/}).click();await expect(page.getByRole('button',{name:'Add design to bag'})).toBeDisabled();
 expect(await page.evaluate(()=>localStorage.getItem('sonoran:config:photo-crystal-heart'))).toBe(original);
 await page.getByRole('tab',{name:/Make it personal/}).click();await page.getByLabel(/Inscription \(optional\)/).fill('Unconfirmed edit');
 await page.reload();await expect(page.getByRole('heading',{name:'Review changed choices'})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('sonoran:config:photo-crystal-heart'))).toBe(original);
 await page.getByLabel('Size',{exact:true}).selectOption('Large');
 await page.getByRole('tab',{name:/Make it personal/}).click();await page.getByLabel(/Inscription \(optional\)/).fill('Confirmed caf\u00e9 edit');
 await page.getByRole('heading',{name:'Review changed choices'}).scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/option-review-'+width+'.png',fullPage:true});
 await page.getByRole('button',{name:'Use these current choices'}).click();
 await expect(page.getByRole('heading',{name:'Review changed choices'})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:config:photo-crystal-heart')!).value.text)).toBe('Confirmed caf\u00e9 edit');
 const changed=await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:config:photo-crystal-heart')!).value);
 expect(changed.options).toEqual({'Crystal shape':'Heart',Size:'Large'});expect(changed.quantity).toBe(3);expect(changed.notes).toBe('Keep original notes');expect(changed.giftMessage).toBe('Original gift');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:designs')!).value)).toEqual([]);
 await page.getByRole('button',{name:'Save this design for later',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:designs')!).value[0].text)).toBe('Confirmed caf\u00e9 edit');
 await page.reload();await expect(page.getByRole('heading',{name:'Review changed choices'})).toHaveCount(0);
 await page.getByRole('tab',{name:/Make it personal/}).click();await expect(page.getByLabel(/Inscription \(optional\)/)).toHaveValue('Confirmed caf\u00e9 edit');
});

test('pending review preserves photo ownership and blocked saves; storage failure remains truthful',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('sonoran:config:photo-crystal-heart'))localStorage.setItem('sonoran:config:photo-crystal-heart',JSON.stringify({expires:Date.now()+86400000,value:{id:'photo-old',slug:'photo-crystal-heart',text:'Photo words',secondary:'',font:'Classic serif',options:{'Crystal shape':'Heart',Size:'Retired'},quantity:1,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-17'}}));});
 await page.goto('/products/photo-crystal-heart');await expect(page.getByRole('heading',{name:'Review changed choices'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:config:photo-crystal-heart')!).value)).toMatchObject({id:'photo-old',options:{'Crystal shape':'Heart',Size:'Retired'}});
 await page.reload();await expect(page.getByRole('heading',{name:'Review changed choices'})).toBeVisible();
 const original=await page.evaluate(()=>localStorage.getItem('sonoran:config:photo-crystal-heart'));
 await page.getByRole('button',{name:'Add your personal touch'}).click();
 await page.evaluate(()=>{const w=window as any;w.__closed=0;window.createImageBitmap=async()=>new Promise<any>(resolve=>{w.__release=()=>resolve({width:1000,height:1000,close:()=>w.__closed++});});});
 await page.locator('input[type=file]').setInputFiles({name:'review-pending.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__release)).toBe(true);
 for(const name of ['Save this design for later','Save & start another design']){
 const button=page.getByRole('button',{name,exact:true});await expect(button).toBeDisabled();
 await button.evaluate((b:HTMLButtonElement)=>{b.disabled=false;b.click();});
 }
 await page.evaluate(()=>(window as any).__release());await expect(page.getByText('review-pending.png',{exact:true})).toBeVisible();await expect(page.getByAltText('Your local artwork layout')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__closed)).toBe(1);
 expect(await page.evaluate(()=>localStorage.getItem('sonoran:config:photo-crystal-heart'))).toBe(original);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:designs')!).value)).toEqual([]);
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('denied','QuotaExceededError');};});
 await page.getByRole('button',{name:'Use these current choices'}).click();
 await page.getByRole('button',{name:'Save this design for later',exact:true}).click();
 await expect(page.locator('.toast')).toContainText('Design kept for this visit only. Device storage could not be verified');
 await expect(page.getByAltText('Your local artwork layout')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('sonoran:config:photo-crystal-heart'))).toBe(original);
});
