"use client";
import { useEffect, useRef, useState } from "react";
import { commerce, ServiceError } from "@/lib/client";

const conditions = [
  "available",
  "damaged",
  "sample",
  "in_production",
  "completed",
  "shipped",
] as const;
type Condition = (typeof conditions)[number];
type Unit = "piece" | "millilitre" | "gram" | "millimetre";
type Location = {
  location_id: string;
  condition_units: Record<Condition, number>;
  reserved_units: number;
  free_units: number;
};
type View = {
  lot_id: string;
  component_id: string;
  unit: Unit;
  version: number;
  locations: Location[];
  test_mode: true;
  checkout_authoritative: false;
};
const labels: Record<Condition, string> = {
  available: "Available-condition physical",
  damaged: "Damaged",
  sample: "Sample",
  in_production: "In production",
  completed: "Completed",
  shipped: "Shipped",
};
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function key(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 100 &&
    !/[^A-Za-z0-9_-]/u.test(value)
  );
}
function units(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 1000000
  );
}

export function fixtureAvailability(
  value: unknown,
  requested: string,
): View | null {
  if (
    !object(value) ||
    !key(requested) ||
    value.lot_id !== requested ||
    !key(value.component_id) ||
    value.test_mode !== true ||
    value.checkout_authoritative !== false ||
    typeof value.version !== "number" ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0 ||
    !["piece", "millilitre", "gram", "millimetre"].includes(
      value.unit as string,
    ) ||
    !Array.isArray(value.locations) ||
    value.locations.length > 100
  )
    return null;
  const seen = new Set<string>(),
    locations: Location[] = [];
  for (const location of value.locations) {
    if (
      !object(location) ||
      !key(location.location_id) ||
      seen.has(location.location_id) ||
      !object(location.condition_units)
    )
      return null;
    const source = location.condition_units;
    if (
      Object.keys(source).length !== conditions.length ||
      !conditions.every(
        (condition) =>
          Object.hasOwn(source, condition) && units(source[condition]),
      ) ||
      !units(location.reserved_units) ||
      !units(location.free_units)
    )
      return null;
    if (
      (source.available as number) < location.reserved_units ||
      location.free_units !==
        (source.available as number) - location.reserved_units
    )
      return null;
    const condition_units = Object.fromEntries(
      conditions.map((condition) => [condition, source[condition]]),
    ) as Record<Condition, number>;
    seen.add(location.location_id);
    locations.push({
      location_id: location.location_id,
      condition_units,
      reserved_units: location.reserved_units,
      free_units: location.free_units,
    });
  }
  return {
    lot_id: requested,
    component_id: value.component_id,
    unit: value.unit as Unit,
    version: value.version,
    locations,
    test_mode: true,
    checkout_authoritative: false,
  };
}

function failure(error: unknown) {
  if (error instanceof ServiceError) {
    if (error.status === 401 || error.status === 403)
      return "Staff access could not be verified. Lock the workspace and sign in again.";
    if (error.status === 404)
      return "No registered test lot was found for that reference.";
    if (error.status === 409)
      return "Test availability needs reconciliation. No quantities can be shown safely.";
    if (error.status === 503)
      return "Test inventory is not available in this workspace. Normal work is unchanged.";
  }
  return "Test availability could not be read. Try again; no stock was changed.";
}

export default function FixtureAvailability({ token }: { token: string }) {
  const [reference, setReference] = useState(""),
    [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0),
    inFlight = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    epoch.current++;
    inFlight.current = false;
    setReference("");
    setView(null);
    setError("");
    setBusy(false);
    return () => {
      alive.current = false;
      epoch.current++;
      inFlight.current = false;
    };
  }, [token]);

  function clear(next = "") {
    epoch.current++;
    inFlight.current = false;
    setReference(next);
    setView(null);
    setError("");
    setBusy(false);
  }
  async function read(e: React.FormEvent) {
    e.preventDefault();
    if (!alive.current || inFlight.current) return;
    const requested = reference.trim(),
      request = ++epoch.current;
    setView(null);
    setError("");
    if (!key(requested)) {
      setError(
        "Use a test lot reference with 1–100 letters, numbers, hyphens or underscores.",
      );
      return;
    }
    if (!token) {
      setError(
        "Staff access could not be verified. Lock the workspace and sign in again.",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await commerce<unknown>(
        "/v1/admin/retail-test/component-ledger/lots/" +
          encodeURIComponent(requested) +
          "/availability",
        undefined,
        token,
      );
      if (!alive.current || request !== epoch.current) return;
      const projected = fixtureAvailability(response, requested);
      if (!projected) {
        setError(
          "The test availability response could not be verified. No quantities are shown.",
        );
        return;
      }
      setView(projected);
    } catch (err) {
      if (alive.current && request === epoch.current) setError(failure(err));
    } finally {
      if (alive.current && request === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <section
      className="lookup-card"
      aria-labelledby="fixture-availability-title"
      style={{ marginTop: 35 }}
    >
      <p className="eyebrow">Synthetic component ledger · Read only</p>
      <h2 id="fixture-availability-title">Test inventory availability</h2>
      <p>
        Inspect a registered test lot, not real stock or checkout availability.
        This view cannot reserve stock or approve production.
      </p>
      <form onSubmit={read}>
        <label className="field" htmlFor="fixture-lot-reference">
          Test lot reference
          <input
            id="fixture-lot-reference"
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
            {busy ? "Reading test availability…" : "Read test availability"}
          </button>
          <button type="button" className="link-button" onClick={() => clear()}>
            Clear inventory view
          </button>
        </div>
      </form>
      {busy && (
        <p role="status">Reading the test lot. No stock is being changed.</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {view && (
        <div aria-label="Verified test lot readout">
          <p style={{ overflowWrap: "anywhere" }}>
            Test lot {view.lot_id} · Component {view.component_id} · Unit{" "}
            {view.unit}
          </p>
          <p>
            Observed lot version {view.version}. Read again to check for
            changes.
          </p>
          <p className="field-help">
            Available-condition physical units include held units. Free units
            are available-condition units minus active reservations. Other
            conditions are not free. A read is not permission to reserve.
          </p>
          {view.locations.length === 0 ? (
            <p>
              This registered test lot has no recorded locations or quantities.
            </p>
          ) : (
            view.locations.map((location) => (
              <article className="order-result" key={location.location_id}>
                <h3 style={{ overflowWrap: "anywhere" }}>
                  Location {location.location_id}
                </h3>
                <dl
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: 16,
                  }}
                >
                  {conditions.map((condition) => (
                    <div key={condition}>
                      <dt>{labels[condition]}</dt>
                      <dd>{location.condition_units[condition]}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Reserved (active)</dt>
                    <dd>{location.reserved_units}</dd>
                  </div>
                  <div>
                    <dt>Free (unreserved)</dt>
                    <dd>{location.free_units}</dd>
                  </div>
                </dl>
              </article>
            ))
          )}
          <p className="field-help">
            Fixture-only observation. Inspection, machine eligibility and real
            inventory are not established by this view.
          </p>
        </div>
      )}
    </section>
  );
}
