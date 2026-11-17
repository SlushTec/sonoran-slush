// DOM-level interaction checks. This does not launch a browser or claim device QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<!doctype html><html lang="en"><head><title>Storefront test</title></head><body><div id="test-root"></div></body></html>',{url:'https://review.example.test/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLDialogElement','Node','MutationObserver','localStorage','sessionStorage','location','getComputedStyle']){
 Object.defineProperty(global,key,{value:key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key],configurable:true,writable:true});
}
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = ()=>{};
const React = require('react');
const originalLoad=Module._load,originalResolve=Module._resolveFilename;
Module._load=function(request,parent,main){
 if(request==='next/link')return {__esModule:true,default:React.forwardRef(function Link({href,children,prefetch,...props},ref){return React.createElement('a',{href,ref,...props},children);})};
 if(request==='next/navigation')return {usePathname:()=>location.pathname,useSearchParams:()=>new URLSearchParams(location.search)};
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
test.afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();window.history.replaceState({},'','/');delete process.env.NEXT_PUBLIC_COMMERCE_API_URL;global.fetch=nativeFetch;});

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
 assert.equal(screen.queryByText(/order placed/i) === null,true);
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
 assert.equal(screen.queryByLabelText('Crystal shape') === null,true);
 assert.deepEqual([...size.options].map(o=>o.value),['Small','Medium','Large']);
 assert.match(size.options[0].textContent,/3.2 × 2.8/);
 fireEvent.change(size,{target:{value:'Large'}});
 await waitFor(()=>assert.equal(readLocal('config:photo-crystal-heart',null).options.Size,'Large'));
 r.unmount();wrap(React.createElement(Customizer,{product:product('photo-crystal-prestige')}));
 assert.equal((await screen.findByLabelText('Size')).value,'Small only');
 assert.equal(screen.queryByRole('option',{name:/Large Mantel/}) === null,true);
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
 assert.equal(screen.queryByRole('button',{name:'Request reviewed pricing'}) === null,true);
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

test('supplier review covers every listing without exposing private provenance',()=>{
 const refs=require('../../apps/storefront/src/lib/product-references.json');
 assert.deepEqual(Object.keys(refs).sort(),catalog.products.map(p=>p.slug).sort());
 for(const ref of Object.values(refs)) {
  assert.deepEqual(Object.keys(ref).sort(),['note','status','url']);
  assert.equal(new URL(ref.url).protocol,'https:');
 }
 assert.equal(Object.values(refs).filter(x=>x.status.startsWith('Candidate')).length,17);
 assert.equal(Object.values(refs).filter(x=>x.status.startsWith('Held')).length,1);
 const serialized=JSON.stringify(refs);assert.doesNotMatch(serialized,/native_path|source_paths|wholesale_cost|E:\\\\/);
});

test('care follows the actual product and candidate claims stay qualified',()=>{
 const {infoFor}=require('../../apps/storefront/src/lib/shop.ts');
 for(const p of catalog.products) {
  const info=infoFor(p);
  if(info.care.includes('side for cutting')) assert.ok(['acacia-cutting-boards','bamboo-cutting-board'].includes(p.slug));
 }
 assert.match(infoFor(product('laserette-journal')).care,/microfiber/);
 assert.doesNotMatch(infoFor(product('laserette-journal')).care,/wash/);
 assert.match(infoFor(product('laserette-journal')).description,/refillable/);
 assert.match(infoFor(product('crystal-bases')).care,/Disconnect/);
 assert.equal(infoFor(product('balsa-earrings')).material,'Unverified');
 assert.match(infoFor(product('balsa-earrings')).description,/unfinished basswood/);
 assert.match(JSON.stringify(infoFor(product('whiskey-decanter-26oz-set')).details),/capacity unverified/);
 assert.doesNotMatch(JSON.stringify(infoFor(product('whiskey-decanter-26oz-set')).details),/Lead-free/);
});

test('product page shows candidate reference and no cutting advice on keychains',()=>{
 wrap(React.createElement(Customizer,{product:product('wood-keychain-round')}));
 assert.ok(screen.getByRole('complementary',{name:'Supplier reference'}));
 assert.ok(screen.getByText('Candidate reference — exact blank unverified'));
 assert.equal(screen.getByRole('link',{name:'Supplier reference page'}).href,'https://www.xstron.com/wood-key-chain-blank-laser-engraving-material/');
 assert.doesNotMatch(document.body.textContent,/side for cutting/);
});

test('crystal reference dimensions preserve old selections and distinguish engraving processes',()=>{
 const {infoFor}=require('../../apps/storefront/src/lib/shop.ts');
 const {shapes}=require('../../packages/contracts/crystal-shapes.json');
 assert.equal(shapes.length,13);
 assert.equal(catalog.categories.find(c=>c.slug==='photo-crystals').name,'Photo crystals');
 for(const slug of ['photo-crystal-notched','photo-crystal-circle-ornament']) {
  const shape=shapes.find(s=>s.slug===slug);
  assert.deepEqual(shape.sizes.map(s=>s.value),['Size confirmed during review']);
  assert.match(shape.sizes[0].dimensions,/Supplier/);
 }
 for(const shape of shapes) assert.ok(infoFor(product(shape.slug)).details.some(([k,v])=>k==='Process' && v===shape.process+' subsurface photo engraving'));
 assert.match(infoFor(product('crystal-heart-ornament')).description,/surface engraved/);
});

test('portal dispatcher keeps exactly the three reviewed consumers and public account/admin exports',()=>{
 const portalModule=require('../../apps/storefront/src/components/CustomerPortal.tsx');
 for(const [kind,name] of [['proofs','ProofReviewPortal'],['orders','OrderReviewPortal'],['quotes','QuoteReviewPortal']]){
  const expected=require('../../apps/storefront/src/components/'+name+'.tsx').default;
  assert.equal(portalModule.Portal({kind}).type,expected);
 }
 assert.equal(typeof portalModule.Account,'function');
 assert.equal(portalModule.Admin,require('../../apps/storefront/src/components/StaffWorkspace.tsx').default);
 assert.deepEqual(Object.keys(portalModule).sort(),['Account','Admin','Portal']);
});
test('customer portal source has no unreachable legacy portal or legacy transport authority',()=>{
 const filename=path.join(__dirname,'../../apps/storefront/src/components/CustomerPortal.tsx');
 const source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const identifiers=[];const imports=[];
 function visit(node){if(ts.isIdentifier(node))identifiers.push(node.text);if(ts.isImportDeclaration(node))imports.push(node.moduleSpecifier.text);ts.forEachChild(node,visit);}
 visit(source);
 for(const old of ['LegacyRecordPortal','RecordData','useState','commerce'])assert.equal(identifiers.includes(old),false,old);
 assert.equal(imports.includes('@/lib/client'),false);
 assert.equal(source.parseDiagnostics.length,0);
});

for (const [label, result] of [
 ['null',null],['empty',{}],['array',[]],['missing token',{id:'msg_'+'a'.repeat(32),status:'submitted'}],
 ['wrong kind',{id:'evt_'+'a'.repeat(32),status:'submitted',access_token:'a'.repeat(43)}],
 ['invalid token',{id:'msg_'+'a'.repeat(32),status:'submitted',access_token:'private\nmarker'}],
 ['trailing token newline',{id:'msg_'+'a'.repeat(32),status:'submitted',access_token:'a'.repeat(43)+'\n'}],
 ['trailing id newline',{id:'msg_'+'a'.repeat(32)+'\n',status:'submitted',access_token:'a'.repeat(43)}],
 ['trailing status newline',{id:'msg_'+'a'.repeat(32),status:'submitted\n',access_token:'a'.repeat(43)}],
 ['missing status',{id:'msg_'+'a'.repeat(32),access_token:'a'.repeat(43)}],
]) test('unverified inquiry receipt preserves draft and retry identity: '+label,async()=>{
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://commerce.qa.invalid';
 const calls=[];
 global.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>result};};
 wrap(React.createElement(InquiryForm,{kind:'contact'}));
 fireEvent.change(await screen.findByLabelText('Your name'),{target:{value:'Synthetic Person'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 const saved=localStorage.getItem('sonoran:inquiry:contact');
 fireEvent.submit(document.querySelector('form'));
 assert.match((await screen.findByRole('alert')).textContent,/could not verify.*receipt/i);
 assert.equal(screen.queryAllByText('Your request is with the studio.').length,0);
 assert.equal(localStorage.getItem('sonoran:inquiry:contact'),saved);
 assert.equal(screen.getByLabelText('Your name').value,'Synthetic Person');
 await waitFor(()=>assert.equal(document.querySelector('button[type="submit"]').disabled,false));
 fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>assert.equal(calls.length,2));
 assert.deepEqual(calls[1],calls[0]);
});

