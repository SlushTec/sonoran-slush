"use client";
import { useEffect, useRef, useState } from "react";
import { commerce } from "@/lib/client";
type Item = {
  product_slug: string;
  quantity: number;
  text?: string;
  secondary?: string;
  font?: string;
};
type Quote = {
  id: string;
  kind: "retail" | "bulk" | "event" | "contact";
  version: number;
  status: "submitted" | "offered" | "accepted";
  accepted_version?: number | null;
  total_minor: number | null;
  currency: "USD";
  message?: string;
  next_step?: string;
  items?: Item[];
};
type Session = { id: string; token: string; generation: number };
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function text(v: unknown, max: number, min = 0): v is string {
  if (typeof v !== "string" || v.length > max * 2) return false;
  let n = 0;
  for (const c of v) {
    const cp = c.codePointAt(0)!;
    if (++n > max || (cp >= 0xd800 && cp <= 0xdfff)) return false;
  }
  return n >= min;
}
function positive(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}
function record(v: unknown, id: string): Quote {
  if (
    !object(v) ||
    v.id !== id ||
    typeof v.kind !== "string" ||
    !["retail", "bulk", "event", "contact"].includes(v.kind) ||
    !positive(v.version) ||
    typeof v.status !== "string" ||
    !["submitted", "offered", "accepted"].includes(v.status) ||
    v.currency !== "USD" ||
    !(
      v.total_minor === null ||
      (positive(v.total_minor) && v.total_minor <= 99999999)
    ) ||
    (v.message !== undefined && !text(v.message, 3000, 1)) ||
    (v.next_step !== undefined && !text(v.next_step, 3000)) ||
    (v.accepted_version !== undefined &&
      v.accepted_version !== null &&
      !positive(v.accepted_version)) ||
    (v.status === "accepted" &&
      (v.kind === "contact" ||
        v.accepted_version !== v.version ||
        v.total_minor === null ||
        !text(v.message, 3000, 1))) ||
    (v.status !== "accepted" &&
      v.accepted_version !== undefined &&
      v.accepted_version !== null) ||
    (v.items !== undefined &&
      (!Array.isArray(v.items) ||
        v.items.length > 100 ||
        v.items.some(
          (x) =>
            !object(x) ||
            !text(x.product_slug, 100, 1) ||
            !positive(x.quantity) ||
            x.quantity > 500 ||
            (x.text !== undefined && !text(x.text, 120)) ||
            (x.secondary !== undefined && !text(x.secondary, 120)) ||
            (x.font !== undefined &&
              (typeof x.font !== "string" ||
                !["Classic serif", "Modern sans", "Handwritten"].includes(
                  x.font,
                ))),
        )))
  )
    throw Error("Unverified quote response");
  return v as Quote;
}
function terms(q: Quote) {
  return JSON.stringify({
    total: q.total_minor,
    currency: q.currency,
    message: q.message ?? null,
    items:
      q.items?.map((x) => ({
        product_slug: x.product_slug,
        quantity: x.quantity,
        text: x.text ?? null,
        secondary: x.secondary ?? null,
        font: x.font ?? null,
      })) ?? null,
  });
}
function eligible(q: Quote) {
  return (
    q.kind !== "contact" &&
    q.status === "offered" &&
    positive(q.total_minor) &&
    text(q.message, 3000, 1) &&
    !!q.message.trim()
  );
}
export default function QuoteReviewPortal() {
  const [id, setID] = useState(""),
    [token, setToken] = useState(""),
    [data, setData] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState(false),
    [page, setPage] = useState(0);
  const generation = useRef(0),
    session = useRef<Session | null>(null),
    locked = useRef(false);
  function clear() {
    generation.current++;
    session.current = null;
    locked.current = false;
    setData(null);
    setBusy(false);
    setError("");
    setNotice("");
    setConfirm(false);
    setPage(0);
  }
  function close() {
    clear();
    setID("");
    setToken("");
  }
  useEffect(() => {
    const leave = () => close(),
      restore = (e: PageTransitionEvent) => {
        if (e.persisted) close();
      };
    window.addEventListener("popstate", leave);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      generation.current++;
      session.current = null;
      locked.current = false;
      window.removeEventListener("popstate", leave);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
    };
  }, []);
  const active = (s: Session) =>
    session.current === s && generation.current === s.generation;
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    clear();
    const reference = id.trim(),
      capability = token.trim();
    if (!text(reference, 100, 1) || !text(capability, 500, 1)) {
      setError("Enter your request reference and private access code.");
      return;
    }
    const s = {
      id: reference,
      token: capability,
      generation: generation.current,
    };
    session.current = s;
    locked.current = true;
    setBusy(true);
    try {
      const q = record(
        await commerce<unknown>(
          "/v1/quotes/" + encodeURIComponent(s.id),
          undefined,
          s.token,
        ),
        s.id,
      );
      if (active(s)) setData(q);
    } catch {
      if (active(s))
        setError(
          "This request could not be verified. Check your reference and private access code, then retry.",
        );
    } finally {
      if (active(s)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  async function accept() {
    const s = session.current,
      q = data;
    if (
      !s ||
      !active(s) ||
      locked.current ||
      !q ||
      !confirm ||
      !eligible(q) ||
      q.id !== s.id
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await commerce<unknown>(
        "/v1/quotes/" + encodeURIComponent(q.id) + "/accept",
        { version: q.version, decision: "accept" },
        s.token,
      );
      if (!active(s)) return;
      const accepted = record(result, s.id);
      if (
        accepted.kind !== q.kind ||
        accepted.version !== q.version ||
        accepted.status !== "accepted" ||
        accepted.accepted_version !== q.version ||
        terms(accepted) !== terms(q)
      )
        throw Error("Acceptance terms mismatch");
      setData(accepted);
      setConfirm(false);
      setNotice(
        "Acceptance of quote version " +
          q.version +
          " is recorded for the holder of this private access code. Payment and booking are separate.",
      );
    } catch {
      if (active(s)) {
        setData(null);
        setConfirm(false);
        setError(
          "Acceptance could not be verified against the displayed quote. Reopen the current request or contact the studio; no acceptance is confirmed here.",
        );
      }
    } finally {
      if (active(s)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div className="lookup-layout">
      <div>
        <form className="lookup-card" onSubmit={lookup}>
          <h2>Your custom request</h2>
          <p>
            Use the reference and private access code from your studio receipt.
            An account is not required.
          </p>
          <label className="field">
            Request reference
            <input
              required
              maxLength={100}
              autoComplete="off"
              value={id}
              onChange={(e) => {
                clear();
                setID(e.target.value);
              }}
            />
          </label>
          <label className="field">
            Private access code
            <input
              type="password"
              required
              maxLength={500}
              autoComplete="off"
              value={token}
              onChange={(e) => {
                clear();
                setToken(e.target.value);
              }}
            />
          </label>
          <button className="button primary full" disabled={busy}>
            Open securely
          </button>
          <p>
            Access codes stay in memory for this visit. Closing or leaving
            clears this private session.
          </p>
        </form>
        {(data || busy || error) && (
          <button className="link-button" type="button" onClick={close}>
            Close private record
          </button>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="form-success" role="status">
            {notice}
          </p>
        )}
        {data && (
          <section
            className="order-result"
            aria-label="Current request"
            style={{ marginTop: 32, overflowWrap: "anywhere" }}
          >
            <h2>Current request</h2>
            <p>{data.id}</p>
            <p>
              Version {data.version} · {data.status}
            </p>
            {data.total_minor === null ? (
              <p>The studio has not priced this request yet.</p>
            ) : (
              <div className="summary-row">
                <strong>Reviewed total</strong>
                <span>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(data.total_minor / 100)}
                </span>
              </div>
            )}
            {data.message && (
              <>
                <h3>Reviewed quote details</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{data.message}</p>
              </>
            )}
            {!!data.items?.length && (
              <>
                <h3 style={{ marginTop: 28 }}>Recorded items</h3>
                <ul>
                  {data.items.slice(page * 10, page * 10 + 10).map((x, i) => (
                    <li key={page * 10 + i} style={{ marginBottom: 16 }}>
                      <strong>{x.product_slug}</strong> · quantity {x.quantity}
                      {x.text && (
                        <p style={{ whiteSpace: "pre-wrap" }}>{x.text}</p>
                      )}
                      {x.secondary && (
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          Second inscription: {x.secondary}
                        </p>
                      )}
                      {x.font && <p>Font: {x.font}</p>}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous items
                </button>{" "}
                <button
                  type="button"
                  disabled={(page + 1) * 10 >= data.items.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next items
                </button>
              </>
            )}
            {data.next_step && (
              <p style={{ whiteSpace: "pre-wrap", marginTop: 24 }}>
                {data.next_step}
              </p>
            )}
            {data.status === "accepted" && (
              <p className="form-notice">
                The studio record shows acceptance of this exact quote version
                by its private access-code holder. This does not identify a
                person or confirm payment, booking or production.
              </p>
            )}
            {eligible(data) ? (
              <>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={confirm}
                    disabled={busy}
                    onChange={(e) => setConfirm(e.target.checked)}
                  />
                  <span>
                    I accept quote version {data.version} and its displayed
                    details. Payment and booking are separate steps.
                  </span>
                </label>
                <button
                  type="button"
                  className="button primary full"
                  disabled={!confirm || busy}
                  onClick={accept}
                >
                  Accept quote version {data.version}
                </button>
              </>
            ) : (
              data.status !== "accepted" && (
                <p className="form-notice">
                  {data.kind === "contact"
                    ? "This contact request is read only."
                    : "A complete current offer is required before acceptance is available."}
                </p>
              )
            )}
          </section>
        )}
      </div>
      <aside className="prose">
        <h2>A clear next step.</h2>
        <p>
          Review the actual price and details before accepting. Acceptance
          applies only to the displayed version.
        </p>
        <div className="form-notice">
          <h3>Separate decisions</h3>
          <p>
            Quote acceptance does not take payment, reserve an event booking or
            approve production. The studio checks those separately.
          </p>
        </div>
      </aside>
    </div>
  );
}
