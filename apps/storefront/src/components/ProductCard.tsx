"use client";
import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { categoryShort, infoFor } from "@/lib/shop";
import { useStore } from "./Store";
import Icon from "./Icon";
import { mediaFor } from "@/lib/media";
export function ProductVisual({
  category,
  product,
  variant,
  large = false,
  label,
  children,
}: {
  category: string;
  product?: Product;
  variant?: string;
  large?: boolean;
  label?: string;
  children?: React.ReactNode;
}) {
  const media = product ? mediaFor(product.slug) : undefined;
  const photo =
    variant && media?.variants?.[variant] ? media.variants[variant] : media;
  return (
    <div
      className={
        "product-visual tone-" +
        category +
        (photo ? " has-product-photo" : "") +
        (large ? " large" : "")
      }
    >
      {photo ? (
        <img
          className="supplier-product-photo"
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading={large ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <img
          className="visual-desert-mark"
          src="/brand/desert-mark.svg"
          alt=""
          width="180"
          height="133"
          loading="lazy"
        />
      )}
      {children}
      <div className="visual-caption">
        <span>
          {label ||
            (media
              ? media.badge ||
                (media.caption.startsWith("Supplier")
                  ? "Supplier example"
                  : "Blank reference")
              : "Studio photograph to follow")}
        </span>
        <span aria-hidden="true">↗</span>
      </div>
    </div>
  );
}
export default function ProductCard({ product }: { product: Product }) {
  const { favorites, toggleFavorite } = useStore(),
    info = infoFor(product),
    saved = favorites.includes(product.slug);
  return (
    <article className="product-card">
      <div className="product-card-top">
        <Link
          href={"/products/" + product.slug}
          aria-label={"Explore " + info.title}
        >
          <ProductVisual category={product.category} product={product} />
        </Link>
        <button
          className={"favorite-button" + (saved ? " selected" : "")}
          aria-label={(saved ? "Unsave " : "Save ") + info.title}
          aria-pressed={saved}
          onClick={() => toggleFavorite(product.slug)}
        >
          <Icon name="heart" size={18} />
        </button>
        <span className="product-type">Made personal</span>
      </div>
      <div className="product-card-content">
        <p className="eyebrow">{categoryShort[product.category]}</p>
        <h3>
          <Link href={"/products/" + product.slug}>{info.title}</Link>
        </h3>
        <p>{info.line}</p>
        <div className="product-card-bottom">
          <span>Pricing on review</span>
          <Link
            href={"/products/" + product.slug}
            aria-label={"Personalize " + info.title}
          >
            <span>Make it yours</span>
            <Icon name="arrow" size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}
