"use client";
import { useEffect, useState } from "react";

type Obj = Record<string, unknown>;
type Row = {
  line: number;
  slug: string;
  set: number;
  piece: number;
  text: string;
  mode: string;
};
type Legacy = {
  line: number;
  slug: string;
  quantity: number;
  text: string;
  secondary: string;
  font: string;
  options: [string, string][];
};
type View = { rows: Row[]; legacy: Legacy[] };
const object = (v: unknown): v is Obj =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
function text(v: unknown, max: number, min = 0): v is string {
  if (typeof v !== "string" || v.length > max * 2 || /[\uD800-\uDFFF]/u.test(v))
    return false;
  const size = Array.from(v).length;
  return size >= min && size <= max;
}
const inscription = (v: unknown): v is string =>
  text(v, 120, 1) && !!v.trim() && !/[\p{Cc}\p{Cs}]/u.test(v);
const keys = (v: Obj, names: string[]) =>
  Object.keys(v).sort().join("|") === [...names].sort().join("|");
const owns = (v: Obj, name: string) =>
  Object.prototype.hasOwnProperty.call(v, name);
const fonts = ["Classic serif", "Modern sans", "Handwritten"];
const crystalKeys = ["Crystal shape", "Size", "Orientation"];
function fail(): never {
  throw Error("Recorded personalization needs reconciliation");
}
function options(v: unknown): [string, string][] {
  if (v === undefined) return [];
  if (!object(v) || Object.keys(v).length > 16) fail();
  const entries = Object.entries(v);
  if (!entries.every(([k, value]) => text(k, 60) && text(value, 200))) fail();
  return entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) as [
    string,
    string,
  ][];
}
function visible(value: string) {
  return value.replace(
    /[\p{Cf}\u2028\u2029]/gu,
    (c) => "\\u{" + c.codePointAt(0)!.toString(16).toUpperCase() + "}",
  );
}
function rawPieces(
  v: unknown,
): { set_index: number; piece_index: number; text: string }[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 500) fail();
  const result = v.map((p) => {
    if (
      !object(p) ||
      !keys(p, ["set_index", "piece_index", "text"]) ||
      !integer(p.set_index, 0, 499) ||
      !integer(p.piece_index, 0, 99) ||
      !inscription(p.text)
    )
      fail();
    return { set_index: p.set_index, piece_index: p.piece_index, text: p.text };
  });
  if (
    new Set(result.map((p) => p.set_index + ":" + p.piece_index)).size !==
    result.length
  )
    fail();
  return result;
}
function assignment(value: unknown) {
  if (!object(value)) fail();
  if (
    value.mode === "identical" &&
    keys(value, ["mode", "text"]) &&
    inscription(value.text)
  )
    return { mode: "identical" as const, text: value.text, pieces: [] };
  if (value.mode === "per_piece" && keys(value, ["mode", "pieces"]))
    return {
      mode: "per_piece" as const,
      text: "",
      pieces: rawPieces(value.pieces).sort(
        (a, b) => a.set_index - b.set_index || a.piece_index - b.piece_index,
      ),
    };
  fail();
}
export function recordedPersonalization(record: unknown): View {
  if (!object(record)) fail();
  if (
    record.lines !== undefined &&
    (!Array.isArray(record.lines) || record.lines.length > 100)
  )
    fail();
  if (record.items === undefined) {
    if (
      Array.isArray(record.lines) &&
      record.lines.some((l) => object(l) && owns(l, "personalization_snapshot"))
    )
      fail();
    return { rows: [], legacy: [] };
  }
  if (!Array.isArray(record.items) || record.items.length > 100) fail();
  const rows: Row[] = [],
    legacy: Legacy[] = [];
  const lines = record.lines;
  const hasStructured = record.items.some(
    (i) => object(i) && owns(i, "personalization"),
  );
  if (
    hasStructured &&
    (!Array.isArray(lines) || lines.length !== record.items.length)
  )
    fail();
  if (Array.isArray(lines) && lines.length > 100) fail();
  record.items.forEach((item, index) => {
    if (
      !object(item) ||
      !text(item.product_slug, 100, 1) ||
      !integer(item.quantity, 1, 500)
    )
      fail();
    const primary = item.text === undefined ? "" : item.text;
    const secondary = item.secondary === undefined ? "" : item.secondary;
    const font = item.font === undefined ? "" : item.font;
    if (
      !text(primary, 120) ||
      !text(secondary, 120) ||
      (font !== "" && !fonts.includes(font as string))
    )
      fail();
    const opts = options(item.options);
    const line = Array.isArray(lines) ? lines[index] : undefined;
    if (!owns(item, "personalization")) {
      if (object(line) && owns(line, "personalization_snapshot")) fail();
      legacy.push({
        line: index,
        slug: item.product_slug,
        quantity: item.quantity,
        text: primary,
        secondary,
        font: font as string,
        options: opts,
      });
      return;
    }
    if (
      primary !== "" ||
      secondary !== "" ||
      opts.some(([k]) => !crystalKeys.includes(k))
    )
      fail();
    const input = assignment(item.personalization);
    if (
      !object(line) ||
      !object(line.item) ||
      line.item.product_slug !== item.product_slug ||
      line.item.quantity !== item.quantity
    )
      fail();
    const lineInput = assignment(line.item.personalization);
    if (
      JSON.stringify(input) !== JSON.stringify(lineInput) ||
      (line.item.text === undefined ? "" : line.item.text) !== primary ||
      (line.item.secondary === undefined ? "" : line.item.secondary) !==
        secondary ||
      (line.item.font === undefined ? "" : line.item.font) !== font ||
      JSON.stringify(options(line.item.options)) !== JSON.stringify(opts)
    )
      fail();
    const snapshot = line.personalization_snapshot;
    if (
      !object(snapshot) ||
      !keys(snapshot, [
        "schema_version",
        "mode",
        "line_index",
        "quantity",
        "pieces_per_item",
        "pieces",
      ]) ||
      snapshot.schema_version !== 1 ||
      snapshot.mode !== input.mode ||
      snapshot.line_index !== index ||
      snapshot.quantity !== item.quantity ||
      !integer(snapshot.pieces_per_item, 1, 100)
    )
      fail();
    const count = snapshot.pieces_per_item,
      total = item.quantity * count;
    if (total > 500 || rows.length + total > 2000) fail();
    const pieces = rawPieces(snapshot.pieces);
    if (
      pieces.length !== total ||
      (input.mode === "per_piece" && input.pieces.length !== total)
    )
      fail();
    pieces.forEach((piece, position) => {
      const set = Math.floor(position / count),
        within = position % count;
      if (piece.set_index !== set || piece.piece_index !== within) fail();
      if (input.mode === "identical") {
        if (piece.text !== input.text) fail();
      } else {
        const expected = input.pieces[position];
        if (
          expected.set_index !== set ||
          expected.piece_index !== within ||
          expected.text !== piece.text
        )
          fail();
      }
      rows.push({
        line: index,
        slug: item.product_slug as string,
        set,
        piece: within,
        text: piece.text,
        mode: input.mode,
      });
    });
  });
  if (
    Array.isArray(lines) &&
    lines
      .slice(record.items.length)
      .some((l) => object(l) && owns(l, "personalization_snapshot"))
  )
    fail();
  return { rows, legacy };
}
export default function RecordedPersonalization({
  record,
}: {
  record: unknown;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [record]);
  let view: View;
  try {
    view = recordedPersonalization(record);
  } catch {
    return (
      <section aria-label="Recorded personalization">
        <h3>Recorded personalization</h3>
        <p role="alert">
          Recorded personalization could not be verified. Reconcile the record
          before relying on this display. No piece assignments are inferred.
        </p>
      </section>
    );
  }
  if (!view.rows.length && !view.legacy.length) return null;
  const pages = Math.ceil(view.rows.length / 25),
    current = Math.min(page, Math.max(0, pages - 1));
  return (
    <section aria-label="Recorded personalization">
      <div className="form-divider">
        <h3>Recorded personalization</h3>
      </div>
      <p className="field-help">
        Recorded configuration only. This is not proof approval or permission to
        manufacture.
      </p>
      {view.legacy.map((item) => (
        <div
          key={item.line}
          className="summary-row"
          style={{ display: "block", overflowWrap: "anywhere" }}
        >
          <strong>
            Line {item.line + 1}: {visible(item.slug)} · quantity{" "}
            {item.quantity}
          </strong>
          <p className="field-help">
            Legacy configuration: no explicit per-piece allocation is recorded.
          </p>
          {item.text && (
            <p style={{ whiteSpace: "pre-wrap" }}>
              Text: <bdi>{visible(item.text)}</bdi>
            </p>
          )}
          {item.secondary && (
            <p style={{ whiteSpace: "pre-wrap" }}>
              Secondary text: <bdi>{visible(item.secondary)}</bdi>
            </p>
          )}
          {item.font && <p>Font: {item.font}</p>}
          {item.options.map(([key, value]) => (
            <p key={key} style={{ whiteSpace: "pre-wrap" }}>
              <bdi>{visible(key)}</bdi>: <bdi>{visible(value)}</bdi>
            </p>
          ))}
        </div>
      ))}
      {view.rows.length > 0 && (
        <>
          <p>
            {view.rows.length} recorded pieces. Set and piece numbers below
            start at 1.
          </p>
          <ol
            aria-label="Recorded piece assignments"
            style={{ paddingLeft: 24 }}
          >
            {view.rows.slice(current * 25, current * 25 + 25).map((row) => (
              <li
                key={row.line + ":" + row.set + ":" + row.piece}
                style={{ marginBottom: 16, overflowWrap: "anywhere" }}
              >
                <strong>
                  Line {row.line + 1}: {visible(row.slug)}
                </strong>
                <div>
                  Set {row.set + 1} · Piece {row.piece + 1} ·{" "}
                  {row.mode === "identical"
                    ? "Identical text"
                    : "Per-piece text"}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  <bdi>{visible(row.text)}</bdi>
                </div>
              </li>
            ))}
          </ol>
          <p aria-live="polite">
            Piece page {current + 1} of {pages}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              className="button outline"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous piece page
            </button>
            <button
              className="button outline"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next piece page
            </button>
          </div>
        </>
      )}
    </section>
  );
}
