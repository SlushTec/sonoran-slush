"use client";
import { useEffect, useState } from "react";
import { recordedPersonalization } from "./RecordedPersonalization";

export type CustomerInscription = {
  line: number;
  slug: string;
  quantity: number;
  font: string;
  allocation: "unknown" | "identical" | "per_piece";
  set: number | null;
  piece: number | null;
  text: string;
  secondary: string;
};
export type CustomerInscriptionView = {
  availability: "absent" | "empty" | "recorded";
  entries: CustomerInscription[];
};
export function customerInscriptions(record: unknown): CustomerInscriptionView {
  const checked = recordedPersonalization(record);
  // The validator above verifies every source field used here against canonical lines.
  const input = record as { items?: { font?: string; quantity: number }[] };
  const entries: CustomerInscription[] = [
    ...checked.legacy.map((v) => ({
      line: v.line,
      slug: v.slug,
      quantity: v.quantity,
      font: v.font,
      allocation: "unknown" as const,
      set: null,
      piece: null,
      text: v.text,
      secondary: v.secondary,
    })),
    ...checked.rows.map((v) => ({
      line: v.line,
      slug: v.slug,
      quantity: input.items![v.line].quantity,
      font: input.items![v.line].font ?? "",
      allocation: v.mode as "identical" | "per_piece",
      set: v.set,
      piece: v.piece,
      text: v.text,
      secondary: "",
    })),
  ].sort(
    (a, b) =>
      a.line - b.line ||
      (a.set ?? -1) - (b.set ?? -1) ||
      (a.piece ?? -1) - (b.piece ?? -1),
  );
  return {
    availability:
      input.items === undefined
        ? "absent"
        : entries.length
          ? "recorded"
          : "empty",
    entries,
  };
}
export function visibleInscription(value: string) {
  return value.replace(
    /[\p{Cf}\u2028\u2029]/gu,
    (c) => "\\u{" + c.codePointAt(0)!.toString(16).toUpperCase() + "}",
  );
}
export function quotedInscription(value: string) {
  // JSON quotes distinguish actual backslashes from encoded line/control characters.
  return JSON.stringify(value).replace(
    /[\p{Cf}\u2028\u2029]/gu,
    (c) => "\\u{" + c.codePointAt(0)!.toString(16).toUpperCase() + "}",
  );
}
export function inscriptionSummary(view: CustomerInscriptionView): string[] {
  return [
    "Recorded inscriptions only (not a complete manufacturing configuration).",
    "Quoted values escape line breaks, tabs, quotes, backslashes and formatting controls; stored text is unchanged.",
    ...(view.availability === "absent"
      ? ["Inscription information is unavailable; piece allocation is unknown."]
      : view.availability === "empty"
        ? ["No recorded inscription items; piece allocation is unknown."]
        : view.entries.map(
            (v) =>
              "Line " +
              (v.line + 1) +
              " | Product: " +
              quotedInscription(v.slug) +
              " | Quantity: " +
              v.quantity +
              (v.allocation === "unknown"
                ? " | Piece allocation: unknown (legacy)"
                : " | Set: " +
                  (v.set! + 1) +
                  " | Piece: " +
                  (v.piece! + 1) +
                  " | Mode: " +
                  v.allocation) +
              " | Text: " +
              quotedInscription(v.text) +
              " | Secondary text: " +
              quotedInscription(v.secondary) +
              " | Font: " +
              quotedInscription(v.font),
          )),
  ];
}
export default function CustomerInscriptions({
  view,
}: {
  view: CustomerInscriptionView;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [view]);
  const pages = Math.ceil(view.entries.length / 25),
    current = Math.min(page, Math.max(0, pages - 1));
  return (
    <section aria-label="Your recorded inscriptions">
      <h3>Your recorded inscriptions</h3>
      <p>
        Inscription details only, not a complete manufacturing configuration,
        proof approval or permission to manufacture.
      </p>
      <p>
        Formatting controls are shown as {String.raw`\u{CODE}`}. Stored text is
        unchanged; these display codes are not engraving text.
      </p>
      {view.availability === "absent" ? (
        <p>
          Inscription information is unavailable. Piece allocation is unknown.
        </p>
      ) : view.availability === "empty" ? (
        <p>No recorded inscription items. Piece allocation is unknown.</p>
      ) : (
        <>
          <ol
            aria-label="Your inscription assignments"
            style={{ paddingLeft: 24 }}
          >
            {view.entries.slice(current * 25, current * 25 + 25).map((v) => (
              <li
                key={v.line + ":" + v.set + ":" + v.piece}
                style={{ marginBottom: 20, overflowWrap: "anywhere" }}
              >
                <strong>
                  Line {v.line + 1}: <bdi>{visibleInscription(v.slug)}</bdi>
                </strong>
                <p>Quantity: {v.quantity}</p>
                {v.allocation === "unknown" ? (
                  <p>
                    Legacy inscription: no explicit per-piece allocation is
                    recorded.
                  </p>
                ) : (
                  <p>
                    Set {v.set! + 1}, piece {v.piece! + 1}:{" "}
                    {v.allocation === "identical"
                      ? "Identical text"
                      : "Per-piece text"}
                  </p>
                )}
                <p style={{ whiteSpace: "pre-wrap" }}>
                  Text: <bdi>{visibleInscription(v.text)}</bdi>
                </p>
                {v.secondary !== "" && (
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    Secondary text: <bdi>{visibleInscription(v.secondary)}</bdi>
                  </p>
                )}
                <p>Font: {v.font || "Not recorded"}</p>
              </li>
            ))}
          </ol>
          <p aria-live="polite">
            Inscription page {current + 1} of {pages}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              className="button outline"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous inscription page
            </button>
            <button
              type="button"
              className="button outline"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next inscription page
            </button>
          </div>
        </>
      )}
    </section>
  );
}
