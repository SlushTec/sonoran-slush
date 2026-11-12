const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
const ts = require("typescript"),
  { JSDOM } = require("jsdom");
const dom = new JSDOM(
  '<!doctype html><html lang="en"><head><title>Proof review</title></head><body></body></html>',
  { url: "https://review.example.test/proofs" },
);
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "Node",
  "MutationObserver",
  "localStorage",
  "location",
  "getComputedStyle",
])
  Object.defineProperty(global, key, {
    value:
      key === "getComputedStyle"
        ? dom.window.getComputedStyle.bind(dom.window)
        : dom.window[key],
    configurable: true,
    writable: true,
  });
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
global.IS_REACT_ACT_ENVIRONMENT = true;
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/"))
    request = path.join(
      __dirname,
      "../../apps/storefront/src",
      request.slice(2),
    );
  return originalResolve.call(this, request, parent, ...rest);
};
for (const ext of [".ts", ".tsx"])
  require.extensions[ext] = (m, f) =>
    m._compile(
      ts.transpileModule(fs.readFileSync(f, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      f,
    );
const React = require("react"),
  {
    render,
    screen,
    fireEvent,
    waitFor,
    cleanup,
    act,
  } = require("@testing-library/react");

const {
  default: Portal,
  squareSandboxAddress,
} = require("../../apps/storefront/src/components/OrderReviewPortal.tsx");
const makeOrder = () => ({
  id: "ord_test",
  kind: "order",
  version: 2,
  status: "awaiting_payment",
  payment_status: "unpaid",
  proof_status: "awaiting_proof",
  total_minor: 1234,
  currency: "USD",
  test_payment_available: true,
  items: [{ product_slug: "synthetic-item", quantity: 1 }],
  timeline: [{ label: "Order prepared", at: "2026-11-11T12:00:00+00:00" }],
});
let p, calls, handler;
const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
function enter() {
  fireEvent.change(screen.getByLabelText("Order reference"), {
    target: { value: "ord_test" },
  });
  fireEvent.change(screen.getByLabelText("Private access code"), {
    target: { value: "synthetic-code" },
  });
  fireEvent.submit(document.querySelector("form"));
}
async function open() {
  render(React.createElement(Portal));
  enter();
  await screen.findByRole("heading", { name: "Current order" });
}
test.beforeEach(() => {
  process.env.NEXT_PUBLIC_COMMERCE_API_URL = "https://commerce.qa.invalid";
  p = makeOrder();
  calls = [];
  handler = null;
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (handler) {
      const r = await handler(url, opts);
      if (r) return r;
    }
    return reply(p);
  };
});
test.afterEach(() => {
  cleanup();
  localStorage.clear();
  delete process.env.NEXT_PUBLIC_COMMERCE_API_URL;
});
test("Square raw-string allowlist strict parity", () => {
  for (const url of [
    "https://sandbox.square.link/u/a",
    "https://sandbox.square.link:443/u/Abc_12-x",
  ])
    assert.equal(squareSandboxAddress(url), true);
  for (const url of [
    null,
    {},
    true,
    12,
    "https://checkout.stripe.com/a",
    "https://square.link/u/a",
    "http://sandbox.square.link/u/a",
    "https://sandbox.square.link:0443/u/a",
    "https://sandbox.square.link:444/u/a",
    "https://user@sandbox.square.link/u/a",
    "https://sandbox.square.link.evil/u/a",
    "https://sandbox.square.link/u/a?q=x",
    "https://sandbox.square.link/u/a#x",
    "https://sandbox.square.link/u/a/extra",
    "https://sandbox.square.link/u/%61",
    "https://sandbox.square.link/u/a\n",
    "https://sandbox.square.link/u/a\r",
    " https://sandbox.square.link/u/a",
    "https://sandbox.square.link/u/",
    "https://sandbox.square.link./u/a",
    "https://SANDBOX.square.link/u/a",
    "https://sandbox.square.link\\u\\a",
  ])
    assert.equal(squareSandboxAddress(url), false, String(url));
});
test("read current order without exposing private token", async () => {
  await open();
  assert.ok(screen.getByText("$12.34"));
  assert.ok(
    screen.getByRole("button", { name: "Open Square sandbox checkout" }),
  );
  assert.equal(calls[0].opts.headers.Authorization, "Bearer synthetic-code");
  assert.equal(localStorage.length, 0);
  assert.equal(window.sessionStorage.length, 0);
  assert.ok(!location.href.includes("synthetic-code"));
});
for (const patch of [
  { test_payment_available: false },
  { test_payment_available: undefined },
  { payment_status: "paid" },
  { status: "cancelled" },
  { total_minor: 0 },
  { total_minor: null },
  { currency: "EUR" },
])
  test(
    "unavailable order cannot initiate checkout " + JSON.stringify(patch),
    async () => {
      Object.assign(p, patch);
      await open();
      assert.equal(
        screen.queryByRole("button", { name: "Open Square sandbox checkout" }),
        null,
      );
      assert.equal(calls.length, 1);
    },
  );
for (const patch of [
  { id: "other" },
  { version: true },
  { version: 0 },
  { version: "2" },
  { version: Number.MAX_SAFE_INTEGER + 1 },
  { total_minor: "1234" },
  { test_payment_available: "true" },
  { kind: "quote" },
  { items: [{ product_slug: "x", quantity: 501 }] },
  { timeline: [{ label: "x", at: "not-date" }] },
  { next_step: "x".repeat(3001) },
  { shipment: { carrier: "x", tracking: "\ud800" } },
])
  test("malformed order denied " + JSON.stringify(patch), async () => {
    Object.assign(p, patch);
    render(React.createElement(Portal));
    enter();
    await screen.findByRole("alert");
    assert.equal(
      screen.queryByRole("heading", { name: "Current order" }),
      null,
    );
  });
for (const event of [
  "close",
  "edit",
  "popstate",
  "pagehide",
  "pageshow",
  "unmount",
])
  test("late lookup cannot restore after " + event, async () => {
    let resolve;
    handler = () => new Promise((r) => (resolve = r));
    const view = render(React.createElement(Portal));
    enter();
    if (event === "close")
      fireEvent.click(
        screen.getByRole("button", { name: "Close private record" }),
      );
    else if (event === "edit")
      fireEvent.change(screen.getByLabelText("Private access code"), {
        target: { value: "new-code" },
      });
    else if (event === "unmount") view.unmount();
    else if (event === "pageshow")
      window.dispatchEvent(
        new window.PageTransitionEvent("pageshow", { persisted: true }),
      );
    else window.dispatchEvent(new window.Event(event));
    await act(async () => resolve(reply(p)));
    assert.equal(
      screen.queryByRole("heading", { name: "Current order" }),
      null,
    );
  });
test("ordinary pageshow preserves entry", () => {
  render(React.createElement(Portal));
  fireEvent.change(screen.getByLabelText("Order reference"), {
    target: { value: "ord_test" },
  });
  window.dispatchEvent(
    new window.PageTransitionEvent("pageshow", { persisted: false }),
  );
  assert.equal(screen.getByLabelText("Order reference").value, "ord_test");
});
for (const result of [
  {
    url: "https://checkout.stripe.com/x",
    provider: "square",
    test_mode: true,
    session_id: "x",
  },
  {
    url: "https://sandbox.square.link/u/a",
    provider: "stripe",
    test_mode: true,
    session_id: "x",
  },
  {
    url: "https://sandbox.square.link/u/a",
    provider: "square",
    test_mode: "true",
    session_id: "x",
  },
  {
    url: "https://sandbox.square.link/u/a",
    provider: "square",
    test_mode: true,
    session_id: "",
  },
  {
    url: "https://sandbox.square.link/u/a",
    provider: "square",
    test_mode: true,
    session_id: 9,
  },
])
  test(
    "malformed checkout response cannot navigate " + JSON.stringify(result),
    async () => {
      await open();
      handler = (url) => (url.endsWith("/sessions") ? reply(result) : null);
      fireEvent.click(
        screen.getByRole("button", { name: "Open Square sandbox checkout" }),
      );
      await screen.findByRole("alert");
      assert.equal(
        screen.queryByRole("heading", { name: "Current order" }),
        null,
      );
    },
  );
test("exact order bearer/version, duplicate guard and conflict requires reopen", async () => {
  await open();
  let resolve;
  handler = (url, opts) => {
    assert.deepEqual(JSON.parse(opts.body), {
      order_id: "ord_test",
      version: 2,
    });
    assert.equal(opts.headers.Authorization, "Bearer synthetic-code");
    return new Promise((r) => (resolve = r));
  };
  const button = screen.getByRole("button", {
    name: "Open Square sandbox checkout",
  });
  fireEvent.click(button);
  fireEvent.click(button);
  assert.equal(calls.length, 2);
  await act(async () => resolve(reply({ detail: "conflict" }, 409)));
  await screen.findByRole("alert");
  assert.equal(
    screen.queryByRole("button", { name: "Open Square sandbox checkout" }),
    null,
  );
});
test("late checkout failure cannot overwrite reopened session", async () => {
  await open();
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  fireEvent.click(
    screen.getByRole("button", { name: "Open Square sandbox checkout" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Close private record" }));
  handler = null;
  enter();
  await screen.findByRole("heading", { name: "Current order" });
  await act(async () => resolve(reply({}, 409)));
  assert.equal(screen.queryByRole("alert"), null);
  assert.ok(
    screen.getByRole("button", { name: "Open Square sandbox checkout" }),
  );
});
test("bounded item and event DOM pagination", async () => {
  p.items = Array.from({ length: 100 }, (_, i) => ({
    product_slug: "piece-" + i,
    quantity: 1,
  }));
  p.timeline = Array.from({ length: 100 }, (_, i) => ({
    label: "event-" + i,
    at: "2026-11-11T12:00:00Z",
  }));
  await open();
  assert.equal(screen.queryByText("piece-10 · quantity 1"), null);
  assert.equal(screen.queryByText("event-25"), null);
  fireEvent.click(screen.getByRole("button", { name: "Next items" }));
  assert.ok(screen.getByText("piece-10 · quantity 1"));
  fireEvent.click(screen.getByRole("button", { name: "Next events" }));
  assert.ok(screen.getByText("event-25"));
});

function captureDownloads(t) {
  const blobs = [],
    clicks = [],
    revoked = [];
  const create = URL.createObjectURL,
    revoke = URL.revokeObjectURL,
    click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => {
    blobs.push(blob);
    return "blob:owned-" + blobs.length;
  };
  URL.revokeObjectURL = (url) => revoked.push(url);
  window.HTMLAnchorElement.prototype.click = function () {
    clicks.push({ href: this.href, name: this.download });
  };
  t.after(() => {
    cleanup();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    window.HTMLAnchorElement.prototype.click = click;
  });
  return { blobs, clicks, revoked };
}
async function download() {
  fireEvent.click(
    screen.getByRole("button", { name: "Download order summary" }),
  );
}
test("summary refreshes with captured capability and positive allowlist, never raw secrets", async (t) => {
  const d = captureDownloads(t);
  p.extra_secret = "DO-NOT-EXPORT";
  p.access_token = "PRIVATE";
  p.staff_notes = "COST";
  p.items[0].hidden = "SUPPLIER";
  await open();
  await download();
  await waitFor(() => assert.equal(d.clicks.length, 1));
  const body = await d.blobs[0].text();
  assert.match(body, /Payment status: unpaid/);
  assert.match(body, /Not a paid receipt or tax invoice/);
  for (const value of [
    "DO-NOT-EXPORT",
    "PRIVATE",
    "COST",
    "SUPPLIER",
    "synthetic-code",
  ])
    assert.equal(body.includes(value), false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].opts.headers.Authorization, "Bearer synthetic-code");
  assert.equal(d.clicks[0].name, "sonoran-order-ord_test.txt");
  assert.equal(document.querySelector("a[download]"), null);
  fireEvent.click(screen.getByRole("button", { name: "Close private record" }));
  assert.deepEqual(d.revoked, ["blob:owned-1"]);
});
test("summary preserves accents emoji and visibly encodes format and line controls", async (t) => {
  const d = captureDownloads(t);
  p.next_step = "Café 🌼\u202Epaid\u2028Payment status: paid\u2029\u2066";
  await open();
  await download();
  await waitFor(() => assert.equal(d.blobs.length, 1));
  const body = await d.blobs[0].text();
  assert.ok(body.includes("Café 🌼"));
  assert.ok(body.includes("\\u{202E}"));
  assert.ok(body.includes("\\u{2028}"));
  assert.ok(body.includes("\\u{2029}"));
  assert.ok(body.includes("\\u{2066}"));
  assert.equal(
    body.split("\n").filter((x) => x.startsWith("Payment status:")).length,
    1,
  );
});
test("unquoted summary never invents zero price", async (t) => {
  const d = captureDownloads(t);
  p.total_minor = null;
  await open();
  await download();
  await waitFor(() => assert.equal(d.blobs.length, 1));
  assert.match(await d.blobs[0].text(), /Reviewed total: Not yet quoted/);
});
for (const field of [
  "version",
  "payment_status",
  "status",
  "proof_status",
  "total_minor",
  "next_step",
  "items",
  "timeline",
  "shipment",
]) {
  test(
    "changed " + field + " requires review and another click even same version",
    async (t) => {
      const d = captureDownloads(t);
      await open();
      const values = {
        version: 3,
        payment_status: "paid",
        status: "awaiting_production_checks",
        proof_status: "approved",
        total_minor: 5000,
        next_step: "Review change",
        items: [{ product_slug: "new", quantity: 2 }],
        timeline: [],
        shipment: { carrier: "Synthetic", tracking: "123" },
      };
      p = { ...p, [field]: values[field] };
      await download();
      await screen.findByText(/The order changed/);
      assert.equal(d.blobs.length, 0);
      await download();
      await waitFor(() => assert.equal(d.blobs.length, 1));
    },
  );
}
for (const leave of [
  "close",
  "id",
  "token",
  "back",
  "pagehide",
  "bfcache",
  "unmount",
]) {
  test(
    "late summary after " + leave + " creates no file or stale state",
    async (t) => {
      const d = captureDownloads(t);
      const view = render(React.createElement(Portal));
      enter();
      await screen.findByRole("heading", { name: "Current order" });
      let resolve;
      handler = () => new Promise((r) => (resolve = r));
      await download();
      if (leave === "close")
        fireEvent.click(
          screen.getByRole("button", { name: "Close private record" }),
        );
      if (leave === "id" || leave === "token")
        fireEvent.change(
          screen.getByLabelText(
            leave === "id" ? "Order reference" : "Private access code",
          ),
          { target: { value: "new" } },
        );
      if (leave === "back")
        fireEvent(window, new window.PopStateEvent("popstate"));
      if (leave === "pagehide") fireEvent(window, new window.Event("pagehide"));
      if (leave === "bfcache") {
        const e = new window.Event("pageshow");
        Object.defineProperty(e, "persisted", { value: true });
        fireEvent(window, e);
      }
      if (leave === "unmount") view.unmount();
      await act(async () => resolve(reply(p)));
      assert.equal(d.blobs.length, 0);
      assert.equal(d.clicks.length, 0);
    },
  );
}
test("duplicate summary and interleaved checkout share synchronous operation lock", async (t) => {
  const d = captureDownloads(t);
  await open();
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  const button = screen.getByRole("button", { name: "Download order summary" });
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(
    screen.getByRole("button", { name: "Open Square sandbox checkout" }),
  );
  assert.equal(calls.length, 2);
  await act(async () => resolve(reply(p)));
  assert.equal(d.blobs.length, 1);
});
test("failed refresh permits retry without an unverified download", async (t) => {
  const d = captureDownloads(t);
  await open();
  handler = () => reply({}, 500);
  await download();
  await screen.findByText(/summary could not be verified/);
  assert.equal(d.blobs.length, 0);
  handler = null;
  await download();
  await waitFor(() => assert.equal(d.blobs.length, 1));
});
test("wrong refreshed identity never downloads", async (t) => {
  const d = captureDownloads(t);
  await open();
  p = { ...p, id: "other" };
  await download();
  await screen.findByText(/summary could not be verified/);
  assert.equal(d.blobs.length, 0);
});
test("download anchor failure revokes owned URL and removes anchor", async (t) => {
  const d = captureDownloads(t);
  await open();
  window.HTMLAnchorElement.prototype.click = () => {
    throw Error("synthetic");
  };
  await download();
  await screen.findByText(/summary could not be verified/);
  assert.equal(d.revoked.length, 1);
  assert.equal(document.querySelector("a[download]"), null);
});

test("synchronous dismissal during download click cannot restore stale notice", async (t) => {
  const d = captureDownloads(t);
  await open();
  window.HTMLAnchorElement.prototype.click = () =>
    window.dispatchEvent(new window.Event("pagehide"));
  await act(async () => {
    await download();
  });
  assert.ok(screen.queryByRole("heading", { name: "Current order" }) === null);
  assert.ok(screen.queryByText(/Order-summary download requested/) === null);
  assert.equal(d.revoked.length, 1);
  enter();
  await screen.findByRole("heading", { name: "Current order" });
  assert.ok(screen.queryByText(/Order-summary download requested/) === null);
});
for (const [amount, currency, expected] of [
  [1234, "USD", "USD 12.34"],
  [0, "USD", "USD 0.00"],
  [Number.MAX_SAFE_INTEGER, "USD", "USD 90071992547409.91"],
  [1234, "JPY", "1234 minor units (JPY; decimal convention not assumed)"],
]) {
  test(
    "summary formats exact server amount " + amount + " " + currency,
    async (t) => {
      const d = captureDownloads(t);
      p.total_minor = amount;
      p.currency = currency;
      await open();
      await download();
      await waitFor(() => assert.equal(d.blobs.length, 1));
      assert.ok(
        (await d.blobs[0].text()).includes("Reviewed total: " + expected),
      );
    },
  );
}
