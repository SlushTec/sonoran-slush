"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { catalog } from "@/lib/catalog";
import { infoFor, categoryShort, occasions } from "@/lib/shop";
import { suggestSearchTerms } from "@/lib/search-recovery";
import ProductCard from "./ProductCard";
import Icon from "./Icon";
const materials = [
  "All materials",
  ...new Set(catalog.products.map((p) => infoFor(p).material)),
];
function CatalogQuery({ onChange }: { onChange: (query: string) => void }) {
  const query = useSearchParams().toString();
  useEffect(() => onChange(query), [query, onChange]);
  return null;
}
export default function CatalogSearch({
  category = "",
}: {
  category?: string;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""),
    [q, setQ] = useState(""),
    [family, setFamily] = useState(category),
    [occasion, setOccasion] = useState("All occasions"),
    [material, setMaterial] = useState("All materials"),
    [sort, setSort] = useState("featured");
  useEffect(() => {
    // A delayed subscription snapshot must not overwrite a newer local edit.
    if (query !== new URLSearchParams(window.location.search).toString())
      return;
    const p = new URLSearchParams(query);
    setQ(p.get("q") || "");
    const requested = p.get("category");
    setFamily(
      p.has("category") &&
        (requested === "" ||
          catalog.categories.some((c) => c.slug === requested))
        ? requested!
        : category,
    );
    const o = p.get("occasion"),
      m = p.get("material"),
      s = p.get("sort");
    setOccasion(o && occasions.includes(o) ? o : "All occasions");
    setMaterial(m && materials.includes(m) ? m : "All materials");
    setSort(s === "az" || s === "za" ? s : "featured");
  }, [category, query]);
  function change(
    patch: Partial<{
      q: string;
      family: string;
      occasion: string;
      material: string;
      sort: string;
    }>,
  ) {
    const next = { q, family, occasion, material, sort, ...patch };
    setQ(next.q);
    setFamily(next.family);
    setOccasion(next.occasion);
    setMaterial(next.material);
    setSort(next.sort);
    const url = new URL(window.location.href);
    for (const [key, value, defaultValue] of [
      ["q", next.q, ""],
      ["category", next.family, category],
      ["occasion", next.occasion, "All occasions"],
      ["material", next.material, "All materials"],
      ["sort", next.sort, "featured"],
    ]) {
      if (value === defaultValue) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    // Update the current catalog entry, not one Back entry per keystroke.
    // Preserve Next's history state, unrelated query parameters and fragment.
    window.history.replaceState(window.history.state, "", url);
  }
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
  const suggestions = useMemo(() => {
    if (result.length) return [];
    const eligibleNames = catalog.products
      .filter((p) => {
        const i = infoFor(p);
        return (
          (!family || p.category === family) &&
          (occasion === "All occasions" || i.occasions.includes(occasion)) &&
          (material === "All materials" || i.material === material)
        );
      })
      .flatMap((p) => [p.name, infoFor(p).title]);
    return suggestSearchTerms(q, eligibleNames);
  }, [result.length, q, family, occasion, material]);
  const active =
    !!q ||
    !!family ||
    occasion !== "All occasions" ||
    material !== "All materials";
  function clearSearch() {
    change({ q: "" });
    searchInput.current?.focus();
  }
  function reset() {
    change({
      q: "",
      family: category,
      occasion: "All occasions",
      material: "All materials",
    });
    searchInput.current?.focus();
  }
  return (
    <>
      <Suspense fallback={null}>
        <CatalogQuery onChange={setQuery} />
      </Suspense>
      <div className="shop-layout">
        <aside className="shop-sidebar">
          <p className="eyebrow">The collections</p>
          <nav aria-label="Gift categories">
            <button
              className={!family ? "active" : ""}
              aria-pressed={!family}
              onClick={() => change({ family: "" })}
            >
              All gifts <span>{catalog.products.length}</span>
            </button>
            {catalog.categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => change({ family: c.slug })}
                className={family === c.slug ? "active" : ""}
                aria-pressed={family === c.slug}
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
              ref={searchInput}
              type="search"
              value={q}
              onChange={(e) => change({ q: e.target.value })}
              placeholder="A name, an occasion, a little inspiration…"
            />
            {q && (
              <button
                className="icon-button"
                onClick={clearSearch}
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
                onChange={(e) => change({ occasion: e.target.value })}
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
                onChange={(e) => change({ material: e.target.value })}
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
              <select
                value={sort}
                onChange={(e) => change({ sort: e.target.value })}
              >
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
              {suggestions.length > 0 && (
                <div role="group" aria-label="Search suggestions">
                  <p>Try searching for:</p>
                  <div className="actions">
                    {suggestions.map((term) => (
                      <button
                        key={term}
                        className="button outline"
                        aria-label={"Search for " + term}
                        onClick={() => {
                          change({ q: term });
                          searchInput.current?.focus();
                        }}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
