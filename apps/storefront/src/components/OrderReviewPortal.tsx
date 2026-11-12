"use client";
import { useEffect, useRef, useState } from "react";
import { commerce } from "@/lib/client";

type Order = {
  id: string;
  kind: "order";
  version: number;
  status: string;
  payment_status: string;
  proof_status: string;
  total_minor: number | null;
  currency: string;
  next_step?: string;
  test_payment_available?: boolean;
  items?: { product_slug: string; quantity: number }[];
  timeline?: { label: string; at: string }[];
  shipment?: { carrier: string; tracking: string };
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
    if (
      ++n > max ||
      (cp >= 0xd800 && cp <= 0xdfff) ||
      cp < 32 ||
      (cp >= 127 && cp <= 159)
    )
      return false;
  }
  return n >= min;
}
function integer(v: unknown, min = 1): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= min;
}
function record(v: unknown, id: string): Order {
  if (
    !object(v) ||
    v.id !== id ||
    v.kind !== "order" ||
    !integer(v.version) ||
    !text(v.status, 80, 1) ||
    !text(v.payment_status, 80, 1) ||
    !text(v.proof_status, 80, 1) ||
    !(v.total_minor === null || integer(v.total_minor, 0)) ||
    !text(v.currency, 3, 3) ||
    (v.next_step !== undefined && !text(v.next_step, 3000)) ||
    (v.test_payment_available !== undefined &&
      typeof v.test_payment_available !== "boolean") ||
    (v.items !== undefined &&
      (!Array.isArray(v.items) ||
        v.items.length > 100 ||
        v.items.some(
          (x) =>
            !object(x) ||
            !text(x.product_slug, 100, 1) ||
            !integer(x.quantity) ||
            x.quantity > 500,
        ))) ||
    (v.timeline !== undefined &&
      (!Array.isArray(v.timeline) ||
        v.timeline.length > 1000 ||
        v.timeline.some(
          (x) =>
            !object(x) ||
            !text(x.label, 500, 1) ||
            !text(x.at, 64, 1) ||
            !/^\d{4}-\d{2}-\d{2}T/.test(x.at) ||
            !Number.isFinite(Date.parse(x.at)),
        ))) ||
    (v.shipment !== undefined &&
      (!object(v.shipment) ||
        !text(v.shipment.carrier, 200, 1) ||
        !text(v.shipment.tracking, 500, 1)))
  ) {
    throw new Error(
      "This order response could not be verified. Reopen the current record or contact the studio.",
    );
  }
  return v as Order;
}
export function squareSandboxAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^https:\/\/sandbox\.square\.link(?::443)?\/u\/[A-Za-z0-9_-]+$/.exec(value);
  return !!match && match[0] === value;
}
function checkout(v: unknown): string {
  if (
    !object(v) ||
    v.provider !== "square" ||
    v.test_mode !== true ||
    !text(v.session_id, 1000, 1) ||
    !v.session_id.trim() ||
    !squareSandboxAddress(v.url)
  ) {
    throw new Error(
      "The Square sandbox payment address could not be verified. No checkout was opened.",
    );
  }
  return v.url;
}
function eligible(o: Order) {
  return (
    o.test_payment_available === true &&
    o.payment_status === "unpaid" &&
    o.status !== "cancelled" &&
    integer(o.total_minor) &&
    o.currency === "USD"
  );
}

