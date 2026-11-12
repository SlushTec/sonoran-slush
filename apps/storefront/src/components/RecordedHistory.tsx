"use client";
import { useEffect, useState } from "react";
type Entry = { label: string; at: string };
type History = { kind: "absent" | "recorded"; entries: Entry[] };
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function text(v: unknown, max: number): v is string {
  return (
    typeof v === "string" &&
    v.length <= max * 2 &&
    !/[\uD800-\uDFFF]/u.test(v) &&
    Array.from(v).length >= 1 &&
    Array.from(v).length <= max
  );
}
export function validHistoryTimestamp(v: unknown): v is string {
  if (!text(v, 64)) return false;
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(
      v,
    );
  if (!m) return false;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) return false;
  if (
    m[8] !== "Z" &&
    (Number(m[8].slice(1, 3)) > 23 || Number(m[8].slice(4, 6)) > 59)
  )
    return false;
  return true;
}
export function recordedHistory(record: unknown): History {
  if (!object(record)) throw Error("Recorded history needs reconciliation");
  if (!Object.prototype.hasOwnProperty.call(record, "timeline"))
    return { kind: "absent", entries: [] };
  if (!Array.isArray(record.timeline) || record.timeline.length > 1000)
    throw Error("Recorded history needs reconciliation");
  const entries = record.timeline.map((entry) => {
    if (
      !object(entry) ||
      !text(entry.label, 500) ||
      !validHistoryTimestamp(entry.at)
    )
      throw Error("Recorded history needs reconciliation");
    return { label: entry.label, at: entry.at };
  });
  return { kind: "recorded", entries };
}
function visible(value: string) {
  return value.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, (c) =>
    c === "\n" || c === "\r" || c === "\t"
      ? c
      : "\\u{" + c.codePointAt(0)!.toString(16).toUpperCase() + "}",
  );
}
export default function RecordedHistory({ record }: { record: unknown }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [record]);
  let history: History;
  try {
    history = recordedHistory(record);
  } catch {
    return (
      <section aria-label="Recorded history">
        <h3>Recorded history</h3>
        <p role="alert">
          Recorded history could not be verified within this display's limits.
          Reconcile the record before relying on it. No partial history is
          shown.
        </p>
      </section>
    );
  }
  const pages = Math.ceil(history.entries.length / 25),
    current = Math.min(page, Math.max(0, pages - 1));
  return (
    <section aria-label="Recorded history">
      <div className="form-divider">
        <h3>Recorded history</h3>
      </div>
      <p className="field-help">
        Recorded entries only, in their stored order. This is not a complete
        audit log or proof, payment or production approval. No actor identity is
        inferred.
      </p>
      <p className="field-help">
        Formatting controls are shown as {String.raw`\u{CODE}`}. Stored labels
        and timestamps are unchanged.
      </p>
      {history.kind === "absent" ? (
        <p>
          No history field is recorded for this legacy document. Earlier
          activity may be unavailable.
        </p>
      ) : !history.entries.length ? (
        <p>
          The recorded history is empty. This does not establish that no earlier
          activity occurred.
        </p>
      ) : (
        <>
          <p>
            {history.entries.length} recorded entries. Timestamps retain their
            recorded timezone.
          </p>
          <ol
            start={current * 25 + 1}
            aria-label="Recorded history entries"
            style={{ paddingLeft: 24 }}
          >
            {history.entries
              .slice(current * 25, current * 25 + 25)
              .map((entry, index) => (
                <li
                  key={current * 25 + index}
                  style={{ marginBottom: 16, overflowWrap: "anywhere" }}
                >
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    <bdi>{visible(entry.label)}</bdi>
                  </div>
                  <time dateTime={entry.at}>
                    <bdi>{entry.at}</bdi>
                  </time>
                </li>
              ))}
          </ol>
          <p aria-live="polite">
            History page {current + 1} of {pages}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              className="button outline"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous history page
            </button>
            <button
              className="button outline"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next history page
            </button>
          </div>
        </>
      )}
    </section>
  );
}
