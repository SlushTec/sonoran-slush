import type { Metadata } from 'next';
import CatalogSearch from '@/components/CatalogSearch';
export const metadata: Metadata = {title:'Shop gifts'};
export default function Shop(){return <div className="container section"><p className="eyebrow">Reference catalog</p><h1>Find something personal.</h1><p className="intro">Explore the documented offering. Prices, stock, photographs and product options require approval before anything can be purchased.</p><CatalogSearch/></div>;}
