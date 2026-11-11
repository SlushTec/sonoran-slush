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