test('verified inquiry receipt alone clears saved draft',async()=>{
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://commerce.qa.invalid';
 const id='msg_'+'b'.repeat(32);
 global.fetch=async()=>({ok:true,json:async()=>({id,status:'submitted',access_token:'a'.repeat(43)})});
 wrap(React.createElement(InquiryForm,{kind:'contact'}));
 fireEvent.change(await screen.findByLabelText('Your name'),{target:{value:'Synthetic Person'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 fireEvent.submit(document.querySelector('form'));
 assert.ok(await screen.findByText('Your request is with the studio.'));
 assert.ok(screen.getByText(id));
 assert.ok(localStorage.getItem('sonoran:inquiry:contact') === null);
});

for(const [label,result] of [['empty',{}],['null',null],['wrong kind',{id:'msg_'+'a'.repeat(32),status:'submitted',access_token:'a'.repeat(43)}],['missing token',{id:'quo_'+'a'.repeat(32),status:'submitted'}]]) test('retail quote unverified receipt preserves cart and retry: '+label,async()=>{
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://commerce.qa.invalid';
 const design={id:'synthetic-design',slug:catalog.products[0].slug,text:'Synthetic',secondary:'',font:'',options:{},quantity:1,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-14T00:00:00Z'};
 writeLocal('cart',[design]);
 const calls=[];global.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>result};};
 wrap(React.createElement(Checkout));
 fireEvent.change(await screen.findByLabelText('Full name'),{target:{value:'Synthetic Person'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});
 fireEvent.click(document.querySelector('input[type="checkbox"][required]'));
 const cart=readLocal('cart',[]);
 fireEvent.submit(document.querySelector('form'));
 assert.match((await screen.findByRole('alert')).textContent,/could not verify.*receipt/i);
 assert.equal(screen.queryAllByText('Your request is with the studio.').length,0);
 assert.deepEqual(readLocal('cart',[]),cart);
 assert.equal(screen.getByLabelText('Full name').value,'Synthetic Person');
 await waitFor(()=>assert.equal(document.querySelector('button[type="submit"]').disabled,false));
 fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>assert.equal(calls.length,2));
 assert.deepEqual(calls[1],calls[0]);
});

test('shared receipt projection preserves supported replay status and drops unrelated response fields',()=>{
 const {verifiedReceipt}=require('../../apps/storefront/src/lib/receipt.ts');
 for(const [kind,prefix] of [['retail','quo_'],['bulk','quo_'],['event','evt_'],['contact','msg_']]){
  const receipt={id:prefix+'a'.repeat(32),status:'reviewed',access_token:'b'.repeat(43)};
  assert.deepEqual(verifiedReceipt({...receipt,internal_notes:'excluded',message:'excluded'},kind),receipt);
 }
});

for(const originallySaved of [false,true]) test('inquiry success preserves newer explicit draft saved while request pending: '+originallySaved,async()=>{
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://commerce.qa.invalid';
 let release; const pending=new Promise(resolve=>{release=resolve;});let sent;
 global.fetch=async(url,options)=>{sent=JSON.parse(options.body);await pending;return {ok:true,json:async()=>({id:'msg_'+'a'.repeat(32),status:'submitted',access_token:'b'.repeat(43)})};};
 wrap(React.createElement(InquiryForm,{kind:'contact'}));
 fireEvent.change(await screen.findByLabelText('Your name'),{target:{value:'Earlier draft'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('checkbox'));
 if(originallySaved)fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>assert.equal(sent.name,'Earlier draft'));
 fireEvent.change(screen.getByLabelText('Your name'),{target:{value:'Newer unsent draft'}});
 fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 const newer=localStorage.getItem('sonoran:inquiry:contact');
 release();
 assert.ok(await screen.findByText('Your request is with the studio.'));
 const restored=JSON.parse(localStorage.getItem('sonoran:inquiry:contact'));
 const before=JSON.parse(newer);
 assert.deepEqual(restored.value.values,before.value.values);
 assert.equal(restored.expires,before.expires);
 assert.notEqual(restored.value.request_id,sent.request_id);
 assert.ok(await screen.findByText('A newer saved draft remains on this device. Review it before starting another request.'));
});

for(const variant of ['foreign','malformed','expired','ambiguous']) test('inquiry completion preserves unrelated or uncertain saved draft: '+variant,async()=>{
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://commerce.qa.invalid';
 let release,sent;const pending=new Promise(resolve=>{release=resolve;});
 global.fetch=async(url,options)=>{sent=JSON.parse(options.body);await pending;return {ok:true,json:async()=>variant==='ambiguous'?{}:{id:'msg_'+'a'.repeat(32),status:'submitted',access_token:'b'.repeat(43)}};};
 wrap(React.createElement(InquiryForm,{kind:'contact'}));
 fireEvent.change(await screen.findByLabelText('Your name'),{target:{value:'Earlier draft'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>assert.equal(sent.name,'Earlier draft'));
 fireEvent.change(screen.getByLabelText('Your name'),{target:{value:'New draft'}});
 fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 const saved=JSON.parse(localStorage.getItem('sonoran:inquiry:contact'));
 if(variant==='foreign')saved.value.request_id='foreign-request';
 if(variant==='expired')saved.expires=1;
 const raw=variant==='malformed'?'{broken':JSON.stringify(saved);
 localStorage.setItem('sonoran:inquiry:contact',raw);
 release();
 if(variant==='ambiguous')assert.match((await screen.findByRole('alert')).textContent,/could not verify/);
 else assert.ok(await screen.findByText('Your request is with the studio.'));
 assert.equal(localStorage.getItem('sonoran:inquiry:contact'),raw);
});

test('leaving inquiry before response preserves explicit draft for same-ID recovery',async()=>{
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://commerce.qa.invalid';
 let release;const pending=new Promise(resolve=>{release=resolve;});const calls=[];
 global.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));if(calls.length===1)await pending;return {ok:true,json:async()=>({id:'msg_'+'a'.repeat(32),status:'submitted',access_token:'b'.repeat(43)})};};
 const mounted=wrap(React.createElement(InquiryForm,{kind:'contact'}));
 fireEvent.change(await screen.findByLabelText('Your name'),{target:{value:'Synthetic Person'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 const saved=localStorage.getItem('sonoran:inquiry:contact');
 fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>assert.equal(calls.length,1));
 mounted.unmount();
 await require('@testing-library/react').act(async()=>{release();await pending;});
 assert.equal(localStorage.getItem('sonoran:inquiry:contact'),saved);
 wrap(React.createElement(InquiryForm,{kind:'contact'}));
 assert.equal((await screen.findByLabelText('Your name')).value,'Synthetic Person');
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.submit(document.querySelector('form'));
 assert.ok(await screen.findByText('Your request is with the studio.'));
 assert.equal(calls.length,2);
 assert.deepEqual(calls[1],calls[0]);
 assert.ok(localStorage.getItem('sonoran:inquiry:contact') === null);
});

for(const failure of [false,true])test('previous inquiry kind cannot apply late response to another form: '+failure,async()=>{
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://commerce.qa.invalid';
 let release;const pending=new Promise(resolve=>{release=resolve;});let sent=false;
 global.fetch=async()=>{sent=true;await pending;if(failure)throw Error('late network failure');return {ok:true,json:async()=>({id:'msg_'+'a'.repeat(32),status:'submitted',access_token:'b'.repeat(43)})};};
 const mounted=wrap(React.createElement(InquiryForm,{kind:'contact'}));
 fireEvent.change(await screen.findByLabelText('Your name'),{target:{value:'Old contact'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Save draft on this device'}));
 const saved=localStorage.getItem('sonoran:inquiry:contact');
 fireEvent.submit(document.querySelector('form'));await waitFor(()=>assert.equal(sent,true));
 mounted.rerender(React.createElement(StoreProvider,null,React.createElement(InquiryForm,{kind:'bulk'})));
 fireEvent.click(screen.getByRole('button',{name:'Contact details',exact:true}));
 assert.equal(screen.getByLabelText('Your name').value,'');
 assert.equal(document.querySelector('button[type="submit"]').disabled,false);
 assert.equal(screen.getByRole('checkbox').checked,false);
 await require('@testing-library/react').act(async()=>{release();await pending;});
 assert.equal(localStorage.getItem('sonoran:inquiry:contact'),saved);
 assert.equal(screen.queryAllByText('Your request is with the studio.').length,0);
 assert.equal(screen.queryAllByRole('alert').length,0);
});

test('clear saved work reports denied deletion without claiming privacy cleanup',async()=>{
 writeLocal('inquiry:contact',{values:{name:'Synthetic private draft'},request_id:'synthetic'});
 localStorage.setItem('other-app:keep','unrelated');
 wrap(React.createElement(Saved));
 const button=await screen.findByRole('button',{name:'Clear data on this device'});
 const proto=Object.getPrototypeOf(localStorage), original=proto.removeItem;
 proto.removeItem=function(key){if(key==='sonoran:inquiry:contact')throw new Error('synthetic denial');return original.call(this,key);};
 try{
  fireEvent.click(button);fireEvent.click(screen.getByRole('button',{name:'Clear all saved work'}));
  assert.ok(await screen.findByText(/Some saved data could not be cleared/));
  assert.ok(localStorage.getItem('sonoran:inquiry:contact'));
  assert.equal(localStorage.getItem('other-app:keep'),'unrelated');
  assert.equal(screen.queryAllByText('Saved designs and browsing data cleared from this device.').length,0);
 }finally{proto.removeItem=original;}
});

test('clear saved work detects retained keys and successful explicit retry dismisses warning',async()=>{
 writeLocal('inquiry:bulk',{values:{name:'Synthetic'},request_id:'synthetic'});
 localStorage.setItem('other-app:keep','unrelated');
 wrap(React.createElement(Saved));
 const proto=Object.getPrototypeOf(localStorage), original=proto.removeItem;
 proto.removeItem=function(key){if(key==='sonoran:inquiry:bulk')return;return original.call(this,key);};
 try{
  fireEvent.click(await screen.findByRole('button',{name:'Clear data on this device'}));
  fireEvent.click(screen.getByRole('button',{name:'Clear all saved work'}));
  assert.match((await screen.findByRole('alert')).textContent,/Some saved data could not be cleared/);
  assert.ok(localStorage.getItem('sonoran:inquiry:bulk'));
 }finally{proto.removeItem=original;}
 fireEvent.click(screen.getByRole('button',{name:'Clear data on this device'}));
 fireEvent.click(screen.getByRole('button',{name:'Clear all saved work'}));
 await waitFor(()=>assert.equal(screen.queryAllByRole('alert').length,0));
 assert.ok(!localStorage.getItem('sonoran:inquiry:bulk'));
 assert.equal(localStorage.getItem('other-app:keep'),'unrelated');
 assert.ok(await screen.findByText('Saved designs and browsing data cleared from this device.'));
});

for(const action of ['remove','new-design','unmount']){
 test('pending local photo respects '+action+' rather than reviving old artwork',async()=>{
  const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');
  writeLocal('config:photo-crystal-heart',{...emptyDesign('photo-crystal-heart'),options:{'Crystal shape':'Heart',Size:'Small'},artworkName:'previous.png'});
  const originalBitmap=global.createImageBitmap, originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL;
  let resolveBitmap,started=false,closed=0,urls=0;
  global.createImageBitmap=()=>{started=true;return new Promise(resolve=>{resolveBitmap=resolve;});};
  URL.createObjectURL=()=>{urls++;return 'blob:synthetic-photo';};URL.revokeObjectURL=()=>{};
  try{
   const view=wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));
   fireEvent.click(await screen.findByRole('button',{name:/Add your personal touch/}));
   const file={name:'pending.png',size:32,slice:()=>({arrayBuffer:async()=>Uint8Array.from([137,80,78,71,0,0,0,0,0,0,0,0]).buffer})};
   fireEvent.change(document.querySelector('input[type=file]'),{target:{files:[file]}});
   await waitFor(()=>assert.ok(started));
   if(action==='remove')fireEvent.click(screen.getByRole('button',{name:'Remove artwork'}));
   else if(action==='new-design')fireEvent.click(screen.getByRole('button',{name:'Save & start another design'}));
   else view.unmount();
   await React.act(async()=>{resolveBitmap({width:1000,height:1000,close:()=>closed++});});
   assert.equal(closed,1);assert.equal(urls,0);
   if(action!=='unmount'){
    assert.equal(screen.queryAllByText('pending.png').length,0);
    assert.equal(readLocal('config:photo-crystal-heart',null).artworkName,'');
   }
  }finally{global.createImageBitmap=originalBitmap;URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;}
 });
}

test('current local photo still attaches and its object URL is revoked on removal',async()=>{
 const originalBitmap=global.createImageBitmap, originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL;
 let closed=0;const revoked=[];
 global.createImageBitmap=async()=>({width:1000,height:1000,close:()=>closed++});
 URL.createObjectURL=()=> 'blob:current-photo';URL.revokeObjectURL=url=>revoked.push(url);
 try{
  wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));
  fireEvent.click(await screen.findByRole('button',{name:/Add your personal touch/}));
  fireEvent.change(document.querySelector('input[type=file]'),{target:{files:[{name:'current.png',size:32,slice:()=>({arrayBuffer:async()=>Uint8Array.from([137,80,78,71]).buffer})}]}});
  assert.ok(await screen.findByText('current.png'));assert.equal(closed,1);
  assert.equal(screen.getByAltText('Your local artwork layout').getAttribute('src'),'blob:current-photo');
  fireEvent.click(screen.getByRole('checkbox',{name:'I will add artwork later.'}));
  assert.ok(screen.getByText('current.png'));assert.equal(screen.getByAltText('Your local artwork layout').getAttribute('src'),'blob:current-photo');
  assert.deepEqual(revoked,[]);
  fireEvent.click(screen.getByRole('button',{name:'Remove artwork'}));
  assert.deepEqual(revoked,['blob:current-photo']);assert.equal(screen.queryAllByAltText('Your local artwork layout').length,0);
 }finally{global.createImageBitmap=originalBitmap;URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;}
});
test('cancelled local photo failure cannot replace the newer cleared state',async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');
 writeLocal('config:photo-crystal-heart',{...emptyDesign('photo-crystal-heart'),options:{'Crystal shape':'Heart',Size:'Small'},artworkName:'previous.png'});
 const original=global.createImageBitmap;let rejectBitmap,started=false;
 global.createImageBitmap=()=>{started=true;return new Promise((_,reject)=>{rejectBitmap=reject;});};
 try{
  wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));
  fireEvent.click(await screen.findByRole('button',{name:/Add your personal touch/}));
  fireEvent.change(document.querySelector('input[type=file]'),{target:{files:[{name:'pending.png',size:32,slice:()=>({arrayBuffer:async()=>Uint8Array.from([137,80,78,71]).buffer})}]}});
  await waitFor(()=>assert.ok(started));fireEvent.click(screen.getByRole('button',{name:'Remove artwork'}));
  await React.act(async()=>{rejectBitmap(Error('Stale synthetic decode failure'));});
  assert.equal(screen.queryAllByText('Stale synthetic decode failure').length,0);
  assert.equal(document.querySelector('input[type=file]').disabled,false);
 }finally{global.createImageBitmap=original;}
});

