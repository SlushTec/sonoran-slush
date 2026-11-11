"use client";
import { useEffect, useRef, useState } from "react";
import { commerce } from "@/lib/client";

type Proof = {
  id: string;
  kind: "proof";
  order_id: string;
  version: number;
  status: string;
  proof_text: string;
  approved_version?: number | null;
  binding_schema?: number;
  context_hash?: string;
};
type Piece = { set_index: number; piece_index: number; text: string };
type Item = {
  product_slug: string;
  quantity: number;
  text?: string;
  secondary?: string;
  font?: string;
  options?: Record<string, string>;
};
type Detail = {
  revision: {
    schema_version: number;
    proof_id: string;
    order_id: string;
    version: number;
    proof_text: string;
    context_hash: string;
    prepared_at: string;
    limitations: string;
  };
  material_context: {
    order_id: string;
    items: Item[];
    lines: null | { personalization_snapshot?: { pieces: Piece[] } }[];
    total_minor: number;
    currency: string;
  };
  decisions: {
    schema_version: number;
    proof_id: string;
    order_id: string;
    version: number;
    context_hash: string;
    sequence: number;
    action: string;
    comment: string;
    recorded_at: string;
    actor_scope: string;
  }[];
};
type History = {
  proof_id: string;
  items: { version: number; context_hash: string; prepared_at: string }[];
  next_cursor: number | null;
  legacy_history_unknown: boolean;
};
type Session = { id: string; token: string; generation: number };
const digest = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const integer = (v: unknown, min = 1, max = 1000): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const date = (v: unknown) =>
  boundedText(v, 64, 20) &&
  /^\d{4}-\d\d-\d\dT/.test(v) &&
  Number.isFinite(Date.parse(v));
