import {test,expect} from '@playwright/test';
for(const width of [1280,390])test('explicit new design keyboard focus '+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/products/pet-tags?design=missing');
 for(let round=0;round<2;round++){
 const start=page.getByRole('button',{name:'Start a new design',exact:true});await expect(start).toBeVisible();await expect(page.locator('[role=tab]:focus')).toHaveCount(0);
 const before=await page.evaluate(()=>localStorage.getItem('sonoran:config:pet-tags'));await start.focus();await page.keyboard.press('Enter');
 const first=page.locator('#config-tab-0');await expect(first).toBeFocused();await expect(first).toHaveAttribute('aria-selected','true');await expect(start).toHaveCount(0);
 const raw=await page.evaluate(()=>localStorage.getItem('sonoran:config:pet-tags'));expect(raw).not.toBe(before);expect(JSON.parse(raw!).value.slug).toBe('pet-tags');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:designs')!).value)).toEqual([]);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:cart')!).value)).toEqual([]);
 if(round===0)await page.screenshot({path:'artifacts/stale-start-focus-'+width+'.png',fullPage:true});
 await page.reload();await expect(start).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('sonoran:config:pet-tags'))).toBe(raw);await expect(page.locator('[role=tab]:focus')).toHaveCount(0);
 }
 await page.getByRole('link',{name:'Recover current draft'}).click();await expect(page.getByRole('button',{name:'Add your personal touch'})).toBeEnabled();await expect(page.locator('[role=tab]:focus')).toHaveCount(0);
});
