"use client";
import { useEffect, useRef, useState } from "react";
import { commerce, ServiceError } from "@/lib/client";
import { fixtureAvailability } from "./FixtureAvailability";

const conditions = [
  "available",
  "damaged",
  "sample",
  "in_production",
  "completed",
  "shipped",
] as const;
type Condition = (typeof conditions)[number];
type Observation = {
  location_id: string;
  condition: Condition;
  observed_units: number;
};
type Available = NonNullable<ReturnType<typeof fixtureAvailability>>;
type View = Observation & {
  lot_id: string;
  component_id: string;
  unit: string;
  version: number;
  recorded_units: number;
  variance_units: number;
  protected_reserved_units: number;
  reservation_floor_conflict: boolean;
};
const key = (v: string) =>
  v.length > 0 && v.length <= 100 && !/[^A-Za-z0-9_-]/u.test(v);
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

export function fixtureCount(
  value: unknown,
  source: Available,
  observed: Observation,
): View | null {
  if (
    !object(value) ||
    value.lot_id !== source.lot_id ||
    value.component_id !== source.component_id ||
    value.unit !== source.unit ||
    value.version !== source.version ||
    value.test_mode !== true ||
    value.checkout_authoritative !== false ||
    value.applied !== false ||
    value.correction_authorized !== false ||
    value.scope !== "explicit_buckets_only" ||
    !Array.isArray(value.observations) ||
    value.observations.length !== 1
  )
    return null;
  const item = value.observations[0];
  if (
    !object(item) ||
    item.location_id !== observed.location_id ||
    item.condition !== observed.condition ||
    item.observed_units !== observed.observed_units
  )
    return null;
  const location = source.locations.find(
    (v) => v.location_id === observed.location_id,
  );
  const recorded = location?.condition_units[observed.condition] ?? 0;
  const reserved =
    observed.condition === "available" ? (location?.reserved_units ?? 0) : 0;
  const variance = observed.observed_units - recorded,
    conflict = observed.observed_units < reserved;
  if (
    item.recorded_units !== recorded ||
    item.variance_units !== variance ||
    item.protected_reserved_units !== reserved ||
    item.reservation_floor_conflict !== conflict
  )
    return null;
  return {
    ...observed,
    lot_id: source.lot_id,
    component_id: source.component_id,
    unit: source.unit,
    version: source.version,
    recorded_units: recorded,
    variance_units: variance,
    protected_reserved_units: reserved,
    reservation_floor_conflict: conflict,
  };
}
function failure(error: unknown) {
  if (error instanceof ServiceError) {
    if (error.status === 401 || error.status === 403)
      return "Staff access could not be verified. Lock and sign in again.";
    if (error.status === 404) return "No registered test lot was found.";
    if (error.status === 409)
      return "Test stock changed or needs reconciliation. Compare again after reviewing the fixture.";
    if (error.status === 503)
      return "Test count comparison is unavailable. Normal work is unchanged.";
  }
  return "Test count comparison could not be read. No stock was changed.";
}
export default function FixtureCount({ token }: { token: string }) {
  const [lot, setLot] = useState(""),
    [location, setLocation] = useState(""),
    [condition, setCondition] = useState<Condition>("available");
  const [count, setCount] = useState(""),
    [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0),
    active = useRef(false),
    alive = useRef(true);
  function invalidate() {
    epoch.current++;
    active.current = false;
    setView(null);
    setError("");
    setBusy(false);
  }
  function clear() {
    invalidate();
    setLot("");
    setLocation("");
    setCondition("available");
    setCount("");
  }
  useEffect(() => {
    alive.current = true;
    clear();
    return () => {
      alive.current = false;
      epoch.current++;
      active.current = false;
    };
  }, [token]);
  async function compare(e: React.FormEvent) {
    e.preventDefault();
    if (!alive.current || active.current) return;
    const lotId = lot.trim(),
      locationId = location.trim(),
      raw = count.trim(),
      request = ++epoch.current;
    setView(null);
    setError("");
    if (
      !key(lotId) ||
      !key(locationId) ||
      !conditions.includes(condition) ||
      !/^[0-9]{1,7}$/.test(raw) ||
      Number(raw) > 1000000
    ) {
      setError(
        "Use test references with 1-100 letters, numbers, hyphens or underscores, and a whole count from 0 to 1000000.",
      );
      return;
    }
    if (!token) {
      setError("Staff access could not be verified. Lock and sign in again.");
      return;
    }
    const observed: Observation = {
      location_id: locationId,
      condition,
      observed_units: Number(raw),
    };
    active.current = true;
    setBusy(true);
    const current = () => alive.current && request === epoch.current;
    try {
      const prefix =
        "/v1/admin/retail-test/component-ledger/lots/" +
        encodeURIComponent(lotId);
      const rawSource = await commerce<unknown>(
        prefix + "/availability",
        undefined,
        token,
      );
      if (!current()) return;
      const source = fixtureAvailability(rawSource, lotId);
      if (!source) {
        setError(
          "The test availability response could not be verified. No comparison was requested.",
        );
        return;
      }
      const result = await commerce<unknown>(
        prefix + "/count-preview",
        { expected_version: source.version, observations: [observed] },
        token,
      );
      if (!current()) return;
      const projected = fixtureCount(result, source, observed);
      if (!projected) {
        setError(
          "The test count response could not be verified. No quantities are shown.",
        );
        return;
      }
      setView(projected);
    } catch (err) {
      if (current()) setError(failure(err));
    } finally {
      if (current()) {
        active.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section
      className="lookup-card"
      aria-labelledby="fixture-count-title"
      style={{ marginTop: 35 }}
    >
      <p className="eyebrow">Synthetic count comparison · Read only</p>
      <h2 id="fixture-count-title">Compare a test count</h2>
      <p>
        Compare one explicit location and condition. This does not apply a
        correction, reserve stock or approve production.
      </p>
      <form onSubmit={compare}>
        <label className="field" htmlFor="count-lot">
          Count lot reference
          <input
            id="count-lot"
            value={lot}
            maxLength={100}
            onChange={(e) => {
              invalidate();
              setLot(e.target.value);
            }}
          />
        </label>
        <label className="field" htmlFor="count-location">
          Count location reference
          <input
            id="count-location"
            value={location}
            maxLength={100}
            onChange={(e) => {
              invalidate();
              setLocation(e.target.value);
            }}
          />
        </label>
        <label className="field" htmlFor="count-condition">
          Count condition
          <select
            id="count-condition"
            value={condition}
            onChange={(e) => {
              invalidate();
              setCondition(e.target.value as Condition);
            }}
          >
            {conditions.map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="count-observed">
          Observed test units
          <input
            id="count-observed"
            inputMode="numeric"
            value={count}
            maxLength={7}
            onChange={(e) => {
              invalidate();
              setCount(e.target.value);
            }}
          />
        </label>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Comparing test count…" : "Compare test count"}
        </button>
        <button className="button secondary" type="button" onClick={clear}>
          Clear count comparison
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {view && (
        <div aria-label="Verified test count comparison" role="region">
          <h3>Test lot {view.lot_id}</h3>
          <p>
            Location {view.location_id}; condition{" "}
            {view.condition.replaceAll("_", " ")}. Recorded lot version{" "}
            {view.version}.
          </p>
          <dl>
            <dt>Unit</dt>
            <dd>{view.unit}</dd>
            <dt>Recorded units</dt>
            <dd>{view.recorded_units}</dd>
            <dt>Observed units</dt>
            <dd>{view.observed_units}</dd>
            <dt>Difference (observed minus recorded)</dt>
            <dd>
              {view.variance_units > 0 ? "+" : ""}
              {view.variance_units}
            </dd>
            <dt>Protected reserved units</dt>
            <dd>{view.protected_reserved_units}</dd>
          </dl>
          {view.reservation_floor_conflict && (
            <p>
              The observed count is below protected reservations. Staff
              reconciliation is required; no correction is authorized.
            </p>
          )}
          <p>
            No stock was changed. Only this bucket was compared. Omitted
            buckets, quarantined and rejected intake were not counted. This is
            not current checkout availability or permission to change stock.
          </p>
        </div>
      )}
    </section>
  );
}
