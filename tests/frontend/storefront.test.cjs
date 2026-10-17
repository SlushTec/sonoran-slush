// DOM-level interaction checks. This does not launch a browser or claim device QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<!doctype html><html lang="en"><head><title>Storefront test</title></head><body><div id="test-root"></div></body></html>',{url:'https://review.example.test/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLDialogElement','Node','MutationObserver','localStorage','location','getComputedStyle']){
 Object.defineProperty(global,key,{value:key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key],configurable:true,writable:true});
}
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = ()=>{};
const React = require('react');
const originalLoad=Module._load,originalResolve=Module._resolveFilename;
Module._load=function(request,parent,main){
 if(request==='next/link')return {__esModule:true,default:React.forwardRef(function Link({href,children,prefetch,...props},ref){return React.createElement('a',{href,ref,...props},children);})};
 if(request==='next/navigation')return {usePathname:()=>location.pathname};
 return originalLoad.apply(this,arguments);
};
Module._resolveFilename=function(request,parent,...rest){if(request.startsWith('@/'))request=path.join(__dirname,'../../apps/storefront/src',request.slice(2));return originalResolve.call(this,request,parent,...rest);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {render,screen,fireEvent,waitFor,cleanup}=require('@testing-library/react');
const {StoreProvider}=require('../../apps/storefront/src/components/Store.tsx');
const Customizer=require('../../apps/storefront/src/components/Customizer.tsx').default;
const CatalogSearch=require('../../apps/storefront/src/components/CatalogSearch.tsx').default;
const InquiryForm=require('../../apps/storefront/src/components/InquiryForm.tsx').default;
const GiftFinder=require('../../apps/storefront/src/components/GiftFinder.tsx').default;
const ProductCard=require('../../apps/storefront/src/components/ProductCard.tsx').default;
const {Bag,Saved,Checkout}=require('../../apps/storefront/src/components/ShoppingFlows.tsx');
const {Portal}=require('../../apps/storefront/src/components/CustomerPortal.tsx');
const {catalog}=require('../../apps/storefront/src/lib/catalog.ts');
const {readLocal,writeLocal}=require('../../apps/storefront/src/lib/client.ts');
const axe=require('axe-core');
const product=slug=>catalog.products.find(p=>p.slug===slug);
const wrap=element=>render(React.createElement(StoreProvider,null,element));
const nativeFetch=global.fetch;
test.afterEach(()=>{cleanup();localStorage.clear();window.history.replaceState({},'','/');delete process.env.NEXT_PUBLIC_COMMERCE_API_URL;global.fetch=nativeFetch;});

test('expired or corrupted local drafts do not break shopping',()=>{
 localStorage.setItem('sonoran:broken','not-json');assert.equal(readLocal('broken','fallback'),'fallback');
 localStorage.setItem('sonoran:expired',JSON.stringify({value:'private',expires:Date.now()-1}));assert.equal(readLocal('expired',null),null);
 assert.equal(localStorage.getItem('sonoran:expired'),null);
 writeLocal('good',{text:'sample'});assert.deepEqual(readLocal('good',null),{text:'sample'});
});

test('search, filters and recovery find actual collection products',async()=>{
 wrap(React.createElement(CatalogSearch));
 assert.ok(await screen.findByText(catalog.products.length+' thoughtful gifts'));
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'decanter'}});
 assert.ok(await screen.findByText('2 thoughtful gifts'));
 fireEvent.change(screen.getByLabelText('Material'),{target:{value:'Wood'}});
 assert.ok(await screen.findByText('No gifts found, just yet.'));
 fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));
 assert.ok(await screen.findByText(catalog.products.length+' thoughtful gifts'));
});

test('favorites toggle and survive a new visit',async()=>{
 const r=wrap(React.createElement(ProductCard,{product:product('pet-tags')}));
 const save=await screen.findByRole('button',{name:'Save The very-good-pet tag'});
 fireEvent.click(save);await waitFor(()=>assert.ok(readLocal('favorites',[]).includes('pet-tags')));
 r.unmount();wrap(React.createElement(ProductCard,{product:product('pet-tags')}));
 assert.equal((await screen.findByRole('button',{name:'Unsave The very-good-pet tag'})).getAttribute('aria-pressed'),'true');
});

