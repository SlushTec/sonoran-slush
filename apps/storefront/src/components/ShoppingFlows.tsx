"use client";
import { useState } from "react";
import Link from "next/link";
import { catalog } from "@/lib/catalog";
import { infoFor } from "@/lib/shop";
import { commerce, downloadJSON, newId } from "@/lib/client";
import { useStore, type Design } from "./Store";
import ProductCard, { ProductVisual } from "./ProductCard";
import Icon from "./Icon";
function itemProduct(d: Design) {
  return catalog.products.find((p) => p.slug === d.slug)!;
}
export function Bag() {
  const store = useStore();
  if (!store.hydrated)
    return (
      <p className="loading-panel" role="status">
        Opening your bag…
      </p>
    );
  if (!store.cart.length)
    return (
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="empty-state">
          <Icon name="bag" size={38} />
          <h2>A thoughtful gift starts here.</h2>
          <p>
            Your bag is waiting for something personal. Explore the collection,
            add a few details, and keep your ideas together.
          </p>
          <div className="actions">
            <Link className="button primary" href="/shop">
              Find their gift <Icon name="arrow" />
            </Link>
            <Link className="button outline" href="/saved">
              See saved designs
            </Link>
          </div>
        </div>
      </div>
    );
  return (
    <div className="bag-layout">
      <div>
        {store.cart.map((d) => {
          const p = itemProduct(d);
          return (
            <article className="bag-item" key={d.id}>
              <Link
                href={"/products/" + d.slug + "?design=" + d.id}
                aria-label={"Edit " + infoFor(p).title}
              >
                <ProductVisual category={p.category} product={p} />
              </Link>
              <div>
                <h2>
                  <Link href={"/products/" + d.slug + "?design=" + d.id}>
                    {infoFor(p).title}
                  </Link>
                </h2>
                <p>
                  {Object.values(d.options).join(" · ") ||
                    "Personalized design"}
                </p>
                {d.text && <p className="bag-inscription">“{d.text}”</p>}
                {d.secondary && <p>Second side: {d.secondary}</p>}
                {d.artworkName && (
                  <p>Artwork: {d.artworkName} · original file will be needed</p>
                )}
                {d.gift && (
                  <p>
                    <Icon name="gift" size={13} /> A gift
                    {d.giftMessage ? " · Message included" : ""}
                  </p>
                )}
                <div className="bag-item-controls">
                  <div className="quantity-control" aria-label="Quantity">
                    <button
                      onClick={() => store.setQuantity(d.id, d.quantity - 1)}
                      aria-label={"Decrease quantity for " + infoFor(p).title}
                      disabled={d.quantity <= 1}
                    >
                      <Icon name="minus" size={13} />
                    </button>
                    <output aria-live="polite" aria-label="Quantity">
                      {d.quantity}
                    </output>
                    <button
                      onClick={() => store.setQuantity(d.id, d.quantity + 1)}
                      aria-label={"Increase quantity for " + infoFor(p).title}
                      disabled={d.quantity >= 500}
                    >
                      <Icon name="plus" size={13} />
                    </button>
                  </div>
                  <Link
                    className="link-button"
                    href={"/products/" + d.slug + "?design=" + d.id}
                  >
                    Edit design
                  </Link>
                  <button
                    className="link-button"
                    onClick={() => store.removeCart(d.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        <p className="device-note">
          <Icon name="lock" size={14} /> This bag saves on this device for 30
          days. Original artwork files are not stored.{" "}
          <Link href="/saved">Manage your saved work.</Link>
        </p>
        <Link href="/shop" className="text-link" style={{ marginTop: 15 }}>
          Keep exploring <Icon name="arrow" size={17} />
        </Link>
      </div>
      <aside className="summary-card">
        <h2>Your thoughtful details.</h2>
        <div className="summary-row">
          <span>Personalized pieces</span>
          <span>{store.cart.reduce((s, d) => s + d.quantity, 0)}</span>
        </div>
        <div className="summary-row">
          <span>Product pricing</span>
          <span>Pending review</span>
        </div>
        <div className="summary-row">
          <span>Shipping & tax</span>
          <span>Confirmed with quote</span>
        </div>
        <p className="small">
          Your designs are ready for the next conversation. The studio needs to
          confirm pricing, materials, and delivery before you can pay.
        </p>
        <Link href="/checkout" className="button primary full">
          Review your request <Icon name="arrow" size={17} />
        </Link>
        <button
          className="link-button"
          onClick={() =>
            downloadJSON("sonoran-slush-designs.json", {
              type: "design_request",
              created_at: new Date().toISOString(),
              items: store.cart,
              paid: false,
            })
          }
        >
          Download your designs
        </button>
        <p className="small">
          <Icon name="shield" size={15} /> No charge or reservation is made by
          saving a design.
        </p>
      </aside>
    </div>
  );
}
export function Saved() {
  const store = useStore(),
    [tab, setTab] = useState("designs"),
    [clearConfirm, setClearConfirm] = useState(false);
  return (
    <div style={{ paddingBottom: 70 }}>
      <div className="saved-tabs" role="group" aria-label="Saved work">
        <button
          aria-pressed={tab === "designs"}
          onClick={() => setTab("designs")}
        >
          Your designs ({store.designs.length})
        </button>
        <button
          aria-pressed={tab === "favorites"}
          onClick={() => setTab("favorites")}
        >
          Favorite gifts ({store.favorites.length})
        </button>
      </div>
      {!store.hydrated ? (
        <p role="status">Loading saved work…</p>
      ) : tab === "designs" ? (
        store.designs.length ? (
          <div className="saved-design-grid">
            {store.designs.map((d) => (
              <article className="saved-design-card" key={d.id}>
                <p className="eyebrow">Your personal touch</p>
                <h2>{infoFor(itemProduct(d)).title}</h2>
                <p className="quote">
                  {d.text ? "“" + d.text + "”" : "Your design, in progress."}
                </p>
                <p className="small">
                  {Object.values(d.options).join(" · ") ||
                    "Personalization draft"}{" "}
                  · Qty {d.quantity}
                </p>
                {d.artworkName && (
                  <p className="small">
                    Original artwork needed: {d.artworkName}
                  </p>
                )}
                <div className="design-actions">
                  <Link
                    href={"/products/" + d.slug + "?design=" + d.id}
                    className="text-link"
                  >
                    Continue designing <Icon name="arrow" size={15} />
                  </Link>
                  <button
                    className="link-button"
                    onClick={() => store.removeDesign(d.id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="pencil" size={35} />
            <h2>Keep a good idea close.</h2>
            <p>
              Personalize a piece and save your design. It will be waiting here
              on this device when you come back.
            </p>
            <div className="actions">
              <Link href="/shop" className="button primary">
                Explore the collection <Icon name="arrow" />
              </Link>
            </div>
          </div>
        )
      ) : store.favorites.length ? (
        <div className="product-grid">
          {store.favorites.map((slug) => (
            <ProductCard
              key={slug}
              product={catalog.products.find((p) => p.slug === slug)!}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="heart" size={35} />
          <h2>Something catch your eye?</h2>
          <p>Tap the heart on a gift to keep it here while you decide.</p>
          <div className="actions">
            <Link href="/shop" className="button primary">
              Find a favorite <Icon name="arrow" />
            </Link>
          </div>
        </div>
      )}
      <div className="clear-section">
        <div>
          <h2>Your device. Your details.</h2>
          <p>
            Design text, options, favorites, and saved request drafts expire
            after 30 days. Artwork stays out of device storage.{" "}
            {store.storageAvailable
              ? ""
              : "Device storage is unavailable; work is kept for this visit only."}
          </p>
        </div>
        {clearConfirm ? (
          <div className="form-actions">
            <button
              className="danger-button"
              onClick={() => {
                store.clear();
                setClearConfirm(false);
              }}
            >
              Clear all saved work
            </button>
            <button
              className="link-button"
              onClick={() => setClearConfirm(false)}
            >
              Keep it
            </button>
          </div>
        ) : (
          <button className="link-button" onClick={() => setClearConfirm(true)}>
            Clear data on this device
          </button>
        )}
      </div>
      <p className="small muted">
        Saved work belongs to this browser, rather than an online account. On a
        shared device, clear your work when you are finished.{" "}
        <Link href="/privacy">Read about privacy.</Link>
      </p>
    </div>
  );
}
type RequestReceipt = {
  id: string;
  access_token: string;
  status: string;
  message?: string;
};
export function Checkout() {
  const store = useStore(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<RequestReceipt | null>(null),
    [requestID] = useState(() => newId()),
    [delivery, setDelivery] = useState("Ship to an address"),
    [contact, setContact] = useState({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      region: "",
      postal: "",
      country: "US",
      notes: "",
      gift: false,
      recipient: "",
      giftMessage: "",
    }),
    [consent, setConsent] = useState(false);
  function edit(key: keyof typeof contact, value: string | boolean) {
    setContact((v) => ({ ...v, [key]: value }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !consent) return;
    setBusy(true);
    setError("");
    try {
      const result = await commerce<RequestReceipt>("/v1/quotes", {
        request_id: requestID,
        kind: "retail",
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        items: store.cart.map((d) => ({
          product_slug: d.slug,
          quantity: d.quantity,
          text: d.text,
          secondary: d.secondary,
          font: d.font,
          options: d.options,
          notes: d.notes,
          artwork_name: d.artworkName,
          gift: d.gift,
          gift_message: d.giftMessage,
        })),
        delivery,
        shipping: {
          address: contact.address,
          city: contact.city,
          region: contact.region,
          postal: contact.postal,
          country: contact.country,
        },
        notes: contact.notes,
        gift: contact.gift,
        recipient: contact.recipient,
        gift_message: contact.giftMessage,
        consent: true,
      });
      setReceipt(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your request could not be sent. Your designs are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!store.hydrated)
    return (
      <p role="status" className="loading-panel">
        Preparing your request…
      </p>
    );
  if (!store.cart.length)
    return (
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="empty-state">
          <Icon name="bag" size={38} />
          <h2>Your bag needs a little inspiration.</h2>
          <p>Choose a gift and add your details before reviewing a request.</p>
          <div className="actions">
            <Link href="/shop" className="button primary">
              Find their gift <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </div>
    );
  if (receipt)
    return (
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="form-success">
          <Icon name="check" size={32} />
          <h2>Your request is with the studio.</h2>
          <p>
            Reference: <strong>{receipt.id}</strong>. This is a pricing request,
            not a paid order. No payment has been taken.
          </p>
          <p>
            Keep the private access code in your receipt to look up this
            request. Do not share it publicly.
          </p>
          <button
            className="button primary"
            style={{ marginTop: 20 }}
            onClick={() =>
              downloadJSON("sonoran-slush-private-receipt.json", receipt)
            }
          >
            Download private receipt <Icon name="download" />
          </button>
        </div>
      </section>
    );
  return (
    <div className="bag-layout">
      <form onSubmit={submit}>
        <div className="info-banner">
          This private review is not taking payments. This form prepares a
          request for reviewed pricing. No card details are collected.
        </div>
        <div className="checkout-group" style={{ marginTop: 28 }}>
          <div className="checkout-heading">
            <span>1</span>
            <h2>A way to get in touch.</h2>
          </div>
          <p className="small muted" style={{ marginBottom: 20 }}>
            Guest requests are welcome. An account is not required.
          </p>
          <div className="form-grid">
            <label className="field">
              Full name
              <input
                autoComplete="name"
                name="name"
                required
                maxLength={100}
                value={contact.name}
                onChange={(e) => edit("name", e.target.value)}
              />
            </label>
            <label className="field">
              Email address
              <input
                type="email"
                autoComplete="email"
                name="email"
                required
                maxLength={254}
                value={contact.email}
                onChange={(e) => edit("email", e.target.value)}
              />
            </label>
            <label className="field span-2">
              Phone (optional)
              <input
                type="tel"
                autoComplete="tel"
                name="phone"
                maxLength={30}
                value={contact.phone}
                onChange={(e) => edit("phone", e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="checkout-group">
          <div className="checkout-heading">
            <span>2</span>
            <h2>Where it is going.</h2>
          </div>
          <label className="field">
            Delivery preference
            <select
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            >
              <option>Ship to an address</option>
              <option>Ask about Tucson pickup</option>
              <option>Discuss with the studio</option>
            </select>
          </label>
          {delivery === "Ship to an address" && (
            <div className="form-grid">
              <label className="field span-2">
                Street address
                <input
                  autoComplete="shipping street-address"
                  maxLength={200}
                  value={contact.address}
                  onChange={(e) => edit("address", e.target.value)}
                />
                <span className="field-help">
                  Optional until the studio confirms delivery.
                </span>
              </label>
              <label className="field">
                City
                <input
                  autoComplete="shipping address-level2"
                  maxLength={100}
                  value={contact.city}
                  onChange={(e) => edit("city", e.target.value)}
                />
              </label>
              <label className="field">
                State / region
                <input
                  autoComplete="shipping address-level1"
                  maxLength={80}
                  value={contact.region}
                  onChange={(e) => edit("region", e.target.value)}
                />
              </label>
              <label className="field">
                Postal code
                <input
                  autoComplete="shipping postal-code"
                  maxLength={20}
                  value={contact.postal}
                  onChange={(e) => edit("postal", e.target.value)}
                />
              </label>
              <label className="field">
                Country
                <select
                  autoComplete="shipping country"
                  value={contact.country}
                  onChange={(e) => edit("country", e.target.value)}
                >
                  <option value="US">United States</option>
                  <option value="OTHER">Other — ask the studio</option>
                </select>
              </label>
            </div>
          )}
          <p className="field-help">
            Shipping cost, pickup availability, production time, and arrival
            estimates are confirmed with your quote.
          </p>
        </div>
        <div className="checkout-group">
          <div className="checkout-heading">
            <span>3</span>
            <h2>The last little details.</h2>
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={contact.gift}
              onChange={(e) => edit("gift", e.target.checked)}
            />
            <span>This order is a gift.</span>
          </label>
          {contact.gift && (
            <>
              <label className="field">
                Recipient name (optional)
                <input
                  maxLength={100}
                  value={contact.recipient}
                  onChange={(e) => edit("recipient", e.target.value)}
                />
              </label>
              <label className="field">
                Gift message (optional)
                <textarea
                  maxLength={300}
                  value={contact.giftMessage}
                  onChange={(e) => edit("giftMessage", e.target.value)}
                />
              </label>
              <p className="field-help">
                We use your contact details for this request. Recipients are not
                added to marketing or contacted by this form.
              </p>
            </>
          )}
          <label className="field">
            Anything else? (optional)
            <textarea
              maxLength={1500}
              value={contact.notes}
              onChange={(e) => edit("notes", e.target.value)}
              placeholder="A deadline, a question, or a detail we should know."
            />
          </label>
        </div>
        <label className="check-field">
          <input
            required
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Use my details to reply to this request. I understand that pricing
            and availability need review, and this does not create a paid order.{" "}
            <Link href="/privacy">Privacy information</Link>
          </span>
        </label>
        <button className="button primary full" disabled={busy} type="submit">
          {busy ? "Sending your request…" : "Request reviewed pricing"}
          <Icon name="arrow" />
        </button>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <p className="field-help" style={{ marginTop: 15 }}>
          Contact details are held in this form during your visit. Your designs
          remain saved if the connection fails. You can also download the design
          request.
        </p>
      </form>
      <aside className="summary-card">
        <h2>Your request.</h2>
        {store.cart.map((d) => (
          <div key={d.id} className="summary-row">
            <span>
              {infoFor(itemProduct(d)).title}
              <br />
              <small>{d.text || "Your personal design"}</small>
            </span>
            <span>× {d.quantity}</span>
          </div>
        ))}
        <div className="summary-row">
          <strong>Total</strong>
          <span>Pending studio quote</span>
        </div>
        <p className="small">
          No estimated or placeholder prices are charged. Original artwork will
          be requested through a secure channel before production.
        </p>
        <Link className="text-link" href="/cart">
          Edit your bag <Icon name="pencil" size={15} />
        </Link>
        <button
          className="link-button"
          style={{ display: "block", marginTop: 12 }}
          onClick={() =>
            downloadJSON("sonoran-slush-design-request.json", {
              kind: "retail",
              items: store.cart,
              paid: false,
            })
          }
        >
          Download design request
        </button>
      </aside>
    </div>
  );
}