function boundedText(v: unknown, max: number, min = 0): v is string {
  if (typeof v !== "string" || v.length > max * 2) return false;
  let count = 0;
  for (const char of v) {
    const point = char.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) return false;
    if (++count > max) return false;
  }
  return count >= min;
}
function invalid(): never {
  throw new Error(
    "The proof evidence needs reconciliation. Refresh the current proof or contact the studio.",
  );
}
function proofRecord(v: Proof, id: string) {
  if (
    !v ||
    v.id !== id ||
    v.kind !== "proof" ||
    !boundedText(v.order_id, 100, 1) ||
    !integer(v.version) ||
    !boundedText(v.proof_text, 5000, 1) ||
    !["awaiting_approval", "approved", "changes_requested"].includes(v.status)
  )
    invalid();
  if (
    "binding_schema" in v &&
    (v.binding_schema !== 1 || !digest(v.context_hash))
  )
    invalid();
  return v;
}
function evidence(v: Detail, p: Proof, version: number, current: boolean) {
  const r = v?.revision,
    m = v?.material_context;
  if (
    !r ||
    r.schema_version !== 1 ||
    r.proof_id !== p.id ||
    r.order_id !== p.order_id ||
    r.version !== version ||
    !integer(r.version) ||
    !boundedText(r.proof_text, 5000, 1) ||
    !digest(r.context_hash) ||
    !date(r.prepared_at) ||
    !boundedText(r.limitations, 500, 1)
  )
    invalid();
  if (
    current &&
    (p.binding_schema !== 1 ||
      r.context_hash !== p.context_hash ||
      r.proof_text !== p.proof_text)
  )
    invalid();
  if (
    !m ||
    m.order_id !== p.order_id ||
    !Array.isArray(m.items) ||
    m.items.length < 1 ||
    m.items.length > 100 ||
    !integer(m.total_minor, 1, 99999999) ||
    m.currency !== "USD" ||
    !(
      m.lines === null ||
      (Array.isArray(m.lines) && m.lines.length === m.items.length)
    )
  )
    invalid();
  let pieces = 0;
  for (const item of m.items) {
    if (
      !item ||
      !boundedText(item.product_slug, 100, 1) ||
      !integer(item.quantity, 1, 500) ||
      (item.text !== undefined && !boundedText(item.text, 120)) ||
      (item.secondary !== undefined && !boundedText(item.secondary, 120)) ||
      (item.font !== undefined &&
        !["Classic serif", "Modern sans", "Handwritten"].includes(item.font))
    )
      invalid();
    if (
      item.options !== undefined &&
      (!item.options ||
        typeof item.options !== "object" ||
        Array.isArray(item.options) ||
        Object.entries(item.options).length > 16 ||
        Object.entries(item.options).some(
          ([k, v]) => !boundedText(k, 60) || !boundedText(v, 200),
        ))
    )
      invalid();
  }
  for (const line of m.lines || []) {
    if (!line || typeof line !== "object") invalid();
    if (line.personalization_snapshot) {
      const ps = line.personalization_snapshot.pieces;
      if (!Array.isArray(ps) || ps.length > 500) invalid();
      pieces += ps.length;
      for (const x of ps)
        if (
          !x ||
          !integer(x.set_index, 0, 499) ||
          !integer(x.piece_index, 0, 99) ||
          !boundedText(x.text, 120, 1)
        )
          invalid();
    }
  }
  if (pieces > 2000 || !Array.isArray(v.decisions) || v.decisions.length > 1000)
    invalid();
  v.decisions.forEach((d, i) => {
    if (
      !d ||
      d.schema_version !== 1 ||
      d.proof_id !== r.proof_id ||
      d.order_id !== r.order_id ||
      d.version !== r.version ||
      d.context_hash !== r.context_hash ||
      d.sequence !== i + 1 ||
      !["approve", "changes"].includes(d.action) ||
      !boundedText(d.comment, 1500) ||
      !date(d.recorded_at) ||
      d.actor_scope !== "holder of this private proof capability"
    )
      invalid();
  });
  if (current) {
    const last = v.decisions.at(-1);
    if (
      (p.status === "approved" &&
        (p.approved_version !== p.version || last?.action !== "approve")) ||
      (p.status === "changes_requested" &&
        (p.approved_version !== null || last?.action !== "changes")) ||
      (p.status === "awaiting_approval" &&
        (p.approved_version !== null || v.decisions.length !== 0))
    )
      invalid();
  }
  return v;
}
function historyRecord(v: History, p: Proof, cursor: number) {
  if (
    !v ||
    v.proof_id !== p.id ||
    !Array.isArray(v.items) ||
    v.items.length > 25 ||
    typeof v.legacy_history_unknown !== "boolean"
  )
    invalid();
  let last = cursor;
  for (const row of v.items) {
    if (
      !row ||
      !integer(row.version) ||
      row.version <= last ||
      !digest(row.context_hash) ||
      !date(row.prepared_at)
    )
      invalid();
    last = row.version;
  }
  if (
    v.next_cursor !== null &&
    (!v.items.length || v.next_cursor !== last || !integer(v.next_cursor))
  )
    invalid();
  return v;
}
export default function ProofReviewPortal() {
  const [id, setID] = useState(""),
    [token, setToken] = useState(""),
    [proof, setProof] = useState<Proof | null>(null),
    [detail, setDetail] = useState<Detail | null>(null);
  const [history, setHistory] = useState<History | null>(null),
    [cursors, setCursors] = useState<number[]>([0]),
    [historical, setHistorical] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState(false),
    [comment, setComment] = useState("");
  const [piecePage, setPiecePage] = useState(0),
    [itemPage, setItemPage] = useState(0),
    [decisionPage, setDecisionPage] = useState(0);
  const generation = useRef(0),
    sequence = useRef(0),
    locked = useRef(false),
    session = useRef<Session | null>(null),
    mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null),
    result = useRef<HTMLHeadingElement>(null);
  function clear(credentials = true) {
    generation.current++;
    sequence.current++;
    locked.current = false;
    session.current = null;
    setProof(null);
    setDetail(null);
    setHistory(null);
    setCursors([0]);
    setHistorical(false);
    setBusy(false);
    setError("");
    setNotice("");
    setConfirm(false);
    setComment("");
    setPiecePage(0);
    setItemPage(0);
    setDecisionPage(0);
    if (credentials) {
      setID("");
      setToken("");
    }
  }
  useEffect(() => {
    mounted.current = true;
    const reset = () => clear();
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) clear();
    };
    window.addEventListener("popstate", reset);
    window.addEventListener("pagehide", reset);
    window.addEventListener("pageshow", restored);
    return () => {
      mounted.current = false;
      generation.current++;
      sequence.current++;
      locked.current = false;
      session.current = null;
      window.removeEventListener("popstate", reset);
      window.removeEventListener("pagehide", reset);
      window.removeEventListener("pageshow", restored);
    };
  }, []);
  const active = (s: Session, n: number) =>
    mounted.current &&
    session.current === s &&
    generation.current === s.generation &&
    sequence.current === n;
  async function run(s: Session, work: (n: number) => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    const n = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      await work(n);
    } catch (e) {
      if (active(s, n)) {
        setError(
          e instanceof Error
            ? e.message
            : "The request could not be confirmed.",
        );
        setConfirm(false);
      }
    } finally {
      if (active(s, n)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  const path = (s: Session) => "/v1/proofs/" + encodeURIComponent(s.id);
  function show(d: Detail | null) {
    setDetail(d);
    setPiecePage(0);
    setItemPage(0);
    setDecisionPage(0);
  }
  async function loadCurrent(s: Session, n: number) {
    const p = proofRecord(
      await commerce<Proof>(path(s), undefined, s.token),
      s.id,
    );
    if (!active(s, n)) return;
    setProof(p);
    show(null);
    setHistorical(false);
    setConfirm(false);
    setComment("");
    setNotice("");
    if (p.binding_schema === 1) {
      const d = evidence(
        await commerce<Detail>(
          path(s) + "/history/" + p.version,
          undefined,
          s.token,
        ),
        p,
        p.version,
        true,
      );
      if (!active(s, n)) return;
      show(d);
    }
    result.current?.focus();
  }
  function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (locked.current) return;
    const enteredID = id.trim(),
      enteredToken = token.trim();
    if (!enteredID || !enteredToken) return;
    clear(false);
    const s = {
      id: enteredID,
      token: enteredToken,
      generation: generation.current,
    };
    session.current = s;
    void run(s, (n) => loadCurrent(s, n));
  }
  function refresh() {
    const s = session.current;
    if (!s) return;
    setHistory(null);
    setCursors([0]);
    show(null);
    setConfirm(false);
    void run(s, (n) => loadCurrent(s, n));
  }
  function loadHistory(cursor = 0, previous?: number[]) {
    const s = session.current,
      p = proof;
    if (!s || !p || locked.current) return;
    setConfirm(false);
    setComment("");
    void run(s, async (n) => {
      const h = historyRecord(
        await commerce<History>(
          path(s) + "/history?after=" + cursor + "&limit=25",
          undefined,
          s.token,
        ),
        p,
        cursor,
      );
      if (active(s, n)) {
        setHistory(h);
        setCursors(previous || (cursor === 0 ? [0] : [...cursors, cursor]));
      }
    });
  }
  function view(version: number) {
    const s = session.current,
      p = proof;
    if (!s || !p || locked.current) return;
    const selected = history?.items.find((row) => row.version === version);
    if (!selected) return;
    setHistorical(true);
    setConfirm(false);
    setComment("");
    show(null);
    void run(s, async (n) => {
      const d = evidence(
        await commerce<Detail>(
          path(s) + "/history/" + version,
          undefined,
          s.token,
        ),
        p,
        version,
        false,
      );
      if (d.revision.context_hash !== selected.context_hash) invalid();
      if (active(s, n)) {
        show(d);
        result.current?.focus();
      }
    });
  }
  async function decide(action: "approve" | "changes") {
    const s = session.current,
      p = proof,
      d = detail;
    if (
      !s ||
      !p ||
      !d ||
      historical ||
      locked.current ||
      p.binding_schema !== 1 ||
      p.status === "changes_requested" ||
      (action === "approve" && !confirm) ||
      (action === "changes" && !comment.trim())
    )
      return;
    const version = p.version;
    setConfirm(false);
    show(null);
    await run(s, async (n) => {
      const updated = proofRecord(
        await commerce<Proof>(
          path(s) + "/" + (action === "approve" ? "approve" : "changes"),
          { version, decision: action, comment },
          s.token,
        ),
        s.id,
      );
      if (
        updated.version !== version ||
        updated.context_hash !== p.context_hash ||
        updated.proof_text !== p.proof_text ||
        updated.order_id !== p.order_id ||
        updated.status !==
          (action === "approve" ? "approved" : "changes_requested")
      )
        invalid();
      if (!active(s, n)) return;
      setProof(updated);
      show(null);
      setHistory(null);
      setCursors([0]);
      setComment("");
      const next = evidence(
        await commerce<Detail>(
          path(s) + "/history/" + version,
          undefined,
          s.token,
        ),
        updated,
        version,
        true,
      );
      if (active(s, n)) {
        show(next);
        setNotice(
          action === "approve"
            ? "Your approval of this exact proof version has been recorded."
            : "Your change request has been recorded.",
        );
      }
    });
  }
  const pieces =
    detail?.material_context.lines?.flatMap((l, line_index) =>
      (l.personalization_snapshot?.pieces || []).map((p) => ({
        ...p,
        line_index,
      })),
    ) || [];
  const bound =
    !!proof &&
    !!detail &&
    !historical &&
    proof.binding_schema === 1 &&
    detail.revision.version === proof.version &&
    proof.status !== "changes_requested";
  return (
    <div className="lookup-layout">
      <div>
        <form className="lookup-card" onSubmit={lookup}>
          <h2>Your exact proof</h2>
          <p>
            Use the reference and private access code from your studio receipt.
          </p>
          <label className="field">
            Proof reference
            <input
              ref={input}
              required
              maxLength={100}
              value={id}
              autoComplete="off"
              onChange={(e) => {
                clear(false);
                setID(e.target.value);
              }}
            />
          </label>
          <label className="field">
            Private access code
            <input
              required
              type="password"
              maxLength={200}
              value={token}
              autoComplete="off"
              onChange={(e) => {
                clear(false);
                setToken(e.target.value);
              }}
            />
          </label>
          <button className="button primary full" disabled={busy} type="submit">
            {busy ? "Working…" : "Open securely"}
          </button>
          <p className="field-help">
            Access codes stay in memory for this visit. Closing the record or
            leaving clears this private session.
          </p>
        </form>
        {(proof || busy) && (
          <button
            className="link-button"
            onClick={() => {
              clear();
              input.current?.focus();
            }}
          >
            Close private record
          </button>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="form-success">
            {notice}
          </p>
        )}
        {proof && (
          <section className="order-result" aria-busy={busy}>
            <h2 ref={result} tabIndex={-1} style={{ scrollMarginTop: 140 }}>
              {historical ? "Historical proof (read only)" : "Current proof"}
            </h2>
            <p className="eyebrow">{proof.id}</p>
            <p>
              Version {detail?.revision.version ?? proof.version} ·{" "}
              {historical
                ? "Historical record"
                : detail
                  ? proof.status.replaceAll("_", " ")
                  : "Evidence not verified"}
            </p>
            <div
              className="proof-content"
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {detail?.revision.proof_text ??
                (!historical
                  ? proof.proof_text
                  : "Loading historical evidence…")}
            </div>
            <button
              className="button outline"
              disabled={busy}
              onClick={refresh}
            >
              {historical ? "Return to current proof" : "Refresh current proof"}
            </button>{" "}
            <button
              className="button outline"
              disabled={busy}
              onClick={() => loadHistory()}
            >
              Past versions
            </button>
            {proof.binding_schema !== 1 && !historical && (
              <p className="form-notice">
                This retained legacy proof is not bound to a verified
                configuration. Ask the studio to prepare a fresh revision before
                approval. Earlier history may be unavailable.
              </p>
            )}
            {proof.binding_schema === 1 && !detail && !historical && (
              <p>
                Approval is unavailable until current bound evidence has loaded
                successfully. Refresh to retry.
              </p>
            )}
            {historical && (
              <p className="form-notice">
                Read only. Return to the current proof to review any available
                actions. Historical image files are not verified by this
                text/configuration history.
              </p>
            )}
            {proof.status === "changes_requested" && !historical && (
              <p>
                The studio needs to prepare a new revision before another
                approval.
              </p>
            )}
            {history && (
              <section aria-label="Proof version history">
                <h3>Version history</h3>
                {history.legacy_history_unknown && (
                  <p>
                    Some earlier history is unknown. No missing versions or
                    decisions have been invented.
                  </p>
                )}
                {!history.items.length && (
                  <p>No bound revisions on this page.</p>
                )}
                <ul>
                  {history.items.map((r) => (
                    <li key={r.version}>
                      <button
                        className="link-button"
                        disabled={busy}
                        onClick={() => view(r.version)}
                      >
                        View version {r.version}
                      </button>{" "}
                      · {new Date(r.prepared_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
                <button
                  className="button outline"
                  disabled={busy || cursors.length < 2}
                  onClick={() =>
                    loadHistory(
                      cursors[cursors.length - 2],
                      cursors.slice(0, -1),
                    )
                  }
                >
                  Previous history page
                </button>{" "}
                <button
                  className="button outline"
                  disabled={busy || history.next_cursor === null}
                  onClick={() => loadHistory(history.next_cursor!)}
                >
                  Next history page
                </button>
              </section>
            )}
            {detail && (
              <section aria-label="Bound configuration">
                <h3>Configuration recorded with this version</h3>
                <p>{detail.revision.limitations}</p>
                <p>
                  Order {detail.material_context.order_id} ·{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(detail.material_context.total_minor / 100)}
                </p>
                <ul>
                  {detail.material_context.items
                    .slice(itemPage * 10, itemPage * 10 + 10)
                    .map((item, i) => (
                      <li
                        key={itemPage * 10 + i}
                        style={{ overflowWrap: "anywhere" }}
                      >
                        <strong>{item.product_slug}</strong> · quantity{" "}
                        {item.quantity}
                        {item.text && (
                          <p style={{ whiteSpace: "pre-wrap" }}>{item.text}</p>
                        )}
                        {item.secondary && (
                          <p style={{ whiteSpace: "pre-wrap" }}>
                            {item.secondary}
                          </p>
                        )}
                        {item.font && <p>Font: {item.font}</p>}
                        {item.options && (
                          <dl>
                            {Object.entries(item.options).map(([k, v]) => (
                              <div key={k}>
                                <dt>{k}</dt>
                                <dd>{v}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </li>
                    ))}
                </ul>
                {detail.material_context.items.length > 10 && (
                  <div>
                    <button
                      disabled={!itemPage}
                      onClick={() => setItemPage(itemPage - 1)}
                    >
                      Previous items
                    </button>
                    <button
                      disabled={
                        (itemPage + 1) * 10 >=
                        detail.material_context.items.length
                      }
                      onClick={() => setItemPage(itemPage + 1)}
                    >
                      Next items
                    </button>
                  </div>
                )}
                {!!pieces.length && (
                  <>
                    <h4>Exact piece inscriptions ({pieces.length})</h4>
                    <ol start={piecePage * 25 + 1}>
                      {pieces
                        .slice(piecePage * 25, piecePage * 25 + 25)
                        .map((p) => (
                          <li
                            key={
                              p.line_index +
                              "-" +
                              p.set_index +
                              "-" +
                              p.piece_index
                            }
                            style={{
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            Item {p.line_index + 1}, set {p.set_index + 1},
                            piece {p.piece_index + 1}: {p.text}
                          </li>
                        ))}
                    </ol>
                    <button
                      disabled={!piecePage}
                      onClick={() => setPiecePage(piecePage - 1)}
                    >
                      Previous inscriptions
                    </button>{" "}
                    <button
                      disabled={(piecePage + 1) * 25 >= pieces.length}
                      onClick={() => setPiecePage(piecePage + 1)}
                    >
                      Next inscriptions
                    </button>
                  </>
                )}
                <h3>Recorded decisions</h3>
                {!detail.decisions.length && (
                  <p>No decision recorded for this version.</p>
                )}
                <ol start={decisionPage * 25 + 1}>
                  {detail.decisions
                    .slice(decisionPage * 25, decisionPage * 25 + 25)
                    .map((d) => (
                      <li key={d.sequence} style={{ overflowWrap: "anywhere" }}>
                        {d.action === "approve"
                          ? "Approval"
                          : "Changes requested"}{" "}
                        · {new Date(d.recorded_at).toLocaleString()} · Holder of
                        this private proof capability
                        {d.comment && <p>{d.comment}</p>}
                      </li>
                    ))}
                </ol>
                {detail.decisions.length > 25 && (
                  <>
                    <button
                      disabled={!decisionPage}
                      onClick={() => setDecisionPage(decisionPage - 1)}
                    >
                      Previous decisions
                    </button>
                    <button
                      disabled={
                        (decisionPage + 1) * 25 >= detail.decisions.length
                      }
                      onClick={() => setDecisionPage(decisionPage + 1)}
                    >
                      Next decisions
                    </button>
                  </>
                )}
              </section>
            )}
            {bound && (
              <div>
                {proof.status !== "approved" && (
                  <>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={confirm}
                        disabled={busy}
                        onChange={(e) => setConfirm(e.target.checked)}
                      />
                      <span>
                        I have reviewed version {proof.version} and approve this
                        exact proof.
                      </span>
                    </label>
                    <button
                      className="button primary full"
                      disabled={!confirm || busy}
                      onClick={() => void decide("approve")}
                    >
                      Approve version {proof.version}
                    </button>
                  </>
                )}
                <label className="field">
                  Need a change?
                  <textarea
                    rows={3}
                    maxLength={1500}
                    value={comment}
                    disabled={busy}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                <button
                  className="button outline full"
                  disabled={!comment.trim() || busy}
                  onClick={() => void decide("changes")}
                >
                  Request changes
                </button>
              </div>
            )}
          </section>
        )}
      </div>
      <aside className="prose">
        <h2>A private review.</h2>
        <p>
          Check every name, date and placement. Approval belongs to this exact
          proof version; a later revision needs a new review.
        </p>
        <p>
          Proof approval does not take payment or authorize manufacturing.
          Payment, inventory and production readiness are checked separately.
        </p>
        <div className="notice">
          <h3>Local review, not live production</h3>
          <p>
            Connected services are required. Text and configuration evidence
            does not qualify images, exports, materials or machines.
          </p>
        </div>
      </aside>
    </div>
  );
}
