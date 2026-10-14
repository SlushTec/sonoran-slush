import Link from 'next/link';
import { notFound } from 'next/navigation';
import routes from '@/lib/route-content.json';
export function generateStaticParams(){return Object.keys(routes).map(p=>({section:p.split('/')}));}
export default async function InformationPage({params}:{params:Promise<{section:string[]}>}){
 const {section}=await params;const path=section.join('/');if(!(path in routes))notFound();
 const content=routes[path as keyof typeof routes];
 return <div className="container section narrow"><p className="eyebrow">Native experience foundation</p><h1>{content.title}</h1><p className="intro">{content.description}</p><h2>What this experience will cover</h2><ul className="topic-list">{content.topics.map(t=><li key={t}>{t}</li>)}</ul><div className="notice"><h2>Current status</h2><p>{content.status}</p></div>{path==='help'&&<nav className="help-links" aria-label="Help topics"><Link href="/help/photo-guide">Photo & artwork guide</Link><Link href="/help/shipping">Shipping & pickup</Link><Link href="/help/returns">Order problems & care</Link></nav>}<div className="actions"><Link className="button primary" href="/shop">Browse references</Link><Link className="button outline" href="/">Back to home</Link></div></div>;
}