function summaryProjection(order: Order) {
  return {
    id: order.id,
    version: order.version,
    status: order.status,
    payment_status: order.payment_status,
    proof_status: order.proof_status,
    total_minor: order.total_minor,
    currency: order.currency,
    next_step: order.next_step ?? "",
    items: (order.items ?? []).map(({ product_slug, quantity }) => ({
      product_slug,
      quantity,
    })),
    timeline: (order.timeline ?? []).map(({ label, at }) => ({ label, at })),
    shipment: order.shipment
      ? { carrier: order.shipment.carrier, tracking: order.shipment.tracking }
      : null,
  };
}
function summaryValue(value: string) {
  return value.replace(
    /[\p{Cf}\u2028\u2029]/gu,
    (c) => "\\u{" + c.codePointAt(0)!.toString(16).toUpperCase() + "}",
  );
}
function summaryText(order: Order) {
  const o = summaryProjection(order),
    safe = summaryValue;
  return [
    "Sonoran Slush - Order summary",
    "Not a paid receipt or tax invoice.",
    "This is a point-in-time summary, not proof of payment, booking or production approval.",
    "Private order details: the downloaded file remains on your device after Close.",
    "",
    "Order reference: " + safe(o.id),
    "Version: " + o.version,
    "Order status: " + safe(o.status),
    "Payment status: " + safe(o.payment_status),
    "Proof status: " + safe(o.proof_status),
    "Reviewed total: " +
      (o.total_minor === null
        ? "Not yet quoted"
        : o.currency === "USD"
          ? "USD " +
            (BigInt(o.total_minor) / BigInt(100)).toString() +
            "." +
            (BigInt(o.total_minor) % BigInt(100)).toString().padStart(2, "0")
          : o.total_minor +
            " minor units (" +
            safe(o.currency) +
            "; decimal convention not assumed)"),
    "Next step: " + safe(o.next_step),
    "",
    "Recorded items:",
    ...o.items.map(
      (x, i) =>
        i + 1 + ". " + safe(x.product_slug) + " | Quantity: " + x.quantity,
    ),
    "",
    "Recorded history:",
    ...o.timeline.map(
      (x, i) => i + 1 + ". " + safe(x.at) + " | " + safe(x.label),
    ),
    ...(o.shipment
      ? [
          "",
          "Carrier: " + safe(o.shipment.carrier),
          "Tracking: " + safe(o.shipment.tracking),
        ]
      : []),
    "",
  ].join("\n");
}