test('choosing artwork later supersedes a pending local photo decode',async()=>{
 const originalBitmap=global.createImageBitmap,originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 let release,started=false,closed=0,urls=0;
 global.createImageBitmap=()=>{started=true;return new Promise(resolve=>{release=resolve;});};
 URL.createObjectURL=()=>{urls++;return 'blob:late-photo';};URL.revokeObjectURL=()=>{};
 try{
  wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));
  fireEvent.click(await screen.findByRole('button',{name:/Add your personal touch/}));
  fireEvent.change(document.querySelector('input[type=file]'),{target:{files:[{name:'pending.png',size:32,slice:()=>({arrayBuffer:async()=>Uint8Array.from([137,80,78,71]).buffer})}]}});
  await waitFor(()=>assert.ok(started));
  fireEvent.click(screen.getByRole('checkbox',{name:'I will add artwork later.'}));
  await React.act(async()=>{release({width:1000,height:1000,close:()=>closed++});});
  assert.equal(screen.getByRole('checkbox',{name:'I will add artwork later.'}).checked,true);
  assert.equal(urls,0);assert.equal(closed,1);
  assert.equal(document.querySelector('input[type=file]').disabled,false);
  fireEvent.click(screen.getByRole('button',{name:/Finishing touches/}));
  fireEvent.click(screen.getByRole('button',{name:'Add design to bag'}));
  await waitFor(()=>assert.equal(readLocal('cart',[]).length,1));
  assert.equal(readLocal('cart',[])[0].artworkName,'');
 }finally{global.createImageBitmap=originalBitmap;URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;}
});