test('personalization, gift details, and bag survive refresh',async()=>{
 const r=wrap(React.createElement(Customizer,{product:product('makertwist-40oz-tumbler')}));
 await screen.findByText('Start with the right details.');
 fireEvent.click(screen.getByRole('button',{name:'Add your personal touch'}));
 fireEvent.change(screen.getByLabelText(/Name, initials, or message/),{target:{value:'Keep the good days close'}});
 assert.match(document.querySelector('.inscription-preview').textContent,/Keep the good days close/);
 fireEvent.click(screen.getByRole('button',{name:/Finishing touches/}));
 fireEvent.click(screen.getByRole('checkbox',{name:/This is a gift/}));
 fireEvent.change(screen.getByLabelText('Gift message (optional)'),{target:{value:'For your next adventure'}});
 fireEvent.click(screen.getByRole('button',{name:'Add design to bag'}));
 await waitFor(()=>assert.equal(readLocal('cart',[]).length,1));
 assert.equal(readLocal('cart',[])[0].giftMessage,'For your next adventure');
 r.unmount();wrap(React.createElement(Bag));
 assert.ok(await screen.findByText('“Keep the good days close”'));
 assert.ok(screen.getByText(/A gift/));
 assert.equal(screen.queryByText(/order placed/i),null);
});

test('a blank required design is kept out of the bag',async()=>{
 wrap(React.createElement(Customizer,{product:product('makertwist-40oz-tumbler')}));
 await screen.findByText('Start with the right details.');
 fireEvent.click(screen.getByRole('tab',{name:/Finishing touches/}));
 fireEvent.click(screen.getByRole('button',{name:'Add design to bag'}));
 assert.ok(await screen.findByRole('alert'));
 assert.equal(readLocal('cart',[]).length,0);
});

test('each crystal shape has its own listing and only its supported size choices',async()=>{
 const r=wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));
 const size=await screen.findByLabelText('Size');
 assert.equal(screen.queryByLabelText('Crystal shape'),null);
 assert.deepEqual([...size.options].map(o=>o.value),['Small','Medium','Large']);
 assert.match(size.options[0].textContent,/3.2 × 2.8/);
 fireEvent.change(size,{target:{value:'Large'}});
 await waitFor(()=>assert.equal(readLocal('config:photo-crystal-heart',null).options.Size,'Large'));
 r.unmount();wrap(React.createElement(Customizer,{product:product('photo-crystal-prestige')}));
 assert.equal((await screen.findByLabelText('Size')).value,'Small only');
 assert.equal(screen.queryByRole('option',{name:/Large Mantel/}),null);
});

