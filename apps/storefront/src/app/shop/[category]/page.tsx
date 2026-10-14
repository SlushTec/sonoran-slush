import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalog } from '@/lib/catalog';
import ProductCard from '@/components/ProductCard';
export function generateStaticParams(){return catalog.categories.map(c=>({category:c.slug}));}
export default async function CategoryPage({params}:{params:Promise<{category:string}>}){
 const {category}=await params; const item=catalog.categories.find(c=>c.slug===category); if(!item)notFound();
 return <div className="container section"><Link href="/shop">← All gifts</Link><h1>{item.name}</h1><p className="intro">{item.description}</p><div className="product-grid">{catalog.products.filter(p=>p.category===category).map(p=><ProductCard key={p.slug} product={p}/>)}</div></div>;
}