for(const [source,expected] of [['bag','3'],['saved','1'],['unrecognized','1']]){
 test('design edit preserves '+source+' collection precedence',async()=>{
  const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');
  const design={...emptyDesign('makertwist-40oz-tumbler'),id:'synthetic-shared',text:'Synthetic'};
  writeLocal('designs',[design]);writeLocal('cart',[{...design,quantity:3}]);
  window.history.replaceState({},'', '/products/makertwist-40oz-tumbler?design=synthetic-shared'+(source==='saved'?'':'&from='+source));
  wrap(React.createElement(Customizer,{product:product('makertwist-40oz-tumbler')}));
  await waitFor(()=>assert.equal(screen.getByRole('spinbutton',{name:'Quantity'}).value,expected));
 });
}
test('all bag edit links identify bag context without changing saved links',async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');
 const design={...emptyDesign('makertwist-40oz-tumbler'),id:'synthetic-shared',text:'Synthetic'};
 writeLocal('designs',[design]);writeLocal('cart',[design]);
 const v=wrap(React.createElement(Bag));
 await screen.findByRole('link',{name:'Edit design'});
 const edits=[...document.querySelectorAll('a[href*="?design="]')];
 assert.equal(edits.length,3);assert.ok(edits.every(a=>new URL(a.href).searchParams.get('from')==='bag'));
 v.unmount();wrap(React.createElement(Saved));
 assert.equal(new URL((await screen.findByRole('link',{name:'Continue designing'})).href).searchParams.has('from'),false);
});

const attemptAPI=require('../../apps/storefront/src/lib/retail-attempt.ts');
test('retail recovery stores only opaque identity and state and never rotates pending identity',()=>{
 const a=attemptAPI.prepareRetailAttempt();const b=attemptAPI.prepareRetailAttempt(a);
 assert.equal(a.id,b.id);assert.deepEqual(Object.keys(JSON.parse(sessionStorage.getItem('sonoran:retail-attempt'))).sort(),['id','state','version']);
 assert.throws(()=>attemptAPI.clearConfirmedRetailAttempt(a.id));
 attemptAPI.confirmRetailAttempt(a.id);assert.throws(()=>attemptAPI.prepareRetailAttempt());
 attemptAPI.clearConfirmedRetailAttempt(a.id);assert.notEqual(attemptAPI.prepareRetailAttempt().id,a.id);
});
test('retail recovery rejects malformed or unexpectedly removed references without overwrite',()=>{
 sessionStorage.setItem('sonoran:retail-attempt',JSON.stringify({version:1,id:'bad',state:'pending',contact:'must-not-accept'}));
 const raw=sessionStorage.getItem('sonoran:retail-attempt');assert.throws(()=>attemptAPI.prepareRetailAttempt());assert.equal(sessionStorage.getItem('sonoran:retail-attempt'),raw);
 sessionStorage.removeItem('sonoran:retail-attempt');const a=attemptAPI.prepareRetailAttempt();sessionStorage.removeItem('sonoran:retail-attempt');
 assert.throws(()=>attemptAPI.prepareRetailAttempt(a));assert.ok(!sessionStorage.getItem('sonoran:retail-attempt'));
});
test('retail recovery refuses dispatch when tab storage cannot be written',async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');
 writeLocal('cart',[{...emptyDesign('makertwist-40oz-tumbler'),text:'Synthetic'}]);
 process.env.NEXT_PUBLIC_COMMERCE_API_URL='https://commerce.test';let calls=0;global.fetch=async()=>{calls++;return {ok:true,json:async()=>({})};};
 wrap(React.createElement(Checkout));fireEvent.change(await screen.findByLabelText('Full name'),{target:{value:'Synthetic'}});
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'synthetic@example.test'}});
 fireEvent.click(document.querySelector('input[type=checkbox][required]'));
 const proto=Object.getPrototypeOf(sessionStorage),original=proto.setItem;
 proto.setItem=function(k,v){if(this===sessionStorage)throw Error('denied');return original.call(this,k,v);};
 try{fireEvent.click(screen.getByRole('button',{name:'Request reviewed pricing'}));assert.ok(await screen.findByText(/Request recovery storage is unavailable/));assert.equal(calls,0);}
 finally{proto.setItem=original;}
});
test('retail recovery read denial blocks form instead of creating another identity',async()=>{
 const original=global.sessionStorage;global.sessionStorage={getItem:()=>{throw Error('denied');}};
 try{wrap(React.createElement(Checkout));assert.ok(await screen.findByText(/Request recovery storage is unavailable/));assert.equal(screen.queryAllByRole('button',{name:'Request reviewed pricing'}).length,0);}
 finally{global.sessionStorage=original;}
});

test('full bag rejects new designs without saved-work mutation but permits existing updates',async()=>{
 const {useStore}=require('../../apps/storefront/src/components/Store.tsx');
 const base={slug:'makertwist-40oz-tumbler',text:'Synthetic',secondary:'',font:'Classic serif',options:{},quantity:1,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-14'};
 const originals=Array.from({length:100},(_,i)=>({...base,id:'existing-'+i}));
 writeLocal('cart',originals);writeLocal('designs',[{...base,id:'saved-only'}]);
 let observed;
 function Probe(){observed=useStore();return React.createElement('button',{onClick:()=>observed.addToCart({...base,id:'new-design'})},'Add synthetic');}
 wrap(React.createElement(Probe));await waitFor(()=>assert.equal(observed.cart.length,100));
 fireEvent.click(screen.getByRole('button',{name:'Add synthetic'}));
 assert.match(screen.getByRole('status').textContent,/bag is full/);
 assert.deepEqual(observed.cart,originals);assert.deepEqual(observed.designs.map(d=>d.id),['saved-only']);
 const {act}=require('@testing-library/react');
 await act(async()=>observed.addToCart({...originals[0],quantity:3}));
 assert.equal(observed.cart.length,100);assert.equal(observed.cart[0].quantity,3);assert.match(screen.getByRole('status').textContent,/added to your bag/);
 await act(async()=>observed.removeCart('existing-1'));
 fireEvent.click(screen.getByRole('button',{name:'Add synthetic'}));
 assert.equal(observed.cart.length,100);assert.ok(observed.cart.some(d=>d.id==='new-design'));
});

for(const mode of ['healthy','denied','noop','read-denied'])test('design save outcome '+mode+' preserves visit work',async()=>{
 const {useStore}=require('../../apps/storefront/src/components/Store.tsx');let store,result;
 const d={id:'save-probe',slug:'makertwist-40oz-tumbler',text:'Synthetic',secondary:'',font:'Classic serif',options:{},quantity:1,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-14'};
 function Probe(){store=useStore();return React.createElement('button',{onClick:()=>{result=store.saveDesign(d);}},'Save synthetic');}
 wrap(React.createElement(Probe));await waitFor(()=>assert.ok(store.hydrated));
 const proto=Object.getPrototypeOf(localStorage),set=proto.setItem,get=proto.getItem;
 try{
  if(mode==='denied'||mode==='noop')proto.setItem=function(k,v){if(k.startsWith('sonoran:')){if(mode==='denied')throw Error('synthetic denial');return;}return set.call(this,k,v);};
  if(mode==='read-denied')proto.getItem=function(k){if(k.startsWith('sonoran:'))throw Error('synthetic denial');return get.call(this,k);};
  fireEvent.click(screen.getByRole('button',{name:'Save synthetic'}));
  assert.equal(result,mode==='healthy');assert.equal(store.designs[0].text,'Synthetic');
  assert.match(screen.getByRole('status').textContent,mode==='healthy'?/saved on this device/:/visit only/);
  assert.equal(store.storageAvailable,mode==='healthy');
 }finally{proto.setItem=set;proto.getItem=get;}
});

test('switching product never writes the former design under the destination draft key', async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');
 const first={...emptyDesign('pet-tags'),text:'First pet'};
 const second={...emptyDesign('makertwist-40oz-tumbler'),options:{Design:'Name or monogram',Placement:'Single placement'},text:'Second gift'};
 writeLocal('config:pet-tags',first);writeLocal('config:makertwist-40oz-tumbler',second);
 const original=dom.window.Storage.prototype.setItem, writes=[];
 dom.window.Storage.prototype.setItem=function(key,value){if(key.startsWith('sonoran:config:'))writes.push({key,value:JSON.parse(value).value});return original.call(this,key,value);};
 try {
  const view=wrap(React.createElement(Customizer,{product:product('pet-tags')}));
  await waitFor(()=>assert.equal(readLocal('config:pet-tags',null).text,'First pet'));
  writes.length=0;
  view.rerender(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('makertwist-40oz-tumbler')})));
  await waitFor(()=>assert.equal(readLocal('config:makertwist-40oz-tumbler',null).text,'Second gift'));
  assert.ok(writes.length>0);
  for(const write of writes)assert.equal(write.key,'sonoran:config:'+write.value.slug,'every persisted draft must belong to its storage key');
  assert.equal(readLocal('config:pet-tags',null).text,'First pet');
 } finally {dom.window.Storage.prototype.setItem=original;}
});

