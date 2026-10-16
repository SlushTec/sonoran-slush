import { notFound } from "next/navigation";
import Link from "next/link";
import { catalog } from "@/lib/catalog";
import { infoFor, categoryShort } from "@/lib/shop";
import Customizer from "@/components/Customizer";
import ProductCard from "@/components/ProductCard";
export const dynamicParams = false;
export function generateStaticParams() {
  return catalog.products.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = catalog.products.find((p) => p.slug === slug);
  return {
    title: p ? infoFor(p).title : "Personalized gift",
    description: p ? infoFor(p).description : undefined,
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = catalog.products.find((p) => p.slug === slug);
  if (!p) notFound();
  const related = catalog.products
    .filter((x) => x.category === p.category && x.slug !== p.slug)
    .slice(0, 4);
  return (
    <div className="container">
      <p className="breadcrumb product-breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/shop">Shop gifts</Link>
        <span>/</span>
        <Link href={"/shop/" + p.category}>{categoryShort[p.category]}</Link>
      </p>
      <Customizer product={p} />
      {related.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A few more ways to make it personal</p>
              <h2>In good company.</h2>
            </div>
          </div>
          <div className="product-grid">
            {related.map((x) => (
              <ProductCard product={x} key={x.slug} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
