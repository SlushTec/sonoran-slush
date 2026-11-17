import {test,expect} from '@playwright/test';
for(const width of [1280,390])test('saved favorite keyboard recovery '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.addInitScript(()=>{if(!localStorage.getItem('sonoran:favorites'))localStorage.setItem('sonoran:favorites',JSON.stringify({expires:Date.now()+86400000,value:['pet-tags','pet-bowls','stainless-pendants']}));});await page.goto('/saved');await page.getByRole('button',{name:'Favorite gifts (3)'}).click();
 const unsave=page.getByRole('button',{name:/^Unsave /});await expect(unsave).toHaveCount(3);await unsave.nth(1).focus();await page.keyboard.press('Enter');await expect(unsave).toHaveCount(2);await expect(unsave.nth(1)).toBeFocused();
 await page.keyboard.press('Enter');await expect(unsave).toHaveCount(1);await expect(unsave).toBeFocused();await page.keyboard.press('Enter');await expect(unsave).toHaveCount(0);await expect(page.getByRole('link',{name:'Find a favorite'})).toBeFocused();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sonoran:favorites')!).value)).toEqual([]);
 await page.screenshot({path:'artifacts/favorite-focus-'+width+'.png',fullPage:true});await page.reload();await page.getByRole('button',{name:'Favorite gifts (0)'}).click();await expect(page.getByRole('link',{name:'Find a favorite'})).toBeVisible();
});
