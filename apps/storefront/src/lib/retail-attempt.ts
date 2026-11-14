import { newId } from "./client";
export type RetailAttempt = { version: 1; id: string; state: "pending" | "confirmed" };
const KEY = "sonoran:retail-attempt";
const MESSAGE = "Request recovery storage is unavailable or could not be verified. No new submission was started. Keep this page open and try checking recovery again.";
function valid(value: unknown): value is RetailAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join(",") === "id,state,version" &&
    v.version === 1 && typeof v.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id) &&
    v.id.length === 36 && (v.state === "pending" || v.state === "confirmed");
}
export function readRetailAttempt(): RetailAttempt | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (!valid(value)) throw Error();
    return value;
  } catch { throw Error(MESSAGE); }
}
function write(attempt: RetailAttempt) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(attempt));
    const observed = readRetailAttempt();
    if (!observed || observed.id !== attempt.id || observed.state !== attempt.state)
      throw Error();
  } catch { throw Error(MESSAGE); }
}
export function prepareRetailAttempt(expected: RetailAttempt | null = null): RetailAttempt {
  const previous = readRetailAttempt();
  if (expected && (!previous || previous.id !== expected.id)) throw Error(MESSAGE);
  if (previous?.state === "confirmed")
    throw Error("This tab already has a confirmed request. Explicitly start another request before submitting again.");
  const attempt: RetailAttempt = previous ?? { version: 1, id: newId(), state: "pending" };
  write(attempt);
  return attempt;
}
export function confirmRetailAttempt(id: string): RetailAttempt {
  const previous = readRetailAttempt();
  if (!previous || previous.id !== id) throw Error(MESSAGE);
  const confirmed: RetailAttempt = { ...previous, state: "confirmed" };
  write(confirmed);
  return confirmed;
}
export function clearConfirmedRetailAttempt(id: string) {
  const previous = readRetailAttempt();
  if (!previous || previous.id !== id || previous.state !== "confirmed")
    throw Error("The previous request is not confirmed. Its reference has not been reset.");
  try {
    sessionStorage.removeItem(KEY);
    if (sessionStorage.getItem(KEY) !== null) throw Error();
  } catch { throw Error(MESSAGE); }
}
