'use client';
import { useState } from 'react';
import { catalog } from '@/lib/catalog';
import ProductCard from '@/components/ProductCard';
export default function CatalogSearch() {
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('');
  const items = catalog.products.filter(p => (!category || p.category===category) && p.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <section aria-label="Reference catalog search">
    <div className="search-controls"><div><label htmlFor="product-search">Search product references</label><input id="product-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try glasses, boards or tumblers" /></div>
    <div><label htmlFor="category-filter">Product family</label><select id="category-filter" value={category} onChange={e=>setCategory(e.target.value)}><option value="">All product families</option>{catalog.categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div></div>
    <p role="status" className="result-count">{items.length} product references</p>
    {items.length ? <div className="product-grid">{items.map(p=><ProductCard key={p.slug} product={p}/>)}</div> : <div className="notice"><h2>No matching references</h2><p>Try another word or clear your filters. Custom requests will have their own workflow.</p><button type="button" onClick={()=>{setQuery('');setCategory('');}}>Clear filters</button></div>}
  </section>;
}
