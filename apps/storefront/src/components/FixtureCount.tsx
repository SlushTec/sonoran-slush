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
// The response must preserve this API's explicit input order. No partial display.
export function fixtureCounts(
  value: unknown,
  source: Available,
  observed: readonly Observation[],
): View[] | null {
  if (
    !Array.isArray(observed) ||
    observed.length < 1 ||
    observed.length > 100 ||
    !object(value) ||
    !Array.isArray(value.observations) ||
    value.observations.length !== observed.length
  )
    return null;
  const seen = new Set<string>();
  const views: View[] = [];
  for (let i = 0; i < observed.length; i++) {
    const item = observed[i];
    if (
      !Object.hasOwn(observed, i) ||
      !Object.hasOwn(value.observations, i) ||
      !object(item) ||
      typeof item.location_id !== "string" ||
      !key(item.location_id) ||
      typeof item.condition !== "string" ||
      !conditions.includes(item.condition as Condition) ||
      typeof item.observed_units !== "number" ||
      !Number.isInteger(item.observed_units) ||
      item.observed_units < 0 ||
      item.observed_units > 1000000
    )
      return null;
    const bucket = item.location_id + ":" + item.condition;
    if (seen.has(bucket)) return null;
    seen.add(bucket);
    const view = fixtureCount(
      { ...value, observations: [value.observations[i]] },
      source,
      {
        location_id: item.location_id,
        condition: item.condition as Condition,
        observed_units: item.observed_units,
      },
    );
    if (!view) return null;
    views.push(view);
  }
  return views;
}
type DraftRow = {
  id: number;
  location: string;
  condition: Condition;
  count: string;
};
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
  const [lot, setLot] = useState("");
  const nextId = useRef(1);
  const [rows, setRows] = useState<DraftRow[]>([
    { id: 0, location: "", condition: "available", count: "" },
  ]);
  const [view, setView] = useState<View[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0),
    active = useRef(false),
    alive = useRef(true);
  const rowInputs = useRef(new Map<number, HTMLInputElement>());
  const pendingFocus = useRef<number | null>(null);
  useEffect(() => {
    if (pendingFocus.current !== null) {
      rowInputs.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  }, [rows]);
  function invalidate() {
    epoch.current++;
    active.current = false;
    setView(null);
    setError("");
    setBusy(false);
  }
  function clear() {
    invalidate();
    pendingFocus.current = null;
    setLot("");
    setRows([
      { id: nextId.current++, location: "", condition: "available", count: "" },
    ]);
  }
  function edit(id: number, update: Partial<Omit<DraftRow, "id">>) {
    invalidate();
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...update } : row)),
    );
  }
  function add() {
    if (rows.length >= 100) return;
    invalidate();
    const id = nextId.current++;
    pendingFocus.current = id;
    setRows([...rows, { id, location: "", condition: "available", count: "" }]);
  }
  function remove(id: number) {
    if (rows.length <= 1) return;
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return;
    invalidate();
    const remaining = rows.filter((row) => row.id !== id);
    pendingFocus.current = remaining[Math.min(index, remaining.length - 1)].id;
    setRows(remaining);
  }
  useEffect(() => {
    alive.current = true;
    clear();
    return () => {
      alive.current = false;
      epoch.current++;
      active.current = false;
      pendingFocus.current = null;
    };
  }, [token]);
  async function compare(e: React.FormEvent) {
    e.preventDefault();
    if (!alive.current || active.current) return;
    const lotId = lot.trim(),
      request = ++epoch.current;
    setView(null);
    setError("");
    const observations: Observation[] = [];
    const seen = new Set<string>();
    if (!key(lotId) || rows.length < 1 || rows.length > 100) {
      setError(
        "Use a test lot reference and between 1 and 100 explicit count buckets.",
      );
      return;
    }
    for (const row of rows) {
      const locationId = row.location.trim(),
        raw = row.count.trim();
      if (
        !key(locationId) ||
        !conditions.includes(row.condition) ||
        !/^[0-9]{1,7}$/.test(raw) ||
        Number(raw) > 1000000
      ) {
        setError(
          "Use test references with 1-100 letters, numbers, hyphens or underscores, and a whole count from 0 to 1000000.",
        );
        return;
      }
      const bucket = locationId + ":" + row.condition;
      if (seen.has(bucket)) {
        setError(
          "Compare each location and condition only once. No comparison was requested.",
        );
        return;
      }
      seen.add(bucket);
      observations.push({
        location_id: locationId,
        condition: row.condition,
        observed_units: Number(raw),
      });
    }
    if (!token) {
      setError("Staff access could not be verified. Lock and sign in again.");
      return;
    }
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
        { expected_version: source.version, observations },
        token,
      );
      if (!current()) return;
      const projected = fixtureCounts(result, source, observations);
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
        Compare up to 100 explicit location and condition buckets in one
        version-bound read. This does not apply a correction, reserve stock or
        approve production.
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
        {rows.map((row, index) => {
          const suffix = index === 0 ? "" : `-${row.id}`;
          const labelSuffix = index === 0 ? "" : ` ${index + 1}`;
          return (
            <fieldset key={row.id} style={{ minWidth: 0 }}>
              <legend>Count bucket {index + 1}</legend>
              <label className="field" htmlFor={`count-location${suffix}`}>
                {`Count location reference${labelSuffix}`}
                <input
                  id={`count-location${suffix}`}
                  value={row.location}
                  maxLength={100}
                  ref={(element) => {
                    if (element) rowInputs.current.set(row.id, element);
                    else rowInputs.current.delete(row.id);
                  }}
                  onChange={(e) => edit(row.id, { location: e.target.value })}
                />
              </label>
              <label className="field" htmlFor={`count-condition${suffix}`}>
                {`Count condition${labelSuffix}`}
                <select
                  id={`count-condition${suffix}`}
                  value={row.condition}
                  onChange={(e) =>
                    edit(row.id, { condition: e.target.value as Condition })
                  }
                >
                  {conditions.map((v) => (
                    <option key={v} value={v}>
                      {v.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor={`count-observed${suffix}`}>
                {`Observed test units${labelSuffix}`}
                <input
                  id={`count-observed${suffix}`}
                  inputMode="numeric"
                  value={row.count}
                  maxLength={7}
                  onChange={(e) => edit(row.id, { count: e.target.value })}
                />
              </label>
              <button
                className="button secondary"
                type="button"
                disabled={rows.length === 1}
                onClick={() => remove(row.id)}
              >
                Remove count bucket {index + 1}
              </button>
            </fieldset>
          );
        })}
        <p>
          {rows.length} of 100 explicit buckets. This is a request limit, not a
          counting policy.
        </p>
        <button
          className="button secondary"
          type="button"
          disabled={rows.length >= 100}
          onClick={add}
        >
          Add count bucket
        </button>
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
          <h3>Test lot {view[0].lot_id}</h3>
          {view.map((item, index) => (
            <div
              key={item.location_id + ":" + item.condition}
              aria-label={`Compared bucket ${index + 1}`}
            >
              <p>
                Location {item.location_id}; condition{" "}
                {item.condition.replaceAll("_", " ")}. Recorded lot version{" "}
                {item.version}.
              </p>
              <dl>
                <dt>Unit</dt>
                <dd>{item.unit}</dd>
                <dt>Recorded units</dt>
                <dd>{item.recorded_units}</dd>
                <dt>Observed units</dt>
                <dd>{item.observed_units}</dd>
                <dt>Difference (observed minus recorded)</dt>
                <dd>
                  {item.variance_units > 0 ? "+" : ""}
                  {item.variance_units}
                </dd>
                <dt>Protected reserved units</dt>
                <dd>{item.protected_reserved_units}</dd>
              </dl>
              {item.reservation_floor_conflict && (
                <p>
                  The observed count is below protected reservations. Staff
                  reconciliation is required; no correction is authorized.
                </p>
              )}
            </div>
          ))}
          <p>
            No stock was changed. Only these explicit buckets were compared.
            Omitted buckets, quarantined and rejected intake were not counted.
            This is not current checkout availability or permission to change
            stock.
          </p>
        </div>
      )}
    </section>
  );
}
