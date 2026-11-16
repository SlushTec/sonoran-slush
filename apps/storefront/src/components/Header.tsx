"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { catalog } from "@/lib/catalog";
import { categoryShort, infoFor } from "@/lib/shop";
import { useStore } from "./Store";
import Icon from "./Icon";
import Brand from "./Brand";
const links = [
  ["Shop gifts", "/shop"],
  ["Custom & bulk", "/custom-orders"],
  ["Live events", "/events"],
  ["Our work", "/our-work"],
  ["Our story", "/about"],
  ["Help", "/help"],
];
export default function Header() {
  const path = usePathname(),
    { cart, favorites } = useStore();
  const cartQuantity = cart.reduce((total, design) => total + design.quantity, 0);
  const [q, setQ] = useState("");
  const search = useRef<HTMLDialogElement>(null),
    menu = useRef<HTMLDialogElement>(null);
  const results = catalog.products
    .filter((p) =>
      (infoFor(p).title + " " + p.name + " " + categoryShort[p.category])
        .toLowerCase()
        .includes(q.trim().toLowerCase()),
    )
    .slice(0, 6);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        search.current?.showModal();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    search.current?.close();
    menu.current?.close();
  }, [path]);
  return (
    <>
      <div className="announcement">
        <span>Made personal in Tucson, Arizona</span>
        <span className="announcement-center">
          Small studio. Thoughtful details.
        </span>
        <Link href="/events">
          We bring the engraving to you <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => menu.current?.showModal()}
          >
            <Icon name="menu" />
          </button>
          <Brand />
          <nav className="primary-nav" aria-label="Main navigation">
            {links.map(([label, url]) => (
              <Link
                key={url}
                href={url}
                aria-current={
                  path === url || path.startsWith(url + "/")
                    ? "page"
                    : undefined
                }
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-tools">
            <button
              className="icon-button"
              aria-label="Search gifts"
              onClick={() => search.current?.showModal()}
            >
              <Icon name="search" />
            </button>
            <Link
              className="icon-button saved-link"
              href="/saved"
              aria-label={
                "Saved gifts" +
                (favorites.length ? " (" + favorites.length + ")" : "")
              }
            >
              <Icon name="heart" />
              {favorites.length > 0 && (
                <span className="count-dot">{favorites.length}</span>
              )}
            </Link>
            <Link
              className="icon-button account-link"
              href="/account"
              aria-label="Your account"
            >
              <Icon name="user" />
            </Link>
            <Link
              className="icon-button"
              href="/cart"
              aria-label={
                "Shopping bag" + (cartQuantity ? " (" + cartQuantity + ")" : "")
              }
            >
              <Icon name="bag" />
              {cart.length > 0 && (
                <span className="count-dot">
                  {cartQuantity}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <dialog
        ref={search}
        aria-labelledby="site-search-title"
        className="search-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) search.current?.close();
        }}
      >
        <div className="dialog-top">
          <h2 id="site-search-title">Find something personal.</h2>
          <button
            className="icon-button"
            aria-label="Close search"
            onClick={() => search.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <form action="/shop" method="get" role="search" aria-label="Product search" onSubmit={() => search.current?.close()}>
        <label className="search-field">
          <Icon name="search" />
          <span className="sr-only">Search products</span>
          <input
            autoFocus
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try a tumbler, a wedding gift, a crystal…"
          />
        </label>
        </form>
        <p className="eyebrow">
          {q ? "Matching gifts" : "A few places to start"}
        </p>
        <div className="search-results">
          {results.map((p) => (
            <Link
              href={"/products/" + p.slug}
              key={p.slug}
              onClick={() => search.current?.close()}
            >
              <span>
                {infoFor(p).title}
                <small>{categoryShort[p.category]}</small>
              </span>
              <Icon name="arrow" />
            </Link>
          ))}
          {results.length === 0 && (
            <p>No matches yet. Try “glass,” “wood,” or “photo.”</p>
          )}
        </div>
        <Link
          className="text-link"
          href={"/shop?q=" + encodeURIComponent(q)}
          onClick={() => search.current?.close()}
        >
          Browse all results <Icon name="arrow" />
        </Link>
      </dialog>
      <dialog ref={menu} className="menu-dialog" aria-label="Site navigation">
        <div className="dialog-top">
          <span className="eyebrow">Sonoran Slush</span>
          <button
            className="icon-button"
            aria-label="Close navigation"
            onClick={() => menu.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          {links.map(([label, url]) => (
            <Link
              href={url}
              key={url}
              aria-current={path === url || path.startsWith(url + "/") ? "page" : undefined}
              onClick={() => menu.current?.close()}
            >
              {label}
              <Icon name="arrow" />
            </Link>
          ))}
          <Link href="/saved" onClick={() => menu.current?.close()}>
            Saved designs
            <Icon name="heart" />
          </Link>
          <Link href="/account" onClick={() => menu.current?.close()}>
            Your account
            <Icon name="user" />
          </Link>
        </nav>
        <p className="small muted">Personalized gifts. Made with meaning.</p>
      </dialog>
    </>
  );
}