test('old saved crystal designs migrate to the shape listing without losing personalization',async()=>{
 const {parseDesign,emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');
 const old={...emptyDesign('photo-crystal-collection'),text:'Always with us',options:{'Crystal shape':'Heart',Size:'Large'},notes:'Keep this exact inscription'};
 const migrated=parseDesign(old);
 assert.equal(migrated.slug,'photo-crystal-heart');
 assert.equal(migrated.id,old.id);assert.equal(migrated.text,old.text);assert.deepEqual(migrated.options,old.options);
 writeLocal('cart',[old]);writeLocal('config:photo-crystal-collection',old);wrap(React.createElement(Bag));
 assert.ok(await screen.findByText('“Always with us”'));
 assert.equal(readLocal('cart',[])[0].slug,'photo-crystal-heart');
 assert.equal(readLocal('config:photo-crystal-heart',null).text,'Always with us');
});

test('missing service produces a recoverable inquiry error and preserves the form',async()=>{
 wrap(React.createElement(InquiryForm,{kind:'bulk'}));
 fireEvent.change(await screen.findByLabelText('Your idea'),{target:{value:'Twelve engraved boards, individual family names.'}});
 fireEvent.click(screen.getByRole('button',{name:'Add contact details'}));
 fireEvent.change(screen.getByLabelText('Your name'),{target:{value:'Test Person'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'test@example.test'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.submit(document.querySelector('form'));
 assert.match((await screen.findByRole('alert')).textContent,/not connected/);
 assert.equal(screen.getByLabelText('Your name').value,'Test Person');
 fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 await waitFor(()=>assert.equal(readLocal('inquiry:bulk',null).values.details,'Twelve engraved boards, individual family names.'));
});

test('request drafts save only after an explicit save',async()=>{
 wrap(React.createElement(InquiryForm,{kind:'contact'}));
 fireEvent.change(await screen.findByLabelText('Your name'),{target:{value:'Test Person'}});
 assert.equal(readLocal('inquiry:contact',null),null);
 fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 assert.equal(readLocal('inquiry:contact',null).values.name,'Test Person');
});

test('gift finder returns grounded products and permits editing',async()=>{
 wrap(React.createElement(GiftFinder));
 fireEvent.click(await screen.findByRole('button',{name:'A pet person'}));
 fireEvent.click(screen.getByRole('button',{name:'Next little detail'}));
 fireEvent.click(screen.getByRole('button',{name:'Remembrance'}));
 fireEvent.click(screen.getByRole('button',{name:'Next little detail'}));
 fireEvent.click(screen.getByRole('button',{name:'A memory to keep close'}));
 fireEvent.click(screen.getByRole('button',{name:'Find their gifts'}));
 assert.ok(await screen.findByText('Dog bone photo crystal'));
 assert.ok(screen.getByText('A few gifts that feel like them.'));
 fireEvent.click(screen.getByRole('button',{name:'Change your answers'}));
 assert.ok(await screen.findByRole('button',{name:'A pet person'}));
});

test('empty checkout cannot invent an order',async()=>{
 wrap(React.createElement(Checkout));
 assert.ok(await screen.findByText('Your bag needs a little inspiration.'));
 assert.equal(screen.queryByRole('button',{name:'Request reviewed pricing'}),null);
});

test('private record lookup keeps access code out of device storage',async()=>{
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://api.example.test';
 let called=false;global.fetch=async(url,opts)=>{called=true;assert.match(url,/\/v1\/orders\/ord_unit/);assert.equal(opts.headers.Authorization,'Bearer unit-private-code');return new Response(JSON.stringify({error:{message:'The private record could not be opened.'}}),{status:404,headers:{'Content-Type':'application/json'}});};
 wrap(React.createElement(Portal,{kind:'orders'}));
 fireEvent.change(await screen.findByLabelText('Order reference'),{target:{value:'ord_unit'}});
 fireEvent.change(screen.getByLabelText('Private access code'),{target:{value:'unit-private-code'}});
 fireEvent.submit(document.querySelector('form'));
 assert.ok(await screen.findByRole('alert'));assert.equal(called,true);
 assert.ok(!Object.values(localStorage).some(v=>v.includes('unit-private-code')));
});

test('clearing saved work also clears inquiry and configuration drafts',async()=>{
 writeLocal('inquiry:bulk',{values:{name:'Test Person'}});writeLocal('config:pet-tags',{text:'Test Pet'});
 wrap(React.createElement(Saved));
 fireEvent.click(await screen.findByRole('button',{name:'Clear data on this device'}));
 fireEvent.click(screen.getByRole('button',{name:'Clear all saved work'}));
 assert.equal(readLocal('inquiry:bulk',null),null);assert.equal(readLocal('config:pet-tags',null),null);
});

test('core shopping controls have no returned semantic accessibility violations',async()=>{
 wrap(React.createElement('main',null,React.createElement('h1',null,'Shop gifts'),React.createElement(CatalogSearch)));
 await screen.findByText(catalog.products.length+' thoughtful gifts');
 const result=await axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},rules:{'color-contrast':{enabled:false}}});
 assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.length})),[]);
});


test('product content is present in server-rendered HTML before hydration',()=>{
 const html=require('react-dom/server').renderToString(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('makertwist-40oz-tumbler')})));
 assert.match(html,/<h1>The everyday tumbler<\/h1>/);
 assert.match(html,/Start with the right details/);
});

test('personalization tabs support arrow-key navigation',async()=>{
 wrap(React.createElement(Customizer,{product:product('makertwist-40oz-tumbler')}));
 const tab=await screen.findByRole('tab',{name:/Choose your details/});
 fireEvent.keyDown(tab,{key:'ArrowRight'});
 assert.equal(screen.getByRole('tab',{name:/Make it personal/}).getAttribute('aria-selected'),'true');
 assert.equal(document.activeElement.id,'config-tab-1');
});


test('gift finder progress has a valid accessible group role',async()=>{
 wrap(React.createElement('main',null,React.createElement('h1',null,'Gift finder'),React.createElement(GiftFinder)));
 await screen.findByRole('group',{name:'Step 1 of 3'});
 const result=await axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},rules:{'color-contrast':{enabled:false}}});
 assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.length})),[]);
});
