import Link from 'next/link';
import type { Product } from '@/lib/catalog';
export default function ProductCard({product}: {product: Product}) {
  return <article className="card product-card">
    <div className="asset-placeholder" aria-label="Product photography not yet supplied"><span>Product photography pending</span></div>
    <div className="card-content"><h2><Link href={'/products/'+product.slug}>{product.name}</Link></h2>
    <p>Personalization and approved product details are being prepared.</p>
    <p className="status-label">Reference only · not available to purchase</p></div>
  </article>;
}
