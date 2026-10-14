import Link from 'next/link';
import { catalog } from '@/lib/catalog';
export default function Home() {
  return <>
    <section className="hero"><div className="container hero-content"><p className="eyebrow">Sonoran Slush Creative Creations</p><h1>Personalized gifts.<br/>Custom engraving.<br/><em>Memorable events.</em></h1>
    <p className="lead">One studio, many ways to make it personal. Explore the product families and customer journeys taking shape in our new native storefront.</p>
    <div className="actions"><Link className="button primary" href="/shop">Explore our offerings</Link><Link className="button outline-light" href="/events">Explore live events</Link></div></div></section>
    <section className="container section"><p className="eyebrow">Find your starting point</p><h2>Gifts, custom work and live experiences.</h2><div className="journey-grid">
      <article className="card card-content"><h3>Shop a personalized gift</h3><p>Drinkware, boards, glassware, keepsakes and more. Each product gets the options it actually needs.</p><Link href="/shop">Browse product families →</Link></article>
      <article className="card card-content"><h3>Plan custom or bulk work</h3><p>Shared logos, individual names, mixed gifts and larger quantities need a clear quotation path.</p><Link href="/custom-orders">Custom & bulk orders →</Link></article>
      <article className="card card-content"><h3>Bring engraving to an event</h3><p>Packages, guest counts, preparation and availability belong in a dedicated event experience.</p><Link href="/events">Live event services →</Link></article>
    </div></section>
    <section className="section soft"><div className="container"><p className="eyebrow">The full offering</p><h2>More than one kind of keepsake.</h2><div className="category-grid">{catalog.categories.map(c=><Link className="category-card" key={c.slug} href={'/shop/'+c.slug}><h3>{c.name}</h3><p>{c.description}</p><span>Explore the collection →</span></Link>)}</div></div></section>
    <section className="container section"><div className="notice"><h2>A foundation, not a finished shop.</h2><p>These pages establish the new experience and shared structure. Approved photography, pricing, personalization, checkout and customer workflows will be added and verified before launch.</p><Link href="/help">See what is available in this preview</Link></div></section>
  </>;
}