test('header dialogs expose names and mobile current route matches desktop', () => {
  const oldClose = HTMLDialogElement.prototype.close;
  const oldShow = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  try {
    window.history.replaceState({}, '', '/shop/drinkware');
    const Header = require('../../apps/storefront/src/components/Header.tsx').default;
    wrap(React.createElement(Header));
    fireEvent.click(screen.getByRole('button', { name: 'Search gifts' }));
    assert.ok(screen.getByRole('dialog', { name: 'Find something personal.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    assert.ok(screen.getByRole('dialog', { name: 'Site navigation' }));
    const mobile = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const current = mobile.querySelectorAll('[aria-current="page"]');
    assert.equal(current.length, 1);
    assert.equal(current[0].getAttribute('href'), '/shop');
  } finally {
    HTMLDialogElement.prototype.close = oldClose;
    HTMLDialogElement.prototype.showModal = oldShow;
  }
});

for (const [route, label] of [['/saved', 'Saved designs'], ['/account', 'Your account']]) {
  test('same-route mobile ' + label + ' dismisses navigation repeatedly', () => {
    const oldClose = HTMLDialogElement.prototype.close;
    const oldShow = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    try {
      window.history.replaceState({}, '', route);
      const Header = require('../../apps/storefront/src/components/Header.tsx').default;
      wrap(React.createElement(Header));
      for (let i = 0; i < 2; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
        const dialog = screen.getByRole('dialog', { name: 'Site navigation' });
        const link = Array.from(dialog.querySelectorAll('a')).find(a => a.getAttribute('href') === route);
        link.addEventListener("click", event => event.preventDefault(), { once: true });
        fireEvent.click(link);
        assert.equal(dialog.hasAttribute('open'), false);
        assert.equal(location.pathname, route);
      }
    } finally {
      HTMLDialogElement.prototype.close = oldClose;
      HTMLDialogElement.prototype.showModal = oldShow;
    }
  });
}

test('header shopping bag label matches visible quantity through changes and removal', async () => {
  const oldClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  try {
    const Header = require('../../apps/storefront/src/components/Header.tsx').default;
    const base = {slug:'makertwist-40oz-tumbler',text:'Synthetic',secondary:'',font:'Classic serif',options:{},quantity:3,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-16'};
    writeLocal('cart', [{...base,id:'count-one'}, {...base,id:'count-two',quantity:2}]);
    wrap(React.createElement(React.Fragment,null,React.createElement(Header),React.createElement(Bag)));
    const badge = () => document.querySelector('.header-tools a[href="/cart"]');
    await waitFor(() => assert.equal(badge().textContent, '5'));
    assert.equal(badge().getAttribute('aria-label'), 'Shopping bag (5)');
    fireEvent.click(screen.getAllByRole('button', {name:/Increase quantity for/})[0]);
    assert.equal(badge().getAttribute('aria-label'), 'Shopping bag (6)');
    assert.equal(badge().textContent, '6');
    fireEvent.click(screen.getAllByRole('button', {name:'Remove',exact:true})[0]);
    assert.equal(badge().getAttribute('aria-label'), 'Shopping bag (2)');
    fireEvent.click(screen.getByRole('button', {name:'Remove',exact:true}));
    assert.equal(badge().getAttribute('aria-label'), 'Shopping bag');
    assert.ok(badge().querySelector('.count-dot') === null, 'empty bag has no count badge');
  } finally { HTMLDialogElement.prototype.close = oldClose; }
});


test('saved design capacity preserves acknowledged drafts and permits explicit recovery',async()=>{
 const {useStore}=require('../../apps/storefront/src/components/Store.tsx');
 const base={slug:'makertwist-40oz-tumbler',text:'Synthetic',secondary:'',font:'Classic serif',options:{},quantity:1,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-17'};
 const originals=Array.from({length:100},(_,i)=>({...base,id:'kept-'+i}));writeLocal('designs',originals);
 let observed,result;const current={...base,id:'new-design',text:'Exact caf\u00e9\nnew work'};
 function Probe(){observed=useStore();return React.createElement('button',{onClick:()=>{result=observed.saveDesign(current);}},'Save synthetic capacity');}
 wrap(React.createElement(Probe));await waitFor(()=>assert.equal(observed.designs.length,100));
 const raw=localStorage.getItem('sonoran:designs');
 fireEvent.click(screen.getByRole('button',{name:'Save synthetic capacity'}));
 assert.equal(result,false);assert.deepEqual(observed.designs,originals);assert.equal(localStorage.getItem('sonoran:designs'),raw);
 assert.match(screen.getByRole('status').textContent,/saved designs.*full/i);assert.equal(current.text,'Exact caf\u00e9\nnew work');
 fireEvent.click(screen.getByRole('button',{name:'Save synthetic capacity'}));assert.deepEqual(observed.designs,originals);
 const {act}=require('@testing-library/react');await act(async()=>{result=observed.saveDesign({...originals[50],text:'Updated existing'});});
 assert.equal(result,true);assert.equal(observed.designs.length,100);assert.equal(observed.designs[0].text,'Updated existing');assert.deepEqual(new Set(observed.designs.map(d=>d.id)),new Set(originals.map(d=>d.id)));
 await act(async()=>observed.removeDesign('kept-1'));fireEvent.click(screen.getByRole('button',{name:'Save synthetic capacity'}));
 assert.equal(result,true);assert.equal(observed.designs.length,100);assert.equal(observed.designs[0].text,current.text);assert.equal(observed.designs.some(d=>d.id==='kept-1'),false);
});

test('bag addition preserves full saved collection and permits existing saved update',async()=>{
 const {useStore}=require('../../apps/storefront/src/components/Store.tsx'),{act}=require('@testing-library/react');
 const base={slug:'makertwist-40oz-tumbler',text:'Synthetic',secondary:'',font:'Classic serif',options:{},quantity:1,notes:'',artworkName:'',gift:false,giftMessage:'',updated:'2026-11-17'};
 const originals=Array.from({length:100},(_,i)=>({...base,id:'kept-'+i}));writeLocal('designs',originals);
 let observed;function Probe(){observed=useStore();return null;}wrap(React.createElement(Probe));await waitFor(()=>assert.equal(observed.designs.length,100));
 await act(async()=>observed.addToCart({...base,id:'new-bag',text:'New bag work'}));assert.deepEqual(observed.designs,originals);assert.equal(observed.cart[0].text,'New bag work');assert.match(screen.getByRole('status').textContent,/saved designs are full/);
 assert.deepEqual(readLocal('designs',[]),originals);
 await act(async()=>observed.addToCart({...originals[50],text:'Edited existing'}));assert.equal(observed.designs.length,100);assert.equal(observed.designs[0].text,'Edited existing');assert.deepEqual(new Set(observed.designs.map(d=>d.id)),new Set(originals.map(d=>d.id)));
});

function legacyOptionDraft(){const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');return {...emptyDesign('photo-crystal-heart'),id:'old-options',text:'Exact caf\u00e9 words',quantity:3,notes:'Keep original notes',options:{'Crystal shape':'Wrong old shape',Size:'Retired large'},gift:true,giftMessage:'Original gift'};}
test('restored invalid options wait for explicit confirmation without overwriting original config',async()=>{
 const old=legacyOptionDraft();writeLocal('config:'+old.slug,old);const raw=localStorage.getItem('sonoran:config:'+old.slug);wrap(React.createElement(Customizer,{product:product(old.slug)}));
 await screen.findByRole('heading',{name:'Review changed choices'});assert.equal(localStorage.getItem('sonoran:config:'+old.slug),raw);
 assert.ok(screen.getByText('Retired large',{exact:true}));assert.ok(screen.getByText('Wrong old shape',{exact:true}));
 for(const name of ['Save this design for later','Save & start another design']){const b=screen.getByRole('button',{name});assert.equal(b.disabled,true);fireEvent.click(b);}
 fireEvent.click(screen.getByRole('tab',{name:/Finishing touches/}));assert.equal(screen.getByRole('button',{name:'Add design to bag'}).disabled,true);assert.deepEqual(readLocal('cart',[]),[]);assert.deepEqual(readLocal('designs',[]),[]);
 fireEvent.click(screen.getByRole('tab',{name:/Make it personal/}));fireEvent.change(screen.getByLabelText(/Inscription \(optional\)/),{target:{value:'New unsaved words'}});assert.equal(localStorage.getItem('sonoran:config:'+old.slug),raw);
 cleanup();wrap(React.createElement(Customizer,{product:product(old.slug)}));await screen.findByRole('heading',{name:'Review changed choices'});assert.equal(localStorage.getItem('sonoran:config:'+old.slug),raw);
 fireEvent.change(screen.getByLabelText('Size'),{target:{value:'Large'}});fireEvent.click(screen.getByRole('button',{name:'Use these current choices'}));
 await waitFor(()=>assert.equal(readLocal('config:'+old.slug,null).options.Size,'Large'));const saved=readLocal('config:'+old.slug,null);assert.equal(saved.text,old.text);assert.equal(saved.quantity,3);assert.equal(saved.notes,old.notes);assert.equal(saved.giftMessage,old.giftMessage);assert.equal(saved.options['Crystal shape'],'Heart');assert.deepEqual(readLocal('designs',[]),[]);
});
test('named saved draft and product transition preserve originals until deliberate save',async()=>{
 const old=legacyOptionDraft();writeLocal('designs',[old]);window.history.replaceState({},'', '/products/'+old.slug+'?design='+old.id);
 const r=wrap(React.createElement(Customizer,{product:product(old.slug)}));await screen.findByRole('heading',{name:'Review changed choices'});assert.deepEqual(readLocal('designs',[]),[old]);
 fireEvent.click(screen.getByRole('button',{name:'Use these current choices'}));assert.deepEqual(readLocal('designs',[]),[old]);fireEvent.click(screen.getByRole('button',{name:'Save this design for later'}));assert.equal(readLocal('designs',[])[0].options['Crystal shape'],'Heart');
 window.history.replaceState({},'','/products/photo-crystal-prestige');r.rerender(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('photo-crystal-prestige')})));await waitFor(()=>assert.equal(screen.getByLabelText('Size').value,'Small only'));assert.equal(screen.queryAllByRole('heading',{name:'Review changed choices'}).length,0);assert.equal(readLocal('config:photo-crystal-prestige',null).slug,'photo-crystal-prestige');
});

for(const index of [0,1,2])test('saved removal retains keyboard position index '+index,async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');const rows=[0,1,2].map(i=>({...emptyDesign('pet-tags'),id:'focus-'+i,text:'Draft '+i}));writeLocal('designs',rows);wrap(React.createElement(Saved));
 let buttons=await screen.findAllByRole('button',{name:'Remove',exact:true});buttons[index].focus();fireEvent.click(buttons[index]);buttons=screen.getAllByRole('button',{name:'Remove',exact:true});assert.equal(document.activeElement===buttons[Math.min(index,1)],true);assert.deepEqual(readLocal('designs',[]).map(d=>d.id),rows.filter((_,i)=>i!==index).map(d=>d.id));
 while(buttons.length){const target=buttons.indexOf(document.activeElement);fireEvent.click(buttons[target]);buttons=screen.queryAllByRole('button',{name:'Remove',exact:true});if(buttons.length)assert.equal(document.activeElement===buttons[Math.min(target,buttons.length-1)],true);}
 assert.equal(document.activeElement===screen.getByRole('link',{name:'Explore the collection'}),true);assert.deepEqual(readLocal('designs',[]),[]);
});

for(const mode of ['missing','wrong-product','malformed','no-current'])test('stale requested design requires explicit recovery '+mode,async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');const current={...emptyDesign('pet-tags'),id:'current-kept',text:'Keep current words',notes:'Keep notes'};
 if(mode!=='no-current')writeLocal('config:pet-tags',current);const raw=localStorage.getItem('sonoran:config:pet-tags');
 if(mode==='wrong-product')writeLocal('designs',[{...emptyDesign('makertwist-40oz-tumbler'),id:'requested',text:'Other product'}]);
 if(mode==='malformed')writeLocal('designs',[{...emptyDesign('pet-tags'),id:'requested',text:'Bad',quantity:0}]);
 window.history.replaceState({},'','/products/pet-tags?design=requested&from=bag');wrap(React.createElement(Customizer,{product:product('pet-tags')}));
 await screen.findByRole('heading',{name:'This requested design is unavailable'});assert.equal(localStorage.getItem('sonoran:config:pet-tags'),raw);
 assert.equal(screen.queryAllByRole('button',{name:/Save|Add design to bag/}).length,0);assert.equal(document.querySelectorAll('input[type=file]').length,0);
 assert.equal(screen.queryAllByRole('link',{name:'Recover current draft'}).length,mode==='no-current'?0:1);
 if(mode!=='no-current')assert.equal(screen.getByRole('link',{name:'Recover current draft'}).getAttribute('href'),'/products/pet-tags');
 const named=readLocal('designs',[]),bag=readLocal('cart',[]);
 cleanup();wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('heading',{name:'This requested design is unavailable'});assert.equal(localStorage.getItem('sonoran:config:pet-tags'),raw);
 fireEvent.click(screen.getByRole('button',{name:'Start a new design'}));await screen.findByRole('button',{name:'Add your personal touch'});assert.equal(readLocal('config:pet-tags',null).text,'');assert.notEqual(readLocal('config:pet-tags',null).id,current.id);assert.deepEqual(readLocal('designs',[]),named);assert.deepEqual(readLocal('cart',[]),bag);
});
test('valid requested design preserves precedence and stale product recovery ownership',async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');const current={...emptyDesign('pet-tags'),id:'current',text:'Current'},selected={...current,id:'selected',text:'Selected'};
 writeLocal('config:pet-tags',current);writeLocal('designs',[selected]);window.history.replaceState({},'','/products/pet-tags?design=selected');
 const view=wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Add your personal touch'});assert.equal(readLocal('config:pet-tags',null).text,'Selected');
 view.rerender(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('photo-crystal-heart')})));await screen.findByRole('heading',{name:'This requested design is unavailable'});assert.equal(readLocal('config:photo-crystal-heart',null)===null,true);
 view.rerender(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('pet-tags')})));await screen.findByRole('button',{name:'Add your personal touch'});assert.equal(screen.queryAllByRole('heading',{name:'This requested design is unavailable'}).length,0);assert.equal(readLocal('config:pet-tags',null).text,'Selected');
});

