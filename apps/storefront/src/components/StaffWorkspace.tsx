"use client";
import { useEffect, useRef, useState } from "react";
import { commerce, downloadJSON } from "@/lib/client";
import Icon from "./Icon";
import RecordedPersonalization from "./RecordedPersonalization";
import RecordedHistory from "./RecordedHistory";
type Doc = {
  id: string;
  kind: string;
  status: string;
  version: number;
  name?: string;
  email?: string;
  details?: string;
  notes?: string;
  message?: string;
  location?: string;
  date?: string | null;
  quantity?: number | null;
  design_type?: string;
  total_minor?: number | null;
  current_proof_version?: number;
  proof_status?: string;
  payment_status?: string;
  items?: { product_slug: string; quantity: number; text: string }[];
};
type Session = { token: string; generation: number };
type Receipt = { id: string; status: string; access_token: string };
type Summary = {
  counts: Record<string, number>;
  recent: { id: string; kind: string; status: string; created_at: string }[];
};
export default function StaffWorkspace() {
  const [token, setToken] = useState(""),
    [summary, setSummary] = useState<Summary | null>(null),
    [doc, setDoc] = useState<Doc | null>(null),
    [ref, setRef] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [price, setPrice] = useState(""),
    [proof, setProof] = useState(""),
    [inventory, setInventory] = useState(false),
    [capacity, setCapacity] = useState(false),
    [tracking, setTracking] = useState(""),
    [carrier, setCarrier] = useState(""),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [outcome, setOutcome] = useState("");
  const generation = useRef(0),
    context = useRef(0),
    session = useRef<Session | null>(null),
    locked = useRef(false);
  function clearDrafts() {
    setDoc(null);
    setReceipt(null);
    setPrice("");
    setMessage("");
    setProof("");
    setInventory(false);
    setCapacity(false);
    setTracking("");
    setCarrier("");
    setOutcome("");
  }
  function invalidateRecord() {
    context.current++;
    locked.current = false;
    setBusy(false);
    setError("");
    clearDrafts();
  }
  function lock() {
    generation.current++;
    session.current = null;
    invalidateRecord();
    setToken("");
    setSummary(null);
    setRef("");
  }
  useEffect(() => {
    const leave = () => lock(),
      restore = (e: PageTransitionEvent) => {
        if (e.persisted) lock();
      };
    window.addEventListener("popstate", leave);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      generation.current++;
      context.current++;
      session.current = null;
      locked.current = false;
      window.removeEventListener("popstate", leave);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
    };
  }, []);
  const active = (s: Session, c: number) =>
    session.current === s &&
    generation.current === s.generation &&
    context.current === c;
  function validDoc(value: unknown): value is Doc {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return false;
    const d = value as Doc;
    return (
      typeof d.id === "string" &&
      d.id.length > 0 &&
      d.id.length <= 100 &&
      typeof d.kind === "string" &&
      typeof d.status === "string" &&
      Number.isSafeInteger(d.version) &&
      d.version > 0 &&
      [
        d.name,
        d.email,
        d.details,
        d.notes,
        d.message,
        d.location,
        d.design_type,
        d.proof_status,
        d.payment_status,
      ].every((v) => v === undefined || typeof v === "string") &&
      (d.total_minor === undefined ||
        d.total_minor === null ||
        (Number.isSafeInteger(d.total_minor) && d.total_minor >= 0)) &&
      (d.current_proof_version === undefined ||
        (Number.isSafeInteger(d.current_proof_version) &&
          d.current_proof_version >= 0)) &&
      (d.date === undefined || d.date === null || typeof d.date === "string") &&
      (d.quantity === undefined ||
        d.quantity === null ||
        (Number.isSafeInteger(d.quantity) && d.quantity > 0)) &&
      (d.items === undefined ||
        (Array.isArray(d.items) &&
          d.items.length <= 100 &&
          d.items.every(
            (i) =>
              i &&
              typeof i === "object" &&
              typeof i.product_slug === "string" &&
              Number.isSafeInteger(i.quantity) &&
              i.quantity > 0 &&
              (i.text === undefined || typeof i.text === "string"),
          )))
    );
  }
  async function overview(s: Session, c: number) {
    if (!active(s, c)) return;
    const value = await commerce<Summary>(
      "/v1/admin/summary",
      undefined,
      s.token,
    );
    if (!active(s, c)) return;
    if (
      !value ||
      typeof value !== "object" ||
      !value.counts ||
      typeof value.counts !== "object" ||
      Array.isArray(value.counts) ||
      !Array.isArray(value.recent) ||
      Object.values(value.counts).some(
        (n) => !Number.isSafeInteger(n) || n < 0,
      ) ||
      value.recent.some(
        (r) =>
          !r ||
          typeof r.id !== "string" ||
          typeof r.kind !== "string" ||
          typeof r.status !== "string",
      )
    )
      throw Error("Summary response could not be verified.");
    setSummary(value);
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (locked.current) return;
    const credential = token.trim();
    lock();
    setToken(credential);
    if (!credential) return;
    const s = { token: credential, generation: generation.current },
      c = context.current;
    session.current = s;
    locked.current = true;
    setBusy(true);
    try {
      await overview(s, c);
    } catch {
      if (active(s, c)) setError("Staff access could not be verified.");
    } finally {
      if (active(s, c)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  async function openRecord(id: string) {
    const s = session.current;
    if (!s || generation.current !== s.generation || locked.current) return;
    invalidateRecord();
    const c = context.current,
      recordID = id.trim();
    setRef(recordID);
    locked.current = true;
    setBusy(true);
    try {
      const d = await commerce<Doc>(
        "/v1/admin/records/" + encodeURIComponent(recordID),
        undefined,
        s.token,
      );
      if (!active(s, c)) return;
      if (!validDoc(d) || d.id !== recordID) throw Error("Record mismatch");
      setDoc(d);
      setPrice(d.total_minor != null ? (d.total_minor / 100).toFixed(2) : "");
      setMessage(d.message || "");
    } catch {
      if (active(s, c))
        setError("The record could not be verified. Reopen it before acting.");
    } finally {
      if (active(s, c)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  async function action(path: string, body: unknown) {
    const s = session.current,
      d = doc,
      c = context.current;
    if (!s || !d || !active(s, c) || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setOutcome("");
    setReceipt(null);
    let confirmed = false;
    try {
      const result = await commerce<Doc | Receipt>(path, body, s.token);
      if (!active(s, c)) return;
      if (path === "/v1/admin/orders" || path === "/v1/admin/proofs") {
        const r = result as Receipt,
          prefix = path.endsWith("/orders") ? "ord_" : "prf_";
        if (
          !r ||
          typeof r.id !== "string" ||
          !r.id.startsWith(prefix) ||
          r.id.length > 100 ||
          typeof r.status !== "string" ||
          typeof r.access_token !== "string" ||
          !r.access_token ||
          r.access_token.length > 1000
        )
          throw Error("Receipt mismatch");
        setReceipt(r);
      } else {
        if (
          !validDoc(result) ||
          result.id !== d.id ||
          result.kind !== d.kind ||
          result.version < d.version
        )
          throw Error("Action response mismatch");
        setDoc(result);
      }
      confirmed = true;
      setOutcome(
        "The service confirmed this action. Payment and production gates remain separate.",
      );
      if (!active(s, c)) return;
      await overview(s, c);
    } catch {
      if (active(s, c)) {
        if (confirmed)
          setError(
            "The action was confirmed, but the overview could not refresh. Do not repeat the action; reopen the record to reconcile.",
          );
        else {
          setDoc(null);
          setReceipt(null);
          setError(
            "The action could not be confirmed. Reopen the record to reconcile before retrying.",
          );
        }
      }
    } finally {
      if (active(s, c)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  function offer() {
    if (!doc || locked.current) return;
    if (!/^\d+(\.\d{1,2})?$/.test(price) || !message.trim()) {
      setError(
        "Enter a reviewed USD total with up to two decimal places and the complete quote details.",
      );
      return;
    }
    const [whole, fraction = ""] = price.split(".");
    const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    action("/v1/admin/quotes/" + doc.id + "/offer", {
      version: doc.version,
      total_minor: minor,
      message,
    });
  }
  if (!summary)
    return (
      <div className="lookup-layout">
        <div>
          <form className="lookup-card" onSubmit={login}>
            <h2>Staff access</h2>
            <p>
              Private work requires an authorized studio credential, separate
              from customer access.
            </p>
            <label className="field">
              Staff access code
              <input
                type="password"
                required
                autoComplete="off"
                value={token}
                onChange={(e) => {
                  lock();
                  setToken(e.target.value);
                }}
                maxLength={500}
              />
            </label>
            <button className="button primary full" disabled={busy}>
              Open workspace <Icon name="lock" size={16} />
            </button>
          </form>
          {busy && (
            <button type="button" className="link-button" onClick={lock}>
              Lock workspace
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="prose">
          <h2>A clear view of the work.</h2>
          <p>
            Review requests, prepare quotes, manage exact proof versions, and
            follow each piece through production.
          </p>
          <div className="notice">
            <h2>Private by default.</h2>
            <p>
              No business metrics or customer records are embedded in this
              storefront. Records load only after access is verified.
            </p>
          </div>
        </div>
      </div>
    );
  return (
    <div style={{ paddingBottom: 70 }}>
      <div className="section-heading">
        <h2>Needs a little attention.</h2>
        <button className="link-button" onClick={lock}>
          Lock workspace
        </button>
      </div>
      <p className="field-help">
        Lock hides and forgets this browser session. It does not cancel actions
        already sent to the service.
      </p>
      <div className="dashboard-grid">
        {Object.entries(summary.counts).map(([s, n]) => (
          <article className="dashboard-card" key={s}>
            <p className="eyebrow">{s.replaceAll("_", " ")}</p>
            <h2 style={{ fontSize: 40, marginTop: 12 }}>{n}</h2>
          </article>
        ))}
      </div>
      <div className="lookup-layout" style={{ marginTop: 35 }}>
        <div>
          <form
            className="lookup-card"
            onSubmit={(e) => {
              e.preventDefault();
              openRecord(ref);
            }}
          >
            <h2>Open a piece of work.</h2>
            <label className="field">
              Record reference
              <input
                required
                value={ref}
                onChange={(e) => {
                  invalidateRecord();
                  setRef(e.target.value);
                }}
                maxLength={100}
              />
            </label>
            <button className="button primary full" disabled={busy}>
              Open record <Icon name="arrow" size={16} />
            </button>
          </form>
          <div className="order-result">
            <h2>Recent requests</h2>
            {summary.recent.length ? (
              summary.recent.map((r) => (
                <div className="summary-row" key={r.id}>
                  <button
                    className="link-button"
                    style={{
                      textAlign: "left",
                      fontSize: 10,
                      wordBreak: "break-all",
                    }}
                    onClick={() => openRecord(r.id)}
                  >
                    {r.id}
                  </button>
                  <span>
                    {r.kind}
                    <br />
                    {r.status.replaceAll("_", " ")}
                  </span>
                </div>
              ))
            ) : (
              <p>No submitted requests.</p>
            )}
          </div>
        </div>
        <div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {outcome && (
            <p className="form-success" role="status">
              {outcome}
            </p>
          )}
          {receipt && (
            <div className="form-success">
              <h3>Prepared: {receipt.id}</h3>
              <p>
                Save the private receipt before leaving. The access code is only
                shown in the receipt.
              </p>
              <button
                className="button primary"
                style={{ marginTop: 15 }}
                onClick={() => {
                  if (
                    session.current &&
                    active(session.current, context.current) &&
                    receipt
                  )
                    downloadJSON("sonoran-slush-private-receipt.json", receipt);
                }}
              >
                Download receipt <Icon name="download" size={16} />
              </button>
              <button
                className="link-button"
                style={{ display: "block", marginTop: 10 }}
                onClick={() => openRecord(receipt.id)}
              >
                Open this record
              </button>
            </div>
          )}
          {doc && (
            <section className="lookup-card">
              <p className="eyebrow">
                {doc.kind} · Version {doc.version}
              </p>
              <h2 style={{ marginTop: 12 }}>
                {doc.status.replaceAll("_", " ")}
              </h2>
              <p className="small muted" style={{ wordBreak: "break-all" }}>
                {doc.id}
              </p>
              {doc.name && (
                <p>
                  {doc.name} · {doc.email}
                </p>
              )}
              {doc.details && (
                <p style={{ whiteSpace: "pre-wrap" }}>{doc.details}</p>
              )}
              {doc.notes && <p>{doc.notes}</p>}
              {doc.location && (
                <p>
                  {doc.location} · {doc.date}
                </p>
              )}
              {doc.design_type && (
                <p>
                  {doc.design_type}
                  {doc.quantity ? " · " + doc.quantity + " pieces" : ""}
                </p>
              )}
              <RecordedPersonalization key={doc.id} record={doc} />
              <RecordedHistory key={"history-" + doc.id} record={doc} />
              {["retail", "bulk", "event"].includes(doc.kind) && (
                <>
                  <div className="form-divider">
                    <h3>Prepare a reviewed quote.</h3>
                  </div>
                  <label className="field">
                    Final reviewed total (USD)
                    <input
                      inputMode="decimal"
                      disabled={busy}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="field">
                    Quote details, inclusions & applicable terms
                    <textarea
                      rows={5}
                      maxLength={3000}
                      disabled={busy}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </label>
                  <p className="field-help" style={{ marginBottom: 15 }}>
                    The total must include every agreed charge. Confirm
                    materials, quantity, shipping, tax, timing, and terms before
                    offering this version.
                  </p>
                  <button
                    className="button primary full"
                    onClick={offer}
                    disabled={busy}
                  >
                    Offer a new quote version
                  </button>
                  {doc.kind !== "event" && doc.status === "accepted" && (
                    <button
                      className="button outline full"
                      style={{ marginTop: 15 }}
                      disabled={busy}
                      onClick={() =>
                        action("/v1/admin/orders", {
                          quote_id: doc.id,
                          version: doc.version,
                        })
                      }
                    >
                      Prepare order from accepted version
                    </button>
                  )}
                </>
              )}
              {doc.kind === "order" && (
                <>
                  <div className="summary-row">
                    <span>Payment</span>
                    <span>{doc.payment_status}</span>
                  </div>
                  <div className="summary-row">
                    <span>Artwork</span>
                    <span>{doc.proof_status}</span>
                  </div>
                  <div className="form-divider">
                    <h3>Prepare a text proof.</h3>
                  </div>
                  <label className="field">
                    Exact proof text / layout details
                    <textarea
                      rows={5}
                      maxLength={5000}
                      disabled={busy}
                      value={proof}
                      onChange={(e) => setProof(e.target.value)}
                    />
                  </label>
                  <button
                    className="button outline full"
                    disabled={busy || !proof.trim()}
                    onClick={() =>
                      action("/v1/admin/proofs", {
                        order_id: doc.id,
                        proof_text: proof,
                        expected_proof_version: doc.current_proof_version || 0,
                      })
                    }
                  >
                    Prepare next proof version
                  </button>
                  <p className="field-help" style={{ marginTop: 12 }}>
                    A revision invalidates the earlier approval. The customer
                    must review the new version.
                  </p>
                  <div className="form-divider">
                    <h3>Production readiness</h3>
                  </div>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={inventory}
                      onChange={(e) => setInventory(e.target.checked)}
                    />
                    <span>
                      I have verified and reserved the required blanks.
                    </span>
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={capacity}
                      onChange={(e) => setCapacity(e.target.checked)}
                    />
                    <span>
                      I have verified production capacity for this work.
                    </span>
                  </label>
                  <button
                    className="button primary full"
                    disabled={busy || !inventory || !capacity}
                    onClick={() =>
                      action("/v1/admin/orders/" + doc.id + "/release", {
                        version: doc.version,
                        inventory_reserved: inventory,
                        capacity_confirmed: capacity,
                      })
                    }
                  >
                    Release after all prerequisites pass
                  </button>
                  <p className="field-help" style={{ marginTop: 12 }}>
                    Verified payment and approval of the current proof are
                    checked by the service.
                  </p>
                  {doc.status === "in_production" && (
                    <>
                      <div className="form-divider">
                        <h3>Record dispatch.</h3>
                      </div>
                      <label className="field">
                        Carrier / delivery method
                        <input
                          disabled={busy}
                          value={carrier}
                          maxLength={100}
                          onChange={(e) => setCarrier(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Tracking reference
                        <input
                          disabled={busy}
                          value={tracking}
                          maxLength={200}
                          onChange={(e) => setTracking(e.target.value)}
                        />
                      </label>
                      <button
                        className="button outline full"
                        disabled={busy || !carrier.trim() || !tracking.trim()}
                        onClick={() =>
                          action("/v1/admin/orders/" + doc.id + "/ship", {
                            version: doc.version,
                            carrier,
                            tracking,
                          })
                        }
                      >
                        Record shipment
                      </button>
                    </>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
