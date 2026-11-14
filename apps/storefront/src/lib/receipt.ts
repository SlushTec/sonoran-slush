export type Receipt = { id: string; status: string; access_token: string };
export function verifiedReceipt(
  value: unknown,
  kind: "event" | "bulk" | "contact" | "retail",
): Receipt {
  const message =
    "We could not verify the submission receipt. The studio may have received your request. Your draft is still here; retry unchanged to recover its receipt.";
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(message);
  const receipt = value as Record<string, unknown>;
  const prefix =
    kind === "event" ? "evt_" : kind === "contact" ? "msg_" : "quo_";
  if (
    typeof receipt.id !== "string" ||
    receipt.id.length !== prefix.length + 32 ||
    !new RegExp("^" + prefix + "[a-f0-9]{32}$").test(receipt.id) ||
    typeof receipt.status !== "string" ||
    receipt.status.trim() !== receipt.status ||
    !/^[a-z][a-z0-9_]{0,99}$/.test(receipt.status) ||
    typeof receipt.access_token !== "string" ||
    receipt.access_token.length !== 43 ||
    !/^[A-Za-z0-9_-]{43}$/.test(receipt.access_token)
  )
    throw new Error(message);
  return {
    id: receipt.id,
    status: receipt.status,
    access_token: receipt.access_token,
  };
}
