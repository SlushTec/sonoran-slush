import type { Metadata } from "next";
import CatalogSearch from "@/components/CatalogSearch";
import Link from "next/link";
export const metadata: Metadata = { title: "Shop personalized gifts" };
export default function Shop() {
  return (
    <div className="container">
      <div className="page-intro">
        <p className="breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span> Shop gifts
        </p>
        <p className="eyebrow">The Sonoran Slush collection</p>
        <h1>
          Find their <em>kind of personal.</em>
        </h1>
        <p>
          Everyday favorites. Meaningful keepsakes. A little something that
          could only be theirs.
        </p>
      </div>
      <CatalogSearch />
    </div>
  );
}
