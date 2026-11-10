export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export async function commerce<T>(
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const origin = process.env.NEXT_PUBLIC_COMMERCE_API_URL;
  if (!origin)
    throw new ServiceError(
      "Online submission is not connected in this review. Your draft is still here. You can download a copy below.",
      503,
    );
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 12000);
  try {
    const res = await fetch(origin.replace(/\/$/, "") + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      signal: abort.signal,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok)
      throw new ServiceError(
        data?.error?.message ||
          data?.detail ||
          "We could not complete that request. Your draft has been kept. Please try again.",
        res.status,
      );
    return data as T;
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    throw new ServiceError(
      "The connection was interrupted. Your draft is still here. Please try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
export function downloadJSON(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function newId() {
  return crypto.randomUUID();
}
export const DRAFT_DAYS = 30;
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = JSON.parse(localStorage.getItem("sonoran:" + key) || "null");
    if (raw?.expires > Date.now()) return raw.value as T;
    localStorage.removeItem("sonoran:" + key);
  } catch {
    /* storage is optional */
  }
  return fallback;
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(
      "sonoran:" + key,
      JSON.stringify({ value, expires: Date.now() + DRAFT_DAYS * 86400000 }),
    );
    return true;
  } catch {
    return false;
  }
}
