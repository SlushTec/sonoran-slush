"use client";
import { useState } from "react";
import { commerce, downloadJSON } from "@/lib/client";
import Icon from "./Icon";
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
  date?: string;
  quantity?: number;
  design_type?: string;
  total_minor?: number | null;
  current_proof_version?: number;
  proof_status?: string;
  payment_status?: string;
  items?: { product_slug: string; quantity: number; text: string }[];
};
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
    [receipt, setReceipt] = useState<Receipt | null>(null);
  async function overview() {
    setSummary(await commerce<Summary>("/v1/admin/summary", undefined, token));
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await overview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Staff access could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openRecord(id: string) {
    setBusy(true);
    setError("");
    setReceipt(null);
    try {
      const d = await commerce<Doc>(
        "/v1/admin/records/" + encodeURIComponent(id),
        undefined,
        token,
      );
      setDoc(d);
      setRef(id);
      setPrice(d.total_minor != null ? (d.total_minor / 100).toFixed(2) : "");
      setMessage(d.message || "");
      setInventory(false);
      setCapacity(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The record could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await commerce<Doc | Receipt>(path, body, token);
      if ("access_token" in result) setReceipt(result);
      else setDoc(result);
      await overview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The action could not be confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  function offer() {
    if (!doc) return;
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
                onChange={(e) => setToken(e.target.value)}
                maxLength={500}
              />
            </label>
            <button className="button primary full" disabled={busy}>
              Open workspace <Icon name="lock" size={16} />
            </button>
          </form>
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
        <button
          className="link-button"
          onClick={() => {
            setToken("");
            setSummary(null);
            setDoc(null);
            setReceipt(null);
          }}
        >
          Lock workspace
        </button>
      </div>
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
                onChange={(e) => setRef(e.target.value)}
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
                onClick={() =>
                  downloadJSON("sonoran-slush-private-receipt.json", receipt)
                }
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
              {doc.items?.map((i, index) => (
                <div key={index} className="summary-row">
                  <span>
                    {i.product_slug}
                    <br />
                    {i.text}
                  </span>
                  <span>× {i.quantity}</span>
                </div>
              ))}
              {["retail", "bulk", "event"].includes(doc.kind) && (
                <>
                  <div className="form-divider">
                    <h3>Prepare a reviewed quote.</h3>
                  </div>
                  <label className="field">
                    Final reviewed total (USD)
                    <input
                      inputMode="decimal"
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
                          value={carrier}
                          maxLength={100}
                          onChange={(e) => setCarrier(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Tracking reference
                        <input
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
