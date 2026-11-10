"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { catalog } from "@/lib/catalog";
import { infoFor, categoryShort, occasions } from "@/lib/shop";
import ProductCard from "./ProductCard";
import Icon from "./Icon";
export default function CatalogSearch({
  category = "",
}: {
  category?: string;
}) {
  const [q, setQ] = useState(""),
    [family, setFamily] = useState(category),
    [occasion, setOccasion] = useState("All occasions"),
    [material, setMaterial] = useState("All materials"),
    [sort, setSort] = useState("featured");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get("q") || "");
    const o = p.get("occasion");
    if (o && occasions.includes(o)) setOccasion(o);
    if (
      !category &&
      catalog.categories.some((c) => c.slug === p.get("category"))
    )
      setFamily(p.get("category")!);
  }, [category]);
  const result = useMemo(
    () =>
      catalog.products
        .filter((p) => {
          const i = infoFor(p);
          return (
            (!family || p.category === family) &&
            (!q ||
              (
                p.name +
                " " +
                i.title +
                " " +
                i.description +
                " " +
                i.occasions.join(" ") +
                " " +
                i.material
              )
                .toLowerCase()
                .includes(q.trim().toLowerCase())) &&
            (occasion === "All occasions" || i.occasions.includes(occasion)) &&
            (material === "All materials" || i.material === material)
          );
        })
        .sort((a, b) =>
          sort === "az"
            ? infoFor(a).title.localeCompare(infoFor(b).title)
            : sort === "za"
              ? infoFor(b).title.localeCompare(infoFor(a).title)
              : 0,
        ),
    [q, family, occasion, material, sort],
  );
  const active =
    !!q ||
    !!family ||
    occasion !== "All occasions" ||
    material !== "All materials";
  function reset() {
    setQ("");
    setFamily(category);
    setOccasion("All occasions");
    setMaterial("All materials");
  }
  return (
    <>
      <div className="shop-layout">
        <aside className="shop-sidebar">
          <p className="eyebrow">The collections</p>
          <nav aria-label="Gift categories">
            <button
              className={!family ? "active" : ""}
              onClick={() => setFamily("")}
            >
              All gifts <span>{catalog.products.length}</span>
            </button>
            {catalog.categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => setFamily(c.slug)}
                className={family === c.slug ? "active" : ""}
              >
                {categoryShort[c.slug]}
                <span>
                  {catalog.products.filter((p) => p.category === c.slug).length}
                </span>
              </button>
            ))}
          </nav>
          <div className="sidebar-help">
            <Icon name="sparkle" size={25} />
            <h3>A little inspiration?</h3>
            <p>
              A few questions can help you find a thoughtful starting point.
            </p>
            <Link className="text-link" href="/gift-finder">
              Try the gift finder <Icon name="arrow" size={15} />
            </Link>
          </div>
        </aside>
        <div className="shop-results">
          <label className="search-field catalog-search">
            <Icon name="search" />
            <span className="sr-only">Search the collection</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="A name, an occasion, a little inspiration…"
            />
            {q && (
              <button
                className="icon-button"
                onClick={() => setQ("")}
                aria-label="Clear search"
              >
                <Icon name="close" size={17} />
              </button>
            )}
          </label>
          <div className="filter-bar">
            <label>
              Occasion
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
              >
                {occasions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Material
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              >
                {[
                  "All materials",
                  ...new Set(catalog.products.map((p) => infoFor(p).material)),
                ].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="sort-select">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="featured">Collection order</option>
                <option value="az">Name: A–Z</option>
                <option value="za">Name: Z–A</option>
              </select>
            </label>
          </div>
          <div className="result-bar">
            <p aria-live="polite">
              {result.length} thoughtful{" "}
              {result.length === 1 ? "gift" : "gifts"}
              {family ? " · " + categoryShort[family] : ""}
            </p>
            {active && (
              <button className="link-button" onClick={reset}>
                Reset filters
              </button>
            )}
          </div>
          <div className="product-grid catalog-grid">
            {result.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
          {!result.length && (
            <div className="empty-state">
              <Icon name="search" size={36} />
              <h2>No gifts found, just yet.</h2>
              <p>
                Try a broader search or a different occasion. Your idea may also
                be a great fit for a custom order.
              </p>
              <div className="actions">
                <button className="button primary" onClick={reset}>
                  Clear filters
                </button>
                <Link className="button outline" href="/custom-orders">
                  Talk custom work
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
