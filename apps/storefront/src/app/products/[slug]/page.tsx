import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalog } from '@/lib/catalog';
export function generateStaticParams(){return catalog.products.map(p=>({slug:p.slug}));}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const product=catalog.products.find(p=>p.slug===slug);if(!product)notFound();
 const family=catalog.categories.find(c=>c.slug===product.category);
 return <div className="container section"><Link href={'/shop/'+product.category}>← {family?.name}</Link><div className="product-detail"><div className="asset-placeholder large"><span>Approved product photography pending</span></div><section><p className="eyebrow">Reference product</p><h1>{product.name}</h1><p>{family?.description}</p><div className="notice"><h2>Configuration is not enabled yet</h2><p>Pricing, dimensions, options, availability and production timing need approved data. No price or stock is being implied by this preview.</p></div><button type="button" disabled>Purchasing not yet enabled</button><p className="status-label">No payment or personal information is collected.</p><Link href="/custom-orders">Explore the custom-order workflow</Link></section></div></div>;
}
