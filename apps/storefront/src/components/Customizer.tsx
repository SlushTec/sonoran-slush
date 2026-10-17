"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { infoFor, categoryShort, fonts } from "@/lib/shop";
import { crystalForSlug } from "@/lib/crystals";
import { mediaFor } from "@/lib/media";
import { readLocal, writeLocal } from "@/lib/client";
import { useStore, emptyDesign, parseDesign, type Design } from "./Store";
import { ProductVisual } from "./ProductCard";
import Icon from "./Icon";
export default function Customizer({ product }: { product: Product }) {
  const info = infoFor(product),
    crystal = crystalForSlug(product.slug),
    store = useStore(),
    [design, setDesign] = useState<Design | null>(() => {
      const initial = emptyDesign(product.slug);
      for (const option of info.options)
        initial.options[option.label] = option.values[0];
      if (crystal) initial.options["Crystal shape"] = crystal.shape;
      return initial;
    }),
    [restored, setRestored] = useState(false),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [localURL, setLocalURL] = useState(""),
    [photoLater, setPhotoLater] = useState(false),
    [photoError, setPhotoError] = useState(""),
    [zoom, setZoom] = useState(1),
    [offsetX, setOffsetX] = useState(0),
    [offsetY, setOffsetY] = useState(0),
    [rotation, setRotation] = useState(0),
    [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isPhoto = info.personalization === "photo",
    allowsPhoto = isPhoto || info.personalization === "either";
  useEffect(() => {
    if (!store.hydrated) return;
    const id = new URLSearchParams(location.search).get("design");
    const stored = id
      ? [...store.designs, ...store.cart].find(
          (d) => d.id === id && d.slug === product.slug,
        )
      : readLocal<Design | null>("config:" + product.slug, null);
    const parsed = parseDesign(stored);
    const next =
      parsed?.slug === product.slug ? parsed : emptyDesign(product.slug);
    for (const o of info.options)
      if (!o.values.includes(next.options[o.label]))
        next.options[o.label] = o.values[0];
    if (crystal) {
      next.options["Crystal shape"] = crystal.shape;
      if (!crystal.sizes.some((s) => s.value === next.options.Size))
        next.options.Size = crystal.sizes[0].value;
    }
    setDesign(next);
    setRestored(true);
  }, [product.slug, store.hydrated]);
  useEffect(() => {
    if (design && restored) writeLocal("config:" + product.slug, design);
  }, [design, product.slug, restored]);
  useEffect(
    () => () => {
      if (localURL) URL.revokeObjectURL(localURL);
    },
    [localURL],
  );
  function update(value: Partial<Design>) {
    setDesign((d) =>
      d ? { ...d, ...value, updated: new Date().toISOString() } : d,
    );
    setError("");
  }
  function setOption(label: string, value: string) {
    if (!design) return;
    const opts = { ...design.options, [label]: value };
    if (crystal) opts["Crystal shape"] = crystal.shape;
    update({ options: opts });
  }
  async function attach(file: File | undefined) {
    setPhotoError("");
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("Please choose a file smaller than 10 MB.");
      return;
    }
    setReading(true);
    try {
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
        png =
          bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71,
        webp =
          String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
      if (!jpeg && !png && !webp)
        throw new Error(
          "Use a JPG, PNG, or WebP image. Export HEIC photos as JPG first; SVG and documents are not accepted here.",
        );
      const bitmap = await createImageBitmap(file);
      const w = bitmap.width,
        h = bitmap.height;
      bitmap.close();
      if (w * h > 40000000)
        throw new Error(
          "That image is too large to preview. Please resize it below 40 megapixels.",
        );
      setLocalURL(URL.createObjectURL(file));
      update({ artworkName: file.name });
      setPhotoLater(false);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setRotation(0);
      if (Math.min(w, h) < 600)
        setPhotoError(
          "This photo is small. A higher-resolution original will give us more detail to review.",
        );
    } catch (e) {
      setPhotoError(
        e instanceof Error
          ? e.message
          : "This file could not be read. Try another photo.",
      );
    } finally {
      setReading(false);
    }
  }
  function validate() {
    if (!design) return false;
    if (isPhoto && !design.artworkName && !photoLater) {
      setError(
        "Add a local photo or choose “I will add artwork later” to save this configuration to your bag.",
      );
      setStep(1);
      return false;
    }
    if (
      info.personalization === "text" &&
      !design.text.trim() &&
      !design.artworkName &&
      !photoLater
    ) {
      setError(
        "Add a name or message, attach a design, or choose to add artwork later.",
      );
      setStep(1);
      return false;
    }
    if (
      !Number.isInteger(design.quantity) ||
      design.quantity < 1 ||
      design.quantity > 500
    ) {
      setError("Choose a quantity between 1 and 500.");
      return false;
    }
    return true;
  }
  if (!design)
    return (
      <div className="loading-panel" role="status">
        Preparing your personal workspace…
      </div>
    );
  const font = fonts.find((f) => f.name === design.font) || fonts[0];
  const secondary =
    design.options["Engraving placement"]?.includes("Two sides") ||
    design.options.Placement?.includes("back");
  return (
    <div className="product-detail">
      <div className="product-media">
        <ProductVisual
          category={product.category}
          product={product}
          variant={design.options.Orientation}
          large
        />
        <div className="media-note">
          <Icon name="pencil" size={16} />
          <span>
            {mediaFor(product.slug)?.caption ||
              "Photo being matched to the exact blank."}{" "}
            Your layout preview appears below.
          </span>
        </div>
        <div className="layout-preview">
          <div className="preview-heading">
            <p className="eyebrow">Your personal touch</p>
            <span>Layout only</span>
          </div>
          <div className="preview-canvas">
            {localURL && (
              <div className="artwork-frame">
                <img
                  src={localURL}
                  alt="Your local artwork layout"
                  style={{
                    transform:
                      "translate(" +
                      offsetX +
                      "%, " +
                      offsetY +
                      "%) scale(" +
                      zoom +
                      ") rotate(" +
                      rotation +
                      "deg)",
                  }}
                />
              </div>
            )}
            <div
              className="inscription-preview"
              style={{ fontFamily: font.family }}
            >
              {design.text || "Your story here"}
              {design.secondary && <small>{design.secondary}</small>}
            </div>
          </div>
          <p className="small muted">
            A text and artwork layout, not a manufacturing proof or a simulation
            of engraving. Final placement is reviewed with the studio.
          </p>
          {localURL && (
            <details className="crop-controls">
              <summary>Adjust local artwork layout</summary>
              <label>
                Zoom
                <input
                  aria-label="Artwork zoom"
                  type="range"
                  min="1"
                  max="3"
                  step=".05"
                  value={zoom}
                  onChange={(e) => setZoom(+e.target.value)}
                />
              </label>
              <label>
                Horizontal position
                <input
                  aria-label="Artwork horizontal position"
                  type="range"
                  min="-40"
                  max="40"
                  value={offsetX}
                  onChange={(e) => setOffsetX(+e.target.value)}
                />
              </label>
              <label>
                Vertical position
                <input
                  aria-label="Artwork vertical position"
                  type="range"
                  min="-40"
                  max="40"
                  value={offsetY}
                  onChange={(e) => setOffsetY(+e.target.value)}
                />
              </label>
              <label>
                Rotation
                <select
                  value={rotation}
                  onChange={(e) => setRotation(+e.target.value)}
                >
                  <option value="0">0°</option>
                  <option value="90">90°</option>
                  <option value="180">180°</option>
                  <option value="270">270°</option>
                </select>
              </label>
              <button
                className="link-button"
                onClick={() => {
                  setZoom(1);
                  setOffsetX(0);
                  setOffsetY(0);
                  setRotation(0);
                }}
              >
                Reset layout
              </button>
              <p className="small muted">
                These local adjustments are for exploration and are not saved as
                production instructions.
              </p>
            </details>
          )}
        </div>
        <div className="product-details-list">
          <details open>
            <summary>
              About this piece <Icon name="plus" size={17} />
            </summary>
            <p>{info.description}</p>
            {info.details.length > 0 && (
              <dl>
                {info.details.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </details>
          <details>
            <summary>
              Care & keeping <Icon name="plus" size={17} />
            </summary>
            <p>{info.care}</p>
            {info.material === "Wood" && (
              <p>
                Do not soak wood products or put them in the dishwasher. Use the
                unengraved side for cutting.
              </p>
            )}
          </details>
          <details>
            <summary>
              Before it becomes yours <Icon name="plus" size={17} />
            </summary>
            <p>
              Your selected options are requests. The studio confirms current
              materials, availability, pricing, and timing before you commit.
              Where a proof is required, production waits for approval of the
              exact version.
            </p>
          </details>
        </div>
      </div>
      <section className="product-config">
        <p className="eyebrow">
          {categoryShort[product.category]} · Made personal
        </p>
        <h1>{info.title}</h1>
        <p className="product-tagline">{info.line}</p>
        <p className="product-description">{info.description}</p>
        <div className="price-review">
          <strong>Made to your request</strong>
          <span>Final pricing & availability confirmed after review</span>
        </div>
        <div
          className="config-tabs"
          role="tablist"
          aria-label="Personalization steps"
        >
          {["Choose your details", "Make it personal", "Finishing touches"].map(
            (name, i) => (
              <button
                key={name}
                role="tab"
                id={"config-tab-" + i}
                aria-selected={step === i}
                aria-controls="config-panel"
                tabIndex={step === i ? 0 : -1}
                onKeyDown={(e) => {
                  const next =
                    e.key === "ArrowRight"
                      ? (i + 1) % 3
                      : e.key === "ArrowLeft"
                        ? (i + 2) % 3
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? 2
                            : null;
                  if (next !== null) {
                    e.preventDefault();
                    setStep(next);
                    document.getElementById("config-tab-" + next)?.focus();
                  }
                }}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>
                {name}
              </button>
            ),
          )}
        </div>
        <div
          id="config-panel"
          role="tabpanel"
          aria-labelledby={"config-tab-" + step}
          className="config-panel"
        >
          {step === 0 && (
            <>
              <h2>Start with the right details.</h2>
              {crystal && (
                <div className="shape-selected">
                  <span className="eyebrow">Your crystal shape</span>
                  <strong>{crystal.title}</strong>
                  <Link href="/shop/photo-crystals">
                    Explore a different shape <Icon name="arrow" size={14} />
                  </Link>
                </div>
              )}
              {info.options.length === 0 && (
                <p className="muted">
                  This piece starts with your personal design. Tell us about any
                  material or size preferences in your notes.
                </p>
              )}
              {info.options.map((o) => (
                <label className="field" key={o.label}>
                  {o.label}
                  <select
                    value={design.options[o.label] || o.values[0]}
                    onChange={(e) => setOption(o.label, e.target.value)}
                  >
                    {o.values.map((v) => (
                      <option key={v} value={v}>
                        {o.label === "Size" && crystal
                          ? crystal.sizes.find((s) => s.value === v)?.label || v
                          : v}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="field">
                Quantity
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={design.quantity}
                  onChange={(e) =>
                    update({
                      quantity: Math.max(
                        1,
                        Math.min(500, Number(e.target.value) || 1),
                      ),
                    })
                  }
                />
              </label>
              <p className="field-help">
                Options are design requests, subject to current availability.
                Need unique names across a group?{" "}
                <Link href="/custom-orders">
                  Start a custom or bulk request.
                </Link>
              </p>
              <button
                className="button primary full"
                onClick={() => setStep(1)}
              >
                Add your personal touch <Icon name="arrow" size={17} />
              </button>
            </>
          )}
          {step === 1 && (
            <>
              <h2>
                {isPhoto
                  ? "A memory worth holding."
                  : "The details only you could add."}
              </h2>
              {info.personalization !== "none" && (
                <>
                  <label className="field">
                    {isPhoto
                      ? "Inscription (optional)"
                      : "Name, initials, or message"}
                    <input
                      maxLength={120}
                      value={design.text}
                      onChange={(e) => update({ text: e.target.value })}
                      placeholder={
                        isPhoto
                          ? "Always in our hearts"
                          : "e.g. The Harrison Family"
                      }
                      autoComplete="off"
                    />
                    <span className="field-help">
                      {design.text.length}/120 characters · Please check
                      spelling carefully.
                    </span>
                  </label>
                  {secondary && (
                    <label className="field">
                      Second-side text (optional)
                      <input
                        maxLength={120}
                        value={design.secondary}
                        onChange={(e) => update({ secondary: e.target.value })}
                        placeholder="A date, a line, another little detail"
                      />
                    </label>
                  )}
                  <fieldset className="font-picker">
                    <legend>Text style</legend>
                    <div>
                      {fonts.map((f) => (
                        <button
                          type="button"
                          key={f.name}
                          style={{ fontFamily: f.family }}
                          aria-pressed={design.font === f.name}
                          className={design.font === f.name ? "selected" : ""}
                          onClick={() => update({ font: f.name })}
                        >
                          Aa<span>{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="upload-zone" htmlFor="artwork">
                    <Icon name="upload" size={25} />
                    <strong>
                      {reading
                        ? "Checking your file…"
                        : design.artworkName
                          ? "Change local artwork"
                          : "Add a " +
                            (allowsPhoto ? "photo" : "logo or design")}
                    </strong>
                    <span>JPG, PNG, WebP · Up to 10 MB</span>
                    <input
                      ref={fileRef}
                      id="artwork"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => attach(e.target.files?.[0])}
                      disabled={reading}
                    />
                  </label>
                  {design.artworkName && (
                    <div className="attached-file">
                      <Icon name={localURL ? "check" : "upload"} size={17} />
                      <span>
                        {design.artworkName}
                        {!localURL && (
                          <small>
                            Please reattach this file to see its local preview.
                          </small>
                        )}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Remove artwork"
                        onClick={() => {
                          setLocalURL("");
                          update({ artworkName: "" });
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  )}
                  {photoError && (
                    <p className="field-warning" role="status">
                      {photoError}
                    </p>
                  )}
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={photoLater}
                      onChange={(e) => setPhotoLater(e.target.checked)}
                    />
                    <span>I will add artwork later.</span>
                  </label>
                  <p className="field-help">
                    Local preview only. Files stay in this browser and are not
                    uploaded or retained when you leave. Original artwork will
                    be needed before production.
                  </p>
                </>
              )}
              {info.personalization === "none" && (
                <p className="muted">
                  Tell us which crystal you would like to pair this base with in
                  the notes below.
                </p>
              )}
              <div className="step-buttons">
                <button className="button outline" onClick={() => setStep(0)}>
                  Back
                </button>
                <button className="button primary" onClick={() => setStep(2)}>
                  Finishing touches <Icon name="arrow" size={17} />
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2>Make sure it feels just right.</h2>
              <label className="field">
                A note for the studio (optional)
                <textarea
                  maxLength={1500}
                  rows={3}
                  value={design.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                  placeholder="Tell us about placement, your occasion, or anything we should know."
                />
              </label>
              <label className="check-field gift-check">
                <input
                  type="checkbox"
                  checked={design.gift}
                  onChange={(e) => update({ gift: e.target.checked })}
                />
                <span>
                  <strong>This is a gift</strong>
                  <small>
                    Add a message to your request. Packaging options are
                    confirmed during review.
                  </small>
                </span>
                <Icon name="gift" size={23} />
              </label>
              {design.gift && (
                <label className="field">
                  Gift message (optional)
                  <textarea
                    maxLength={300}
                    rows={2}
                    value={design.giftMessage}
                    onChange={(e) => update({ giftMessage: e.target.value })}
                    placeholder="A little note from you…"
                  />
                </label>
              )}
              <div className="config-summary">
                <p className="eyebrow">Your piece, at a glance</p>
                <strong>{info.title}</strong>
                <p>
                  {Object.values(design.options).join(" · ") ||
                    "Custom personalization"}{" "}
                  · Qty {design.quantity}
                </p>
                {design.text && (
                  <p>
                    “{design.text}” · {design.font}
                  </p>
                )}
                {design.artworkName && (
                  <p>
                    Artwork: {design.artworkName} · original file needed for
                    submission
                  </p>
                )}
                <span>Price, stock, and timing pending studio review.</span>
              </div>
              <button
                className="button primary full"
                onClick={() => {
                  if (validate()) store.addToCart(design);
                }}
              >
                Add design to bag <Icon name="bag" size={18} />
              </button>
              <div className="config-secondary">
                <button className="link-button" onClick={() => setStep(1)}>
                  Edit personalization
                </button>
                <Link href="/cart" className="text-link">
                  View your bag <Icon name="arrow" size={16} />
                </Link>
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button
          className="save-design-button"
          onClick={() => store.saveDesign(design)}
        >
          <Icon name="heart" size={18} /> Save this design for later
        </button>
        <button
          className="link-button"
          style={{ display: "block", margin: "12px auto 0" }}
          onClick={() => {
            store.saveDesign(design);
            const next = emptyDesign(product.slug);
            for (const o of info.options) next.options[o.label] = o.values[0];
            if (crystal) next.options["Crystal shape"] = crystal.shape;
            setDesign(next);
            setStep(0);
            setLocalURL("");
            setPhotoLater(false);
            setError("");
            store.notify("Previous design saved. A fresh design is ready.");
          }}
        >
          Save & start another design
        </button>
        <p className="privacy-caption">
          <Icon name="lock" size={13} />
          {store.storageAvailable
            ? "Drafts save on this device for 30 days."
            : "Device storage is unavailable; drafts will last for this visit only."}{" "}
          <Link href="/saved">Manage saved work</Link>
        </p>
        <div className="personal-promise">
          <Icon name="shield" />
          <p>
            <strong>Your story stays yours.</strong>
            <br />
            No artwork is sent to AI or included in analytics.
          </p>
        </div>
      </section>
    </div>
  );
}
