import {test,expect} from '@playwright/test';
for(const width of [1280,390])for(const slug of ['pet-tags','photo-crystal-heart'])test('missing personalization keyboard recovery '+slug+' '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/products/'+slug);await expect(page.getByRole('button',{name:'Add your personal touch'})).toBeEnabled();
 const raw=await page.evaluate(slug=>localStorage.getItem('sonoran:config:'+slug),slug);
 for(let attempt=0;attempt<2;attempt++){
 await page.locator('#config-tab-2').click();const add=page.getByRole('button',{name:'Add design to bag'});await add.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#config-tab-1')).toBeFocused();await expect(page.locator('#config-tab-1')).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.form-error[role=alert]')).toContainText(slug==='pet-tags'?'Add a name or message':'Add a local photo');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:cart')!).value)).toEqual([]);expect(await page.evaluate(slug=>localStorage.getItem('sonoran:config:'+slug),slug)).toBe(raw);
 }
 await page.screenshot({path:'artifacts/validation-focus-'+slug+'-'+width+'.png',fullPage:true});
 if(slug==='pet-tags')await page.getByLabel('Name, initials, or message').fill('Ready words');else await page.getByLabel('I will add artwork later.').check();
 await page.getByRole('button',{name:'Finishing touches',exact:true}).click();await page.getByRole('button',{name:'Add design to bag'}).focus();await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:cart')!).value.length)).toBe(1);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:cart')!).value[0].slug)).toBe(slug);
});
