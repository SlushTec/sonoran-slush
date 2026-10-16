"use client";
import { useState } from "react";
import Link from "next/link";
import { commerce } from "@/lib/client";
import { useStore } from "./Store";
import Icon from "./Icon";
type RecordData = {
  id: string;
  status: string;
  version?: number;
  kind?: string;
  created_at?: string;
  payment_status?: string;
  proof_status?: string;
  total_minor?: number | null;
  currency?: string;
  message?: string;
  proof_text?: string;
  proof_url?: string;
  approved_version?: number | null;
  items?: { product_slug: string; quantity: number }[];
  timeline?: { label: string; at: string }[];
  next_step?: string;
  test_payment_available?: boolean;
  shipment?: { carrier: string; tracking: string };
};
export function Portal({ kind }: { kind: "orders" | "proofs" | "quotes" }) {
  const [id, setID] = useState(""),
    [token, setToken] = useState(""),
    [data, setData] = useState<RecordData | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [change, setChange] = useState(""),
    [action, setAction] = useState("");
  const title =
    kind === "orders"
      ? "Order updates"
      : kind === "proofs"
        ? "Your exact proof"
        : "Your custom request";
  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setData(null);
    setConfirm(false);
    setAction("");
    try {
      setData(
        await commerce<RecordData>(
          "/v1/" + kind + "/" + encodeURIComponent(id.trim()),
          undefined,
          token.trim(),
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not open that record. Check your reference and private access code.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await commerce<{ url: string }>(
        "/v1/checkout/sessions",
        { order_id: data.id, version: data.version },
        token.trim(),
      );
      if (!result.url.startsWith("https://checkout.stripe.com/"))
        throw new Error("The payment address could not be verified.");
      window.location.assign(result.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Payment could not be opened. Your order is kept.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function decide(decision: "approve" | "changes" | "accept") {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      setData(
        await commerce<RecordData>(
          "/v1/" +
            kind +
            "/" +
            encodeURIComponent(data.id) +
            "/" +
            (decision === "changes"
              ? "changes"
              : decision === "accept"
                ? "accept"
                : "approve"),
          { version: data.version, decision, comment: change },
          token.trim(),
        ),
      );
      setConfirm(false);
      setAction(
        decision === "changes"
          ? "Your change request has been recorded."
          : decision === "accept"
            ? "Your acceptance of this quote version has been recorded."
            : "Your approval of this exact proof version has been recorded.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The action could not be confirmed. Reload the current version before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lookup-layout">
      <div>
        <form className="lookup-card" onSubmit={lookup}>
          <h2>{title}</h2>
          <p>
            Use the reference and private access code from your studio receipt.
            An account is not required.
          </p>
          <label className="field">
            {kind === "orders"
              ? "Order"
              : kind === "proofs"
                ? "Proof"
                : "Request"}{" "}
            reference
            <input
              required
              maxLength={100}
              value={id}
              autoComplete="off"
              onChange={(e) => setID(e.target.value)}
              placeholder="Your reference"
            />
          </label>
          <label className="field">
            Private access code
            <input
              type="password"
              required
              maxLength={200}
              value={token}
              autoComplete="off"
              onChange={(e) => setToken(e.target.value)}
              placeholder="From your private receipt"
            />
          </label>
          <button className="button primary full" type="submit" disabled={busy}>
            {busy ? "Opening…" : "Open securely"}
            <Icon name="lock" size={16} />
          </button>
          <p className="field-help" style={{ marginTop: 15 }}>
            Access codes stay in memory for this visit. Keep them private and
            avoid using a shared device.
          </p>
        </form>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {action && (
          <p className="form-success" role="status" style={{ marginTop: 20 }}>
            {action}
          </p>
        )}
        {data && (
          <section className="order-result">
            <p className="eyebrow">{data.id}</p>
            <h2>{data.status.replaceAll("_", " ")}</h2>
            <button
              className="link-button"
              onClick={() => {
                setData(null);
                setID("");
                setToken("");
                setAction("");
                setConfirm(false);
              }}
            >
              Close private record
            </button>
            {data.next_step && <p>{data.next_step}</p>}
            {data.version !== undefined && (
              <span className="proof-version">Version {data.version}</span>
            )}
            {kind === "orders" && (
              <>
                {data.test_payment_available &&
                  data.payment_status === "unpaid" && (
                    <div className="form-notice">
                      <p>
                        A test payment connection is available for this reviewed
                        order. No live payment is enabled.
                      </p>
                      <button
                        className="button primary"
                        onClick={pay}
                        disabled={busy}
                        style={{ marginTop: 12 }}
                      >
                        Open secure test checkout <Icon name="lock" size={16} />
                      </button>
                    </div>
                  )}
                {data.shipment && (
                  <div className="form-notice">
                    <strong>{data.shipment.carrier}</strong>
                    <p>Tracking reference: {data.shipment.tracking}</p>
                  </div>
                )}
                <div className="summary-row">
                  <span>Payment</span>
                  <span>{data.payment_status || "Not provided"}</span>
                </div>
                <div className="summary-row">
                  <span>Proof approval</span>
                  <span>{data.proof_status || "Not provided"}</span>
                </div>
                <ol className="order-timeline">
                  {(data.timeline || []).map((t, i) => (
                    <li className="done" key={i}>
                      <span>
                        <Icon name="check" size={12} />
                      </span>
                      <div>
                        {t.label}
                        <p>{new Date(t.at).toLocaleString()}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {kind === "proofs" && (
              <>
                <div className="proof-content">
                  {data.proof_text ||
                    "The studio has not attached a text layout."}
                </div>
                {data.proof_url?.startsWith("https://") && (
                  <div className="proof-content">
                    <img
                      src={data.proof_url}
                      alt={
                        "Production proof " +
                        data.id +
                        " version " +
                        data.version
                      }
                    />
                  </div>
                )}
                <p>
                  Check every name, date, and placement against this exact
                  version. A later revision requires a new approval.
                </p>
                {data.status !== "approved" && (
                  <>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={confirm}
                        onChange={(e) => setConfirm(e.target.checked)}
                      />
                      <span>
                        I have reviewed version {data.version} and approve this
                        exact proof for production.
                      </span>
                    </label>
                    <button
                      type="button"
                      className="button primary full"
                      disabled={!confirm || busy}
                      onClick={() => decide("approve")}
                    >
                      Approve version {data.version}
                    </button>
                    <label className="field" style={{ marginTop: 25 }}>
                      Need a change?
                      <textarea
                        maxLength={1500}
                        rows={3}
                        value={change}
                        onChange={(e) => setChange(e.target.value)}
                        placeholder="Tell us exactly what to change."
                      />
                    </label>
                    <button
                      className="button outline full"
                      disabled={!change.trim() || busy}
                      onClick={() => decide("changes")}
                    >
                      Request changes
                    </button>
                  </>
                )}
              </>
            )}
            {kind === "quotes" && (
              <>
                {data.total_minor != null ? (
                  <div className="summary-row">
                    <strong>Reviewed total</strong>
                    <span>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: data.currency || "USD",
                      }).format(data.total_minor / 100)}
                    </span>
                  </div>
                ) : (
                  <p>The studio has not priced this request yet.</p>
                )}
                {data.message && <p>{data.message}</p>}
                {data.status === "offered" && data.total_minor != null && (
                  <>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={confirm}
                        onChange={(e) => setConfirm(e.target.checked)}
                      />
                      <span>
                        I accept quote version {data.version} and its displayed
                        details. This records acceptance; payment is a separate
                        step.
                      </span>
                    </label>
                    <button
                      className="button primary full"
                      disabled={!confirm || busy}
                      onClick={() => decide("accept")}
                    >
                      Accept quote version {data.version}
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        )}
      </div>
      <div className="prose">
        <h2>
          {kind === "proofs"
            ? "The little details matter."
            : kind === "orders"
              ? "From your idea to your hands."
              : "A clear next step."}
        </h2>
        {kind === "proofs" ? (
          <>
            <p>
              Approval belongs to a specific proof version. If artwork changes,
              an earlier approval cannot release the revised piece for
              production.
            </p>
            <p>
              Approving a proof does not take a payment. Payment, availability,
              and production readiness are checked separately.
            </p>
          </>
        ) : kind === "orders" ? (
          <>
            <p>
              Your order page shows the progress the studio has actually
              recorded: artwork, proof approval, production, and delivery
              updates.
            </p>
            <p>
              Need to update a detail? Contact the studio before approving a
              proof or making a new request.
            </p>
          </>
        ) : (
          <>
            <p>
              Custom work starts with reviewed details. Your request page shows
              its current status and any versioned quote the studio has
              prepared.
            </p>
            <p>
              An event inquiry does not reserve a date. A quote acceptance is
              separate from payment and booking confirmation.
            </p>
          </>
        )}
        <div className="notice">
          <h2>A private review.</h2>
          <p>
            Live order and proof services need to be connected. This review does
            not contain sample customer orders or invented status updates.
          </p>
        </div>
        <Link href="/help" className="text-link">
          Need help with your reference? <Icon name="arrow" size={17} />
        </Link>
      </div>
    </div>
  );
}
export function Account() {
  const { designs, favorites } = useStore();
  const login = process.env.NEXT_PUBLIC_CUSTOMER_LOGIN_URL;
  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="info-banner">
        <strong>Keep it simple.</strong> You can prepare a gift request, open an
        order, or review a proof without creating an account.
      </div>
      <div className="dashboard-grid" style={{ marginTop: 30 }}>
        {[
          [
            "Saved designs",
            designs.length + " designs kept on this device.",
            "/saved",
            "pencil",
          ],
          [
            "Favorite gifts",
            favorites.length + " gifts that caught your eye.",
            "/saved",
            "heart",
          ],
          [
            "Your orders",
            "Open a private order with your reference and access code.",
            "/orders",
            "bag",
          ],
          [
            "Proof review",
            "Check the exact artwork version before you approve.",
            "/proofs",
            "check",
          ],
          [
            "Custom requests",
            "Open the latest status of a quote or custom inquiry.",
            "/quotes",
            "mail",
          ],
          [
            "Need a hand?",
            "Find artwork guidance, care notes, and a way to ask.",
            "/help",
            "sparkle",
          ],
        ].map(([title, copy, url, icon]) => (
          <article className="dashboard-card" key={title}>
            <Icon
              name={icon}
              style={{ color: "var(--gold)", marginBottom: 18 }}
            />
            <h2>{title}</h2>
            <p>{copy}</p>
            <Link className="text-link" href={url}>
              Open <Icon name="arrow" size={15} />
            </Link>
          </article>
        ))}
      </div>
      <div className="clear-section">
        <div>
          <h2>An account, when you want one.</h2>
          <p>
            Online sign-in will connect saved work and order history across your
            devices.
          </p>
        </div>
        {login?.startsWith("https://") ? (
          <a className="button primary" href={login}>
            Sign in securely <Icon name="arrow" />
          </a>
        ) : (
          <span className="small muted">
            Account sign-in is being connected.
          </span>
        )}
      </div>
    </div>
  );
}
export { default as Admin } from "./StaffWorkspace";