test('server rendered personalization remains visible but disabled until restoration',()=>{
 const html=require('react-dom/server').renderToString(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('makertwist-40oz-tumbler')})));
 assert.match(html,/<h1>The everyday tumbler<\/h1>/);assert.match(html,/<fieldset disabled="" aria-label="Personalization controls"/);
});

for(const invalid of ['1.5','499.5'])test('fractional quantity preserves acknowledged draft '+invalid,async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');const original={...emptyDesign('pet-tags'),id:'whole-quantity',text:'Exact words',notes:'Keep notes',quantity:3,options:{Design:'Name or monogram',Placement:'Single placement'}};
 writeLocal('config:pet-tags',original);let mounted=wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Add your personal touch'});
 const raw=localStorage.getItem('sonoran:config:pet-tags');fireEvent.change(screen.getByRole('spinbutton'),{target:{value:invalid}});
 assert.match(screen.getByRole('alert').textContent,/whole-number quantity/);assert.equal(screen.getByRole('spinbutton').value,'3');assert.equal(localStorage.getItem('sonoran:config:pet-tags'),raw);
 mounted.unmount();mounted=wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Add your personal touch'});assert.deepEqual(readLocal('config:pet-tags',null),original);
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'4'}});await waitFor(()=>assert.equal(readLocal('config:pet-tags',null).quantity,4));assert.equal(readLocal('config:pet-tags',null).text,original.text);assert.equal(screen.queryAllByRole('alert').length,0);
});
test('whole quantity keeps existing blank and range behavior',async()=>{
 wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Add your personal touch'});
 for(const [input,expected] of [['7',7],['501',500],['0',1],['-2',1],['',1]]){fireEvent.change(screen.getByRole('spinbutton'),{target:{value:input}});await waitFor(()=>assert.equal(readLocal('config:pet-tags',null).quantity,expected));}
});