export default function OrderReviewPortal() {
  const [id, setID] = useState(""),
    [token, setToken] = useState("");
  const [data, setData] = useState<Order | null>(null),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  function releaseDownloads() {
    for (const [url, timer] of urls.current) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    urls.current.clear();
  }
  const [error, setError] = useState(""),
    [itemPage, setItemPage] = useState(0),
    [eventPage, setEventPage] = useState(0);
  const generation = useRef(0),
    session = useRef<Session | null>(null),
    locked = useRef(false);
  function clear() {
    releaseDownloads();
    setNotice("");
    generation.current++;
    session.current = null;
    locked.current = false;
    setData(null);
    setBusy(false);
    setError("");
    setItemPage(0);
    setEventPage(0);
  }
  function close() {
    clear();
    setID("");
    setToken("");
  }
  useEffect(() => {
    const leave = () => close();
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) close();
    };
    window.addEventListener("popstate", leave);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      releaseDownloads();
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
      setError("Enter your order reference and private access code.");
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
      const result = record(
        await commerce<unknown>(
          "/v1/orders/" + encodeURIComponent(s.id),
          undefined,
          s.token,
        ),
        s.id,
      );
      if (active(s)) setData(result);
    } catch {
      if (active(s))
        setError(
          "This order could not be verified. Check your reference and private access code, then retry.",
        );
    } finally {
      if (active(s)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  async function downloadSummary() {
    const s = session.current,
      order = data;
    if (!s || !active(s) || locked.current || !order || order.id !== s.id)
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!text(s.id, 160, 1)) throw new Error("Invalid order reference.");
      const refreshed = record(
        await commerce<unknown>(
          "/v1/orders/" + encodeURIComponent(s.id),
          undefined,
          s.token,
        ),
        s.id,
      );
      if (!active(s)) return;
      if (
        JSON.stringify(summaryProjection(refreshed)) !==
        JSON.stringify(summaryProjection(order))
      ) {
        setData(refreshed);
        setItemPage(0);
        setEventPage(0);
        setNotice(
          "The order changed. Review the refreshed details, then choose Download order summary again. No file was created.",
        );
        return;
      }
      if (!active(s)) return;
      const blob = new Blob([summaryText(refreshed)], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }, 1000);
      urls.current.set(url, timer);
      const anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download =
          "sonoran-order-" +
          s.id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) +
          ".txt";
        document.body.appendChild(anchor);
        if (!active(s)) {
          releaseDownloads();
          return;
        }
        anchor.click();
        if (active(s))
          setNotice(
            "Order-summary download requested. This is not a paid receipt or tax invoice. The private file remains on your device after Close.",
          );
      } catch (error) {
        releaseDownloads();
        throw error;
      } finally {
        anchor.remove();
      }
    } catch {
      if (active(s))
        setError(
          "The order summary could not be verified or downloaded. No payment is confirmed. Reopen the order or retry.",
        );
    } finally {
      if (active(s)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  async function pay() {
    const s = session.current,
      order = data;
    if (
      !s ||
      !active(s) ||
      locked.current ||
      !order ||
      order.id !== s.id ||
      !eligible(order)
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await commerce<unknown>(
        "/v1/checkout/sessions",
        { order_id: order.id, version: order.version },
        s.token,
      );
      if (!active(s)) return;
      const url = checkout(result);
      if (active(s)) window.location.assign(url);
    } catch {
      if (active(s)) {
        setData(null);
        setError(
          "Checkout could not be verified or the order changed. Reopen the current order before retrying. No payment is confirmed here.",
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
          <h2>Order updates</h2>
          <p className="form-intro">
            Use the reference and private access code from your studio receipt.
          </p>
          <label className="field">
            Order reference
            <input
              value={id}
              maxLength={100}
              required
              autoComplete="off"
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
              value={token}
              maxLength={500}
              required
              autoComplete="off"
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
            Access codes stay in memory for this visit. Closing the record or
            leaving clears this private session.
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
        {data && (
          <section
            className="order-result"
            style={{ marginTop: 32, overflowWrap: "anywhere" }}
            aria-label="Current order"
          >
            <h2>Current order</h2>
            <p>{data.id}</p>
            <p>
              Version {data.version} · {data.status.replaceAll("_", " ")}
            </p>
            <div className="summary-row">
              <span>Payment</span>
              <span>{data.payment_status}</span>
            </div>
            <div className="summary-row">
              <span>Proof approval</span>
              <span>{data.proof_status.replaceAll("_", " ")}</span>
            </div>
            {data.total_minor !== null && data.currency === "USD" && (
              <div className="summary-row">
                <span>Reviewed total</span>
                <span>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(data.total_minor / 100)}
                </span>
              </div>
            )}
            {data.next_step && <p>{data.next_step}</p>}
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={downloadSummary}
            >
              Download order summary
            </button>
            <p>Private local file, not a paid receipt or tax invoice.</p>
            {notice && (
              <p className="form-notice" role="status">
                {notice}
              </p>
            )}
            {eligible(data) ? (
              <div className="form-notice">
                <p>
                  Square sandbox checkout is available for this reviewed order.
                  No live payment is enabled.
                </p>
                <button
                  className="button primary"
                  type="button"
                  disabled={busy}
                  onClick={pay}
                >
                  Open Square sandbox checkout
                </button>
              </div>
            ) : (
              <p className="form-notice">
                Square sandbox checkout is not available for this current order.
                The studio must confirm the required order and payment
                conditions.
              </p>
            )}
            {data.shipment && (
              <div className="form-notice">
                <strong>{data.shipment.carrier}</strong>
                <p>Tracking reference: {data.shipment.tracking}</p>
              </div>
            )}
            {!!data.items?.length && (
              <>
                <h3 style={{ marginTop: 28 }}>Recorded items</h3>
                <ul>
                  {data.items
                    .slice(itemPage * 10, itemPage * 10 + 10)
                    .map((x, i) => (
                      <li key={itemPage * 10 + i}>
                        {x.product_slug} · quantity {x.quantity}
                      </li>
                    ))}
                </ul>
                <button
                  type="button"
                  disabled={itemPage === 0}
                  onClick={() => setItemPage((p) => p - 1)}
                >
                  Previous items
                </button>{" "}
                <button
                  type="button"
                  disabled={(itemPage + 1) * 10 >= data.items.length}
                  onClick={() => setItemPage((p) => p + 1)}
                >
                  Next items
                </button>
              </>
            )}
            {!!data.timeline?.length && (
              <>
                <h3 style={{ marginTop: 28 }}>Order history</h3>
                <ol>
                  {data.timeline
                    .slice(eventPage * 25, eventPage * 25 + 25)
                    .map((x, i) => (
                      <li key={eventPage * 25 + i}>
                        {x.label}
                        <p>{new Date(x.at).toLocaleString()}</p>
                      </li>
                    ))}
                </ol>
                <button
                  type="button"
                  disabled={eventPage === 0}
                  onClick={() => setEventPage((p) => p - 1)}
                >
                  Previous events
                </button>{" "}
                <button
                  type="button"
                  disabled={(eventPage + 1) * 25 >= data.timeline.length}
                  onClick={() => setEventPage((p) => p + 1)}
                >
                  Next events
                </button>
              </>
            )}
          </section>
        )}
      </div>
      <aside>
        <h2>A private update.</h2>
        <p>
          Opening a checkout does not confirm payment. Payment, proof approval
          and production readiness are checked separately by the studio.
        </p>
        <div className="form-notice">
          <h3>Sandbox, not live payment</h3>
          <p>
            This connection is for testing only. No live processor or
            manufacturing approval is enabled here.
          </p>
        </div>
      </aside>
    </div>
  );
}
