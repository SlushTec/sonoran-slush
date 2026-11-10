import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { categoryLines, categoryShort } from "@/lib/shop";
import CatalogSearch from "@/components/CatalogSearch";
export const dynamicParams = false;
export function generateStaticParams() {
  return catalog.categories.map((c) => ({ category: c.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  return { title: categoryShort[category] || "Gift collection" };
}
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const c = catalog.categories.find((x) => x.slug === category);
  if (!c) notFound();
  return (
    <div className="container">
      <div className="page-intro">
        <p className="breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/shop">Shop gifts</Link>
          <span>/</span>
          {categoryShort[category]}
        </p>
        <p className="eyebrow">{categoryShort[category]}</p>
        <h1>{categoryLines[category]}</h1>
        <p>{c.description} Add the details that make it theirs.</p>
      </div>
      {category === "photo-crystals" && (
        <div className="crystal-collection-note">
          <strong>First, choose the shape that feels right.</strong>
          <span>
            Then select its size and add your photograph. Necklaces and the
            round photo ornament use 2D engraving; other photo shapes use 3D
            engraving.
          </span>
        </div>
      )}
      <CatalogSearch category={category} />
    </div>
  );
}