for(const index of [0,1,2])test('saved favorite removal restores position '+index,async()=>{
 writeLocal('favorites',['pet-tags','pet-bowls','stainless-pendants']);wrap(React.createElement(Saved));fireEvent.click(await screen.findByRole('button',{name:'Favorite gifts (3)'}));
 const buttons=screen.getAllByRole('button',{name:/^Unsave /});buttons[index].focus();fireEvent.click(buttons[index]);
 const remaining=screen.getAllByRole('button',{name:/^Unsave /});assert.equal(document.activeElement===remaining[Math.min(index,1)],true);assert.equal(readLocal('favorites',[]).length,2);
 while(screen.queryAllByRole('button',{name:/^Unsave /}).length){const button=screen.getAllByRole('button',{name:/^Unsave /})[0];button.focus();fireEvent.click(button);}
 assert.equal(document.activeElement===screen.getByRole('link',{name:'Find a favorite'}),true);assert.deepEqual(readLocal('favorites',[]),[]);
});
test('ordinary catalog favorite keeps its existing focused control',async()=>{
 wrap(React.createElement(ProductCard,{product:product('pet-tags')}));const button=await screen.findByRole('button',{name:'Save The very-good-pet tag'});button.focus();fireEvent.click(button);assert.equal(document.activeElement===button,true);assert.equal(button.getAttribute('aria-pressed'),'true');fireEvent.click(button);assert.equal(document.activeElement===button,true);assert.equal(button.getAttribute('aria-pressed'),'false');
});


test('customizer step buttons preserve keyboard context without changing draft',async()=>{
 wrap(React.createElement(Customizer,{product:product('pet-tags')}));const first=await screen.findByRole('button',{name:'Add your personal touch'});const raw=localStorage.getItem('sonoran:config:pet-tags');
 first.focus();fireEvent.click(first);assert.equal(document.activeElement===screen.getByRole('tab',{selected:true}),true);assert.equal(document.activeElement.id,'config-tab-1');
 const actions=[['Back',0],['Add your personal touch',1],['Finishing touches',2],['Edit personalization',1]];
 for(const [name,index] of actions){const button=screen.getByRole('button',{name,exact:true});button.focus();fireEvent.click(button);assert.equal(document.activeElement===screen.getByRole('tab',{selected:true}),true);assert.equal(document.activeElement.id,'config-tab-'+index);assert.equal(localStorage.getItem('sonoran:config:pet-tags'),raw);}
});

for(const step of [0,1,2])test('confirmed current options return focus to current step '+step,async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');writeLocal('config:photo-crystal-heart',{...emptyDesign('photo-crystal-heart'),id:'review-focus',text:'Keep words',options:{'Crystal shape':'Heart',Size:'Retired'}});
 wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));const confirm=await screen.findByRole('button',{name:'Use these current choices'});fireEvent.click(document.getElementById('config-tab-'+step));confirm.focus();fireEvent.click(confirm);
 assert.equal(screen.queryAllByRole('button',{name:'Use these current choices'}).length,0);assert.equal(document.activeElement===document.getElementById('config-tab-'+step),true);assert.equal(document.activeElement.getAttribute('aria-selected'),'true');assert.equal(readLocal('config:photo-crystal-heart',{}).text,'Keep words');assert.deepEqual(readLocal('designs',[]),[]);
});
test('pending option review mount and remount do not steal focus',async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');writeLocal('config:photo-crystal-heart',{...emptyDesign('photo-crystal-heart'),id:'review-focus',options:{'Crystal shape':'Heart',Size:'Retired'}});const outside=document.createElement('button');outside.textContent='Outside focus';document.body.appendChild(outside);outside.focus();
 try{let mounted=wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));await screen.findByRole('button',{name:'Use these current choices'});assert.equal(document.activeElement===outside,true);mounted.unmount();mounted=wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));await screen.findByRole('button',{name:'Use these current choices'});assert.equal(document.activeElement===outside,true);}finally{outside.remove();}
});

