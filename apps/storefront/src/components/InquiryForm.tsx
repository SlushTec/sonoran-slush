"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  commerce,
  downloadJSON,
  newId,
  readLocal,
  writeLocal,
} from "@/lib/client";
import { catalog } from "@/lib/catalog";
import { categoryShort } from "@/lib/shop";
import { useStore } from "./Store";
import Icon from "./Icon";
const initial = {
  name: "",
  email: "",
  phone: "",
  organization: "",
  occasion: "Wedding",
  date: "",
  location: "",
  guests: "",
  quantity: "",
  family: "",
  design_type: "One shared design",
  budget: "",
  details: "",
  delivery: "Discuss with the studio",
};
type Values = typeof initial;
type Receipt = { id: string; status: string; access_token: string };
export default function InquiryForm({
  kind,
}: {
  kind: "event" | "bulk" | "contact";
}) {
  const { notify } = useStore(),
    [v, setV] = useState<Values>(initial),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [requestID, setRequestID] = useState(""),
    [step, setStep] = useState(0);
  const event = kind === "event",
    contact = kind === "contact";
  useEffect(() => {
    const saved = readLocal<{ values: Values; request_id: string } | null>(
      "inquiry:" + kind,
      null,
    );
    if (saved?.values && typeof saved.values.name === "string") {
      setV({ ...initial, ...saved.values });
      setRequestID(saved.request_id || newId());
    } else setRequestID(newId());
  }, [kind]);
  function field(k: keyof Values, val: string) {
    setV((a) => ({ ...a, [k]: val }));
  }
  function payload() {
    return {
      request_id: requestID,
      kind,
      name: v.name,
      email: v.email,
      phone: v.phone,
      organization: v.organization,
      occasion: v.occasion,
      date: v.date,
      location: v.location,
      guests: v.guests ? Number(v.guests) : null,
      quantity: v.quantity ? Number(v.quantity) : null,
      category: v.family,
      design_type: v.design_type,
      budget: v.budget,
      details: v.details,
      delivery: v.delivery,
      consent,
    };
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !consent) return;
    setBusy(true);
    setError("");
    try {
      setReceipt(
        await commerce<Receipt>(
          event
            ? "/v1/events/requests"
            : contact
              ? "/v1/contact"
              : "/v1/quotes",
          payload(),
        ),
      );
      try {
        localStorage.removeItem("sonoran:inquiry:" + kind);
      } catch {}
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your request could not be sent. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <div className="inquiry-form form-success">
        <Icon name="check" size={30} />
        <h3>
          {event
            ? "Your event inquiry is with the studio."
            : "Your request is with the studio."}
        </h3>
        <p>
          Reference: <strong>{receipt.id}</strong>
        </p>
        <p>
          {event
            ? "This is an inquiry. Your date is not reserved or confirmed until the studio reviews availability and agrees the booking with you."
            : "The studio will review the details. No payment or production commitment has been made."}
        </p>
        <p>
          Save your private receipt to retain the access code for this request.
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
    );
  const minimumDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <form className="inquiry-form" onSubmit={submit}>
      <h3>
        {event
          ? "Tell us about your occasion."
          : contact
            ? "Let’s start a conversation."
            : "A few details. A great starting point."}
      </h3>
      <div className="form-notice">
        This private review keeps your work in this form until you choose to
        submit or download it. Online submission requires the studio’s service
        connection.
      </div>
      {!contact && (
        <>
          <div className="saved-tabs" role="group" aria-label="Inquiry details">
            <button
              type="button"
              aria-pressed={step === 0}
              onClick={() => setStep(0)}
            >
              {event ? "Your event" : "Your project"}
            </button>
            <button
              type="button"
              aria-pressed={step === 1}
              onClick={() => setStep(1)}
            >
              Contact details
            </button>
          </div>
          <div style={{ display: step === 0 ? "block" : "none" }}>
            <div className="form-grid">
              {event ? (
                <>
                  <label className="field">
                    Occasion
                    <select
                      value={v.occasion}
                      onChange={(e) => field("occasion", e.target.value)}
                    >
                      {[
                        "Wedding",
                        "Anniversary",
                        "Graduation",
                        "Corporate gathering",
                        "Celebration of life",
                        "Festival or market",
                        "Private party",
                        "Other celebration",
                      ].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Requested event date
                    <input
                      type="date"
                      min={minimumDate}
                      value={v.date}
                      onChange={(e) => field("date", e.target.value)}
                    />
                    <span className="field-help">
                      A request does not hold a date.
                    </span>
                  </label>
                  <label className="field span-2">
                    Venue / city / state
                    <input
                      maxLength={250}
                      value={v.location}
                      onChange={(e) => field("location", e.target.value)}
                      placeholder="e.g. Tucson, Arizona"
                    />
                  </label>
                  <label className="field">
                    Approximate guest count
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={v.guests}
                      onChange={(e) => field("guests", e.target.value)}
                      placeholder="An estimate is fine"
                    />
                  </label>
                  <label className="field">
                    Desired pieces (optional)
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={v.quantity}
                      onChange={(e) => field("quantity", e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="field span-2">
                    Product family
                    <select
                      value={v.family}
                      onChange={(e) => field("family", e.target.value)}
                    >
                      <option value="">Help me choose / mixed products</option>
                      {catalog.categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {categoryShort[c.slug]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Approximate quantity
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={v.quantity}
                      onChange={(e) => field("quantity", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Ideal delivery date
                    <input
                      type="date"
                      min={minimumDate}
                      value={v.date}
                      onChange={(e) => field("date", e.target.value)}
                    />
                  </label>
                  <label className="field span-2">
                    Designs across the order
                    <select
                      value={v.design_type}
                      onChange={(e) => field("design_type", e.target.value)}
                    >
                      <option>One shared design</option>
                      <option>Shared design + individual names</option>
                      <option>Different designs on each piece</option>
                      <option>Not sure yet</option>
                    </select>
                    <span className="field-help">
                      Shared artwork and individually personalized pieces are
                      quoted separately.
                    </span>
                  </label>
                </>
              )}
              <label className="field span-2">
                Budget or range (optional)
                <input
                  maxLength={100}
                  value={v.budget}
                  onChange={(e) => field("budget", e.target.value)}
                  placeholder="A rough idea is helpful; no commitment."
                />
              </label>
              <label className="field span-2">
                Your idea
                <textarea
                  rows={4}
                  maxLength={3000}
                  value={v.details}
                  onChange={(e) => field("details", e.target.value)}
                  placeholder={
                    event
                      ? "Tell us about the experience, products, and space you have in mind."
                      : "Tell us about the occasion, products, artwork, or names you have in mind."
                  }
                />
              </label>
            </div>
            <p className="field-help">
              Final artwork can come later. Please keep personal documents and
              sensitive files out of this form.
            </p>
            <button
              type="button"
              className="button primary full"
              style={{ marginTop: 18 }}
              onClick={() => setStep(1)}
            >
              Add contact details <Icon name="arrow" size={17} />
            </button>
          </div>
        </>
      )}
      <div style={{ display: contact || step === 1 ? "block" : "none" }}>
        <div className="form-grid">
          <label className="field">
            Your name
            <input
              required={contact || step === 1}
              name="name"
              autoComplete="name"
              maxLength={100}
              value={v.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label className="field">
            Email address
            <input
              type="email"
              required={contact || step === 1}
              name="email"
              autoComplete="email"
              maxLength={254}
              value={v.email}
              onChange={(e) => field("email", e.target.value)}
            />
          </label>
          <label className="field">
            Phone (optional)
            <input
              type="tel"
              autoComplete="tel"
              maxLength={30}
              value={v.phone}
              onChange={(e) => field("phone", e.target.value)}
            />
          </label>
          <label className="field">
            Company / organization (optional)
            <input
              autoComplete="organization"
              maxLength={150}
              value={v.organization}
              onChange={(e) => field("organization", e.target.value)}
            />
          </label>
          {contact && (
            <label className="field span-2">
              How can we help?
              <textarea
                required
                maxLength={3000}
                rows={5}
                value={v.details}
                onChange={(e) => field("details", e.target.value)}
              />
            </label>
          )}
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            required={contact || step === 1}
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Use my contact details to reply to this request. This is not a
            marketing signup. <Link href="/privacy">Privacy information</Link>
          </span>
        </label>
        <button className="button primary full" type="submit" disabled={busy}>
          {busy
            ? "Sending…"
            : event
              ? "Send event inquiry"
              : "Send your request"}
          <Icon name="arrow" size={17} />
        </button>
        {!contact && (
          <button
            className="link-button"
            type="button"
            style={{ marginTop: 12 }}
            onClick={() => setStep(0)}
          >
            Back to {event ? "event" : "project"} details
          </button>
        )}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-divider">
        <div className="form-actions">
          <button
            type="button"
            className="button outline"
            onClick={() => {
              const ok = writeLocal("inquiry:" + kind, {
                values: v,
                request_id: requestID,
              });
              notify(
                ok
                  ? "Request draft saved on this device for 30 days."
                  : "Device storage is unavailable. Download your draft instead.",
              );
            }}
          >
            Save draft on this device
          </button>
          <button
            type="button"
            className="button outline"
            onClick={() =>
              downloadJSON("sonoran-slush-" + kind + "-draft.json", {
                ...payload(),
                status: "unsent_draft",
                consent: false,
              })
            }
          >
            <Icon name="download" size={14} /> Download draft
          </button>
        </div>
        <p className="field-help" style={{ marginTop: 12 }}>
          Saving a draft stores your form details in this browser for 30 days.{" "}
          <Link href="/saved">Clear device data</Link> any time. Downloading
          does not submit a request.
        </p>
      </div>
    </form>
  );
}
