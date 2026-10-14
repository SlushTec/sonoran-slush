import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import catalog from '../../packages/contracts/catalog.reference.json';
const keyRoutes=['/','/shop','/custom-orders','/events','/our-work','/help','/about','/cart','/checkout','/account','/orders','/proofs','/admin','/privacy','/terms','/help/photo-guide','/help/shipping','/help/returns'];
for(const path of keyRoutes){test(`route and accessibility: ${path}`,async({page})=>{
 const response=await page.goto(path);expect(response?.status()).toBe(200);
 await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await expect(page.getByText('Development foundation — browsing references only.',{exact:false})).toBeVisible();
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();expect(results.violations).toEqual([]);
});}
test('all reference product and category routes resolve',async({request})=>{
 for(const c of catalog.categories){expect((await request.get('/shop/'+c.slug)).status()).toBe(200);}
 for(const p of catalog.products){expect((await request.get('/products/'+p.slug)).status()).toBe(200);}
 expect((await request.get('/products/not-a-product')).status()).toBe(404);
 expect((await request.get('/archive/2026-10-14-pre-native/snapshot/README.md')).status()).toBe(404);
});
test('search, no results and recovery work',async({page})=>{
 await page.goto('/shop');await page.getByLabel('Search product references').fill('decanter');await expect(page.getByRole('status')).toHaveText('2 product references');
 await page.getByLabel('Search product references').fill('nothing matches this');await expect(page.getByRole('heading',{name:'No matching references'})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.getByRole('status')).toHaveText(`${catalog.products.length} product references`);
});
test('mobile menu exposes state, Escape and navigation work',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');const menu=page.getByRole('button',{name:'Menu'});
 await menu.click();await expect(menu).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(menu).toHaveAttribute('aria-expanded','false');await expect(menu).toBeFocused();
 await menu.click();await page.getByRole('navigation',{name:'Primary',exact:true}).getByRole('link',{name:'Live events'}).click();await expect(page).toHaveURL(/events$/);await expect(menu).toHaveAttribute('aria-expanded','false');
});
for(const width of [320,390,768,1440]){test(`no horizontal overflow at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});for(const path of ['/','/shop','/products/makertwist-40oz-tumbler','/events','/checkout']){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
});}
test('scaffold never claims checkout readiness',async({page,request})=>{
 await page.goto('/products/makertwist-40oz-tumbler');await expect(page.getByRole('button',{name:'Purchasing not yet enabled'})).toBeDisabled();
 expect((await request.get('/api/ready')).status()).toBe(503);
 const robots=await request.get('/robots.txt');expect(await robots.text()).toContain('Disallow: /');
 expect((await request.get('/')).headers()['x-robots-tag']).toBe('noindex, nofollow');
});


test('capture foundation viewport evidence',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');await page.screenshot({path:'artifacts/foundation-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/foundation-mobile.png',fullPage:true});
});