for(const current of [false,true])test('explicit stale start focuses only its new editor '+current,async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');if(current)writeLocal('config:pet-tags',{...emptyDesign('pet-tags'),id:'old-current',text:'Keep until choice'});
 window.history.replaceState({},'','/products/pet-tags?design=missing');const outside=document.createElement('button');document.body.appendChild(outside);outside.focus();
 try{let view=wrap(React.createElement(Customizer,{product:product('pet-tags')}));
 for(let round=0;round<2;round++){const start=await screen.findByRole('button',{name:'Start a new design'});assert.equal(document.activeElement===outside,true);const before=readLocal('config:pet-tags',null);start.focus();fireEvent.click(start);
 assert.equal(document.activeElement===document.getElementById('config-tab-0'),true);assert.equal(document.activeElement.getAttribute('aria-selected'),'true');assert.notEqual(readLocal('config:pet-tags',{}).id,before?.id);assert.deepEqual(readLocal('designs',[]),[]);assert.deepEqual(readLocal('cart',[]),[]);
 const raw=localStorage.getItem('sonoran:config:pet-tags');view.unmount();outside.focus();view=wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Start a new design'});assert.equal(localStorage.getItem('sonoran:config:pet-tags'),raw);assert.equal(document.activeElement===outside,true);}
 }finally{outside.remove();}
});
for(const interrupt of ['unmount','product'])test('stale start focus intent canceled by '+interrupt,async()=>{
 const {act}=require('@testing-library/react');window.history.replaceState({},'','/products/pet-tags?design=missing');const outside=document.createElement('button');document.body.appendChild(outside);
 try{const view=wrap(React.createElement(Customizer,{product:product('pet-tags')}));const start=await screen.findByRole('button',{name:'Start a new design'});outside.focus();
 act(()=>{fireEvent.click(start);if(interrupt==='unmount')view.unmount();else{window.history.replaceState({},'','/products/pet-bowls');view.rerender(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('pet-bowls')})));}});
 if(interrupt==='unmount'){window.history.replaceState({},'','/products/pet-tags');wrap(React.createElement(Customizer,{product:product('pet-tags')}));}
 await screen.findByRole('button',{name:'Add your personal touch'});assert.equal(document.activeElement===outside,true);
 }finally{outside.remove();}
});
test('ordinary editor hydration does not request stale-start focus',async()=>{
 const outside=document.createElement('button');document.body.appendChild(outside);outside.focus();try{wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Add your personal touch'});assert.equal(document.activeElement===outside,true);}finally{outside.remove();}
});

for(const slug of ['pet-tags','photo-crystal-heart'])test('validation rejection returns keyboard context '+slug,async()=>{
 wrap(React.createElement(Customizer,{product:product(slug)}));await screen.findByRole('button',{name:'Add your personal touch'});
 const raw=localStorage.getItem('sonoran:config:'+slug);
 for(let attempt=0;attempt<2;attempt++){fireEvent.click(document.getElementById('config-tab-2'));const add=screen.getByRole('button',{name:'Add design to bag'});add.focus();fireEvent.click(add);
 assert.equal(document.activeElement===document.getElementById('config-tab-1'),true);assert.equal(document.activeElement.getAttribute('aria-selected'),'true');assert.match(screen.getByRole('alert').textContent,slug==='pet-tags'?/Add a name or message/:/Add a local photo/);assert.deepEqual(readLocal('cart',[]),[]);assert.equal(localStorage.getItem('sonoran:config:'+slug),raw);}
 if(slug==='pet-tags')fireEvent.change(screen.getByLabelText(/Name, initials, or message/),{target:{value:'Ready words'}});
 else fireEvent.click(screen.getByLabelText('I will add artwork later.'));
 fireEvent.click(screen.getByRole('button',{name:'Finishing touches',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Add design to bag'}));
 assert.equal(readLocal('cart',[]).length,1);assert.equal(readLocal('cart',[])[0].slug,slug);if(slug==='pet-tags')assert.equal(readLocal('cart',[])[0].text,'Ready words');
});

for(const mode of ['retained','loaded','pending'])test('artwork removal restores stable personalization focus: '+mode,async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');
 writeLocal('config:photo-crystal-heart',{...emptyDesign('photo-crystal-heart'),text:'Keep my words',options:{'Crystal shape':'Heart',Size:'Small'},artworkName:mode==='loaded'?'':'previous.png'});
 const originalBitmap=global.createImageBitmap,originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 let release,started=false,closed=0,created=0;const revoked=[];
 global.createImageBitmap=()=>{started=true;return mode==='pending'?new Promise(resolve=>{release=resolve;}):Promise.resolve({width:1000,height:1000,close:()=>closed++});};
 URL.createObjectURL=()=>{created++;return 'blob:removal-focus';};URL.revokeObjectURL=url=>revoked.push(url);
 try{
  wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));
  fireEvent.click(await screen.findByRole('button',{name:/Add your personal touch/}));
  if(mode!=='retained'){
   fireEvent.change(document.getElementById('artwork'),{target:{files:[{name:'current.png',size:32,slice:()=>({arrayBuffer:async()=>Uint8Array.from([137,80,78,71]).buffer})}]}});
   if(mode==='pending'){await waitFor(()=>assert.ok(started));assert.equal(document.getElementById('artwork').disabled,true);}
   else await screen.findByText('current.png');
  }
  const before=readLocal('config:photo-crystal-heart',{}),remove=screen.getByRole('button',{name:'Remove artwork'});remove.focus();fireEvent.click(remove);
  assert.equal(document.activeElement===document.getElementById('config-tab-1'),true);
  assert.equal(document.getElementById('config-tab-1').getAttribute('aria-selected'),'true');
  assert.equal(document.getElementById('artwork').disabled,false);
  if(mode==='pending')await React.act(async()=>{release({width:1000,height:1000,close:()=>closed++});});
  assert.equal(screen.queryAllByRole('button',{name:'Remove artwork'}).length,0);
  assert.equal(screen.queryAllByAltText('Your local artwork layout').length,0);
  const after=readLocal('config:photo-crystal-heart',{});assert.equal(after.artworkName,'');const {artworkName:oldName,updated:oldUpdated,...oldFields}=before,{artworkName:newName,updated:newUpdated,...newFields}=after;assert.deepEqual(newFields,oldFields);
  assert.equal(document.activeElement===document.getElementById('config-tab-1'),true);
  assert.equal(created,mode==='loaded'?1:0);assert.equal(closed,mode==='retained'?0:1);assert.deepEqual(revoked,mode==='loaded'?['blob:removal-focus']:[]);
 }finally{global.createImageBitmap=originalBitmap;URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;}
});
test('artwork removal focus has no mount or remount side effect',async()=>{
 const sentinel=document.createElement('button');sentinel.textContent='Outside focus';document.body.append(sentinel);sentinel.focus();
 try{for(let i=0;i<2;i++){const view=wrap(React.createElement(Customizer,{product:product('photo-crystal-heart')}));await screen.findByRole('button',{name:/Add your personal touch/});assert.equal(document.activeElement===sentinel,true);view.unmount();}}finally{sentinel.remove();}
});

for(const mode of ['throw','silent','readback'])test('current config persistence disclosure: '+mode,async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');const key='sonoran:config:pet-tags';writeLocal('config:pet-tags',{...emptyDesign('pet-tags'),text:'Previous persisted words'});
 const view=wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Add your personal touch'});fireEvent.click(document.getElementById('config-tab-1'));const raw=localStorage.getItem(key);
 const proto=Object.getPrototypeOf(localStorage),set=proto.setItem,get=proto.getItem;let blocked=true;
 try{
  proto.setItem=function(k,v){if(k===key&&blocked){if(mode==='throw')throw Error('synthetic quota');if(mode==='silent')return;}return set.call(this,k,v);};
  proto.getItem=function(k){if(k===key&&blocked&&mode==='readback')throw Error('synthetic read denial');return get.call(this,k);};
  fireEvent.change(screen.getByLabelText(/Name, initials, or message/),{target:{value:'New unsaved words'}});
  assert.match(document.querySelector('.privacy-caption').textContent,/could not be verified/);assert.equal(screen.getByLabelText(/Name, initials, or message/).value,'New unsaved words');if(mode!=='readback')assert.equal(get.call(localStorage,key),raw);
  fireEvent.click(screen.getByRole('button',{name:'Save this design for later'}));assert.match(screen.getByRole('status').textContent,/Design saved on this device/);assert.match(document.querySelector('.privacy-caption').textContent,/could not be verified/);
  blocked=false;fireEvent.change(screen.getByLabelText(/Name, initials, or message/),{target:{value:'Verified later edit'}});assert.match(document.querySelector('.privacy-caption').textContent,/Current draft saved/);assert.equal(readLocal('config:pet-tags',{}).text,'Verified later edit');
  blocked=true;fireEvent.change(screen.getByLabelText(/Name, initials, or message/),{target:{value:'Newest unverified edit'}});assert.match(document.querySelector('.privacy-caption').textContent,/could not be verified/);
  blocked=false;view.unmount();wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Add your personal touch'});fireEvent.click(document.getElementById('config-tab-1'));assert.equal(screen.getByLabelText(/Name, initials, or message/).value,mode==='readback'?'Newest unverified edit':'Verified later edit');assert.match(document.querySelector('.privacy-caption').textContent,/Current draft saved/);
 }finally{proto.setItem=set;proto.getItem=get;}
});
test('current config persistence status follows product and skipped review ownership',async()=>{
 const {emptyDesign}=require('../../apps/storefront/src/components/Store.tsx');writeLocal('config:pet-tags',{...emptyDesign('pet-tags'),text:'Pet words'});
 const legacy={...emptyDesign('photo-crystal-heart'),text:'Keep review words',options:{'Crystal shape':'Heart',Size:'Retired'}};writeLocal('config:photo-crystal-heart',legacy);const original=localStorage.getItem('sonoran:config:photo-crystal-heart');
 const view=wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('button',{name:'Add your personal touch'});assert.match(document.querySelector('.privacy-caption').textContent,/Current draft saved/);
 view.rerender(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('photo-crystal-heart')})));await screen.findByRole('heading',{name:'Review changed choices'});assert.match(document.querySelector('.privacy-caption').textContent,/not saved until you confirm/);assert.equal(localStorage.getItem('sonoran:config:photo-crystal-heart'),original);
 const proto=Object.getPrototypeOf(localStorage),set=proto.setItem;try{proto.setItem=function(k,v){if(k==='sonoran:config:photo-crystal-heart')return;return set.call(this,k,v);};fireEvent.click(screen.getByRole('button',{name:'Use these current choices'}));assert.match(document.querySelector('.privacy-caption').textContent,/could not be verified/);assert.equal(localStorage.getItem('sonoran:config:photo-crystal-heart'),original);
 view.rerender(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('pet-tags')})));await screen.findByRole('button',{name:'Add your personal touch'});assert.match(document.querySelector('.privacy-caption').textContent,/Current draft saved/);
 }finally{proto.setItem=set;}
});
test('current config storage is not claimed before hydration or for unavailable design',async()=>{
 const html=require('react-dom/server').renderToString(React.createElement(StoreProvider,null,React.createElement(Customizer,{product:product('pet-tags')})));assert.match(html,/Current draft storage has not yet been verified/);assert.equal(html.includes('Current draft saved'),false);
 window.history.replaceState({},'','/products/pet-tags?design=absent');wrap(React.createElement(Customizer,{product:product('pet-tags')}));await screen.findByRole('heading',{name:'This requested design is unavailable'});assert.equal(document.querySelector('.privacy-caption')===null,true);
});
