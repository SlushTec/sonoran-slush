"use client";
import { useEffect, useRef, useState } from "react";
import { commerce, ServiceError } from "@/lib/client";

const defects = [
  "none",
  "chipped",
  "scratched",
  "incorrect_item",
  "other_fixture_defect",
] as const;
type Defect = (typeof defects)[number];
type View = {
  id: string;
  lot_id: string;
  location_id: string;
  quantity: number;
  state: "pending" | "inspected";
  accepted_units: number;
  rejected_units: number;
  defect: Defect;
  received_at: string;
  inspected_at: string | null;
  lot_version: number;
};
const key = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const units = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 1000000;
function timestamp(v: unknown): v is string {
  if (
    typeof v !== "string" ||
    v.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      v,
    )
  )
    return false;
  const [year, month, day, hour, minute, second] = v
    .slice(0, 19)
    .split(/[-T:]/)
    .map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zone = v.endsWith("Z")
    ? null
    : v.slice(-6).slice(1).split(":").map(Number);
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1] &&
    hour < 24 &&
    minute < 60 &&
    second < 60 &&
    (!zone || (zone[0] < 24 && zone[1] < 60)) &&
    Number.isFinite(Date.parse(v))
  );
}
export function fixtureInspection(
  value: unknown,
  requested: string,
): View | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    !key(requested) ||
    v.id !== requested ||
    !key(v.lot_id) ||
    !key(v.location_id) ||
    v.test_mode !== true ||
    v.checkout_authoritative !== false ||
    v.actor !== "synthetic_staff" ||
    v.actor_scope !== "shared staff test credential; not individual identity" ||
    !units(v.quantity) ||
    v.quantity < 1 ||
    !units(v.accepted_units) ||
    !units(v.rejected_units) ||
    typeof v.lot_version !== "number" ||
    !Number.isSafeInteger(v.lot_version) ||
    v.lot_version < 1 ||
    !defects.includes(v.defect as Defect) ||
    !timestamp(v.received_at)
  )
    return null;
  if (v.state === "pending") {
    if (
      v.accepted_units !== 0 ||
      v.rejected_units !== 0 ||
      v.defect !== "none" ||
      v.inspected_at !== null ||
      v.inspection_request_id !== null
    )
      return null;
  } else if (v.state === "inspected") {
    if (
      v.accepted_units + v.rejected_units !== v.quantity ||
      (v.rejected_units === 0) !== (v.defect === "none") ||
      !timestamp(v.inspected_at) ||
      typeof v.inspection_request_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        v.inspection_request_id,
      )
    )
      return null;
  } else return null;
  return {
    id: requested,
    lot_id: v.lot_id,
    location_id: v.location_id,
    quantity: v.quantity,
    state: v.state,
    accepted_units: v.accepted_units,
    rejected_units: v.rejected_units,
    defect: v.defect as Defect,
    received_at: v.received_at,
    inspected_at: v.inspected_at as string | null,
    lot_version: v.lot_version,
  };
}
function failure(e: unknown) {
  if (e instanceof ServiceError) {
    if (e.status === 401 || e.status === 403)
      return "Staff access could not be verified. Lock and sign in again.";
    if (e.status === 404) return "No test intake was found for that reference.";
    if (e.status === 409)
      return "This test intake needs reconciliation. No quantities are shown.";
    if (e.status === 503)
      return "Test intake is unavailable. Normal work is unchanged.";
  }
  return "Test intake could not be read. No stock was changed.";
}
export default function FixtureInspection({ token }: { token: string }) {
  const [reference, setReference] = useState(""),
    [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0),
    active = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    epoch.current++;
    active.current = false;
    setReference("");
    setView(null);
    setError("");
    setBusy(false);
    return () => {
      alive.current = false;
      epoch.current++;
      active.current = false;
    };
  }, [token]);
  function clear(next = "") {
    epoch.current++;
    active.current = false;
    setReference(next);
    setView(null);
    setError("");
    setBusy(false);
  }
  async function read(e: React.FormEvent) {
    e.preventDefault();
    if (!alive.current || active.current) return;
    const requested = reference.trim(),
      request = ++epoch.current;
    setView(null);
    setError("");
    if (!key(requested)) {
      setError(
        "Use a test intake reference with 1–100 letters, numbers, hyphens or underscores.",
      );
      return;
    }
    if (!token) {
      setError("Staff access could not be verified. Lock and sign in again.");
      return;
    }
    active.current = true;
    setBusy(true);
    try {
      const result = await commerce<unknown>(
        "/v1/admin/retail-test/component-ledger/intakes/" +
          encodeURIComponent(requested),
        undefined,
        token,
      );
      if (!alive.current || request !== epoch.current) return;
      const projected = fixtureInspection(result, requested);
      if (projected) setView(projected);
      else
        setError(
          "The test intake response could not be verified. No quantities are shown.",
        );
    } catch (e) {
      if (alive.current && request === epoch.current) setError(failure(e));
    } finally {
      if (alive.current && request === epoch.current) {
        active.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section
      className="lookup-card"
      aria-labelledby="fixture-inspection-title"
      style={{ marginTop: 35 }}
    >
      <p className="eyebrow">Synthetic intake · Read only</p>
      <h2 id="fixture-inspection-title">Test incoming inspection</h2>
      <p>
        Look up a recorded test intake. This view cannot receive, inspect or
        approve stock.
      </p>
      <form onSubmit={read}>
        <label className="field" htmlFor="fixture-intake-reference">
          Test intake reference
          <input
            id="fixture-intake-reference"
            value={reference}
            required
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => clear(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button className="button primary" disabled={busy}>
            {busy ? "Reading test intake…" : "Read test intake"}
          </button>
          <button type="button" className="link-button" onClick={() => clear()}>
            Clear inspection view
          </button>
        </div>
      </form>
      {busy && (
        <p role="status">Reading test intake. No stock is being changed.</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {view && (
        <div
          aria-label="Verified test intake readout"
          style={{ overflowWrap: "anywhere" }}
        >
          <p>
            Test intake {view.id} · Lot {view.lot_id} · Location{" "}
            {view.location_id}
          </p>
          <p>
            {view.state === "pending"
              ? "Pending inspection: all intake units remain quarantined."
              : "Inspection recorded: accepted and rejected units are shown separately."}
          </p>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <dt>Received quantity</dt>
              <dd>{view.quantity}</dd>
            </div>
            <div>
              <dt>Accepted at inspection</dt>
              <dd>{view.accepted_units}</dd>
            </div>
            <div>
              <dt>Rejected at inspection</dt>
              <dd>{view.rejected_units}</dd>
            </div>
            <div>
              <dt>Recorded defect</dt>
              <dd>{view.defect.replaceAll("_", " ")}</dd>
            </div>
          </dl>
          <p>
            Received:{" "}
            <time dateTime={view.received_at}>{view.received_at}</time>
          </p>
          {view.inspected_at && (
            <p>
              Inspected:{" "}
              <time dateTime={view.inspected_at}>{view.inspected_at}</time>
            </p>
          )}
          <p>
            Recorded lot version {view.lot_version}. Shared test staff
            credential, not an individual inspector identity.
          </p>
          <p className="field-help">
            Historical intake quantities are not current free stock. Pending and
            rejected units are excluded from availability. Machine eligibility,
            real inventory and production approval are not established.
          </p>
        </div>
      )}
    </section>
  );
}
