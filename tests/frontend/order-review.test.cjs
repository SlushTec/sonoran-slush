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
        screen.queryByRole("button", { name: "Open Square sandbox checkout" }) === null,
        true,
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
      screen.queryByRole("heading", { name: "Current order" }) === null,
      true,
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
      screen.queryByRole("heading", { name: "Current order" }) === null,
      true,
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
        screen.queryByRole("heading", { name: "Current order" }) === null,
        true,
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
    screen.queryByRole("button", { name: "Open Square sandbox checkout" }) === null,
    true,
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
  assert.equal(screen.queryByRole("alert") === null, true);
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
  assert.equal(screen.queryByText("piece-10 · quantity 1") === null, true);
  assert.equal(screen.queryByText("event-25") === null, true);
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
  assert.equal(document.querySelector("a[download]") === null, true);
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
  assert.equal(document.querySelector("a[download]") === null, true);
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


// Fixed inventory from the independently reviewed 798f841 source: original query
// and message text hashes, not values generated from the transformed expectation.
test("DOM absence diagnostics retain all 54 original strict-null intentions", () => {
  const { createHash } = require("node:crypto");
  const inventory = {
    "storefront.test.cjs": [4, "7b656cab77c151c627c52a70225cbe46be00f87e34216082aa3c190a1f35f286"],
    "proof-review.test.cjs": [15, "10a181bb84e018638224d38979eb036a32543d9d9679ccd07a128a485d1658dd"],
    "order-review.test.cjs": [10, "82e1cdbe1b477bbbfd5c4d2e58b8285f0d6b743f82d295fcbd75ca528f238105"],
    "quote-review.test.cjs": [13, "9167948a92279850f8482e9fa8817fa3d9c7facd5224878f7b906e15f4234aca"],
    "staff-session.test.cjs": [12, "c5c8d49998dc00b0c6e366283ff6ece2d646e90a3055377a99a522e804195206"],
  };
  let total = 0, untouched = [];
  for (const [name, [expectedCount, expectedHash]] of Object.entries(inventory)) {
    const source = fs.readFileSync(path.join(__dirname, name), "utf8");
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const rows = [];
    function domQuery(node) {
      return ts.isCallExpression(node) &&
        /^(screen\.queryBy|document\.querySelector)/.test(node.expression.getText(ast));
    }
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "assert.equal" && node.arguments.length >= 2) {
        const [actual, expected, message] = node.arguments;
        if (expected.kind === ts.SyntaxKind.NullKeyword) {
          assert.equal(domQuery(actual), false, "DOM nodes must not reach failure formatting");
          untouched.push([actual.getText(ast), message?.getText(ast) || ""]);
        }
        if (expected.kind === ts.SyntaxKind.TrueKeyword && ts.isBinaryExpression(actual) &&
            actual.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
            actual.right.kind === ts.SyntaxKind.NullKeyword && domQuery(actual.left)) {
          rows.push([actual.left.getText(ast), message?.getText(ast) || ""]);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(rows.length, expectedCount);
    assert.equal(createHash("sha256").update(JSON.stringify(rows)).digest("hex"), expectedHash);
    total += rows.length;
  }
  assert.equal(total, 54);
  assert.equal(untouched.length, 5);
  assert.equal(createHash("sha256").update(JSON.stringify(untouched)).digest("hex"),
    "d5be9f844c0968bbbda00479cae83e3a9cc4571cd8d8ecb504794843a1cdae41");
});

for (const mode of ["missing", "undefined", "false", "element"]) {
  test("strict-null diagnostics subprocess is bounded and secret-safe: " + mode, () => {
    const { spawnSync } = require("node:child_process");
    const { randomBytes } = require("node:crypto");
    const sentinel = "private-fixture-" + randomBytes(24).toString("hex");
    const child = String.raw`
const test = require("node:test"), assert = require("node:assert/strict");
const { JSDOM } = require("jsdom"), React = require("react");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {url:"https://fixture.invalid"});
for (const k of ["window","document","HTMLElement","Node","MutationObserver"])
  Object.defineProperty(global,k,{value:dom.window[k],configurable:true});
Object.defineProperty(global,"navigator",{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, cleanup } = require("@testing-library/react");
test("strict-null assertion", () => {
  try {
    render(React.createElement("button", {"data-private":process.env.DOM_SECRET_SENTINEL}, "Fixture"));
    const mode = process.env.DOM_DIAGNOSTIC_MODE;
    const query = mode === "element" ? screen.queryByRole("button") :
      mode === "missing" ? screen.queryByRole("checkbox") :
      mode === "false" ? false : undefined;
    assert.equal(query === null, true);
  } finally { cleanup(); dom.window.close(); }
});
`;
    const started = Date.now();
    const result = spawnSync(process.execPath, ["--eval", child], {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, DOM_SECRET_SENTINEL: sentinel, DOM_DIAGNOSTIC_MODE: mode },
      encoding: "utf8", timeout: 5000, killSignal: "SIGKILL",
      maxBuffer: 256 * 1024, windowsHide: true,
    });
    // Never echo child diagnostics, the sentinel, or live objects on failure.
    assert.equal(result.error === undefined, true, "Child must finish without timeout or spawn error");
    assert.equal(result.signal === null, true, "Child must exit normally, not be killed");
    assert.equal(Date.now() - started < 5000, true, "Failure diagnostics must be prompt");
    assert.equal(result.status === (mode === "missing" ? 0 : 1), true, "Strict null result");
    assert.equal(typeof result.stdout === "string" && typeof result.stderr === "string", true);
    const output = result.stdout + result.stderr;
    assert.equal(output.includes(sentinel), false, "Private DOM props must not leak");
    assert.equal(output.includes("AssertionError"), mode !== "missing", "Expected assertion failure, not infrastructure error");
  });
}

const { customerInscriptions, inscriptionSummary, quotedInscription } =
  require("../../apps/storefront/src/components/CustomerInscriptions.tsx");
function inscriptionOrder(mode="per_piece", quantity=2, count=2) {
  const o=makeOrder();
  const pieces=Array.from({length:quantity*count},(_,n)=>({
    set_index:Math.floor(n/count),piece_index:n%count,text:"  Caf\u00e9 \u{1f41f} "+n+"  ",
  }));
  const item={product_slug:"synthetic-crystal",quantity,font:"Modern sans",
    personalization:mode==="identical"?{mode,text:" \uFEFF "}:{mode,pieces:[...pieces].reverse()}};
  o.items=[item];
  o.lines=[{item:JSON.parse(JSON.stringify(item)),stock_units:quantity*7,
    personalization_snapshot:{schema_version:1,mode,line_index:0,quantity,pieces_per_item:count,
      pieces:mode==="identical"?pieces.map(v=>({...v,text:item.personalization.text})):pieces}}];
  return o;
}
test("customer projection preserves canonical assignments and excludes all hidden fields",()=>{
  const o=inscriptionOrder(); o.notes="SECRET"; o.lines[0].supplier_cost="SECRET";
  const v=customerInscriptions(o);
  assert.equal(v.entries.length,4);
  assert.deepEqual(v.entries[0],{line:0,slug:"synthetic-crystal",quantity:2,font:"Modern sans",
    allocation:"per_piece",set:0,piece:0,text:"  Caf\u00e9 \u{1f41f} 0  ",secondary:""});
  assert.equal(JSON.stringify(v).includes("SECRET"),false);
  const equivalent=structuredClone(o); equivalent.items[0].personalization.pieces.reverse();
  assert.deepEqual(customerInscriptions(equivalent),v);
});
test("customer legacy projection drops arbitrary options and retains multiline text",()=>{
  const o=makeOrder(); o.items[0]={...o.items[0],text:" first\nsecond ",secondary:"\tother\r\n",
    font:"Classic serif",options:{"Private option":"SECRET"},notes:"SECRET"};
  const v=customerInscriptions(o);
  assert.equal(v.entries[0].text," first\nsecond "); assert.equal(v.entries[0].secondary,"\tother\r\n");
  assert.equal(v.entries[0].allocation,"unknown"); assert.equal(JSON.stringify(v).includes("SECRET"),false);
});
for (const [name,change] of Object.entries({
  "missing lines":o=>delete o.lines,
  "missing snapshot":o=>delete o.lines[0].personalization_snapshot,
  "null assignment":o=>o.items[0].personalization=null,
  "orphan snapshot":o=>delete o.items[0].personalization,
  "wrong line":o=>o.lines[0].personalization_snapshot.line_index=1,
  "wrong quantity":o=>o.lines[0].personalization_snapshot.quantity=3,
  "wrong text":o=>o.lines[0].personalization_snapshot.pieces[0].text="other",
  "duplicate index":o=>o.lines[0].personalization_snapshot.pieces[1].piece_index=0,
  "stock not pieces":o=>delete o.lines[0].personalization_snapshot.pieces_per_item,
  "font mismatch":o=>o.lines[0].item.font="Classic serif",
  "invalid font":o=>o.items[0].font="made up",
  "oversize":o=>o.items[0].personalization.pieces[0].text="x".repeat(121),
  "control":o=>o.items[0].personalization.pieces[0].text="x\u0085",
  "surrogate":o=>o.items[0].personalization.pieces[0].text="\uD800",
})) test("customer inscription rejects "+name,()=>{const o=inscriptionOrder();change(o);assert.throws(()=>customerInscriptions(o));});
test("identical BOM and maximum supplementary inscription are valid",()=>{
  assert.equal(customerInscriptions(inscriptionOrder("identical")).entries[0].text," \uFEFF ");
  const o=inscriptionOrder("identical");
  o.items[0].personalization.text="\u{1f41f}".repeat(120);
  o.lines[0].item=structuredClone(o.items[0]);
  o.lines[0].personalization_snapshot.pieces.forEach(v=>v.text=o.items[0].personalization.text);
  assert.equal(customerInscriptions(o).entries[0].text,o.items[0].personalization.text);
});
test("quoted inscription cannot forge summary fields or ambiguous slash escapes",()=>{
  const value='x\nPayment status: paid\r\t"\\\u202E\u2028\u2029 Caf\u00e9 \u{1f41f}';
  const encoded=quotedInscription(value);
  assert.equal(encoded.includes("\n"),false); assert.equal(encoded.includes("\r"),false);
  assert.ok(encoded.includes("\\nPayment status: paid"));
  assert.ok(encoded.includes("\\u{202E}")); assert.ok(encoded.includes('Caf\u00e9 \u{1f41f}'));
  assert.notEqual(quotedInscription("\u202E"),quotedInscription("\\u{202E}"));
});
test("absent and empty allocation are explicitly distinct",()=>{
  assert.equal(customerInscriptions({}).availability,"absent");
  assert.equal(customerInscriptions({items:[]}).availability,"empty");
});
test("same SKU lines remain separate and maximum bounded projection paginates",async()=>{
  p=inscriptionOrder("per_piece",5,100);
  p.items=Array.from({length:4},()=>structuredClone(p.items[0]));
  p.lines=Array.from({length:4},(_,n)=>({...structuredClone(p.lines[0]),
    personalization_snapshot:{...structuredClone(p.lines[0].personalization_snapshot),line_index:n}}));
  assert.equal(customerInscriptions(p).entries.length,2000);
  // Finish the async mount and child reset effect before testing a user page click.
  await open();
  await act(async () => {});
  const region=screen.getByRole("region",{name:"Your recorded inscriptions"});
  assert.equal(region.querySelectorAll("li").length,25);
  fireEvent.click(screen.getByRole("button",{name:"Next inscription page"}));
  assert.ok(screen.getByText("Inscription page 2 of 80"));
  fireEvent.click(screen.getByRole("button",{name:"Close private record"}));
  const gone=screen.queryByRole("region",{name:"Your recorded inscriptions"})===null;
  assert.equal(gone,true);
});
for(const change of ["text","font","mode"]) test("same-version "+change+" requires new review before summary",async(t)=>{
  const d=captureDownloads(t);p=inscriptionOrder();await open();
  p=structuredClone(p);
  if(change==="text"){
    p.items[0].personalization.pieces[0].text="Changed";
    p.lines[0].item=structuredClone(p.items[0]);
    p.lines[0].personalization_snapshot.pieces[3].text="Changed";
  } else if(change==="font"){
    p.items[0].font="Handwritten";p.lines[0].item.font="Handwritten";
  } else {
    p=inscriptionOrder("identical");
  }
  await download();await screen.findByText(/The order changed/);
  assert.equal(d.blobs.length,0);
  await download();await waitFor(()=>assert.equal(d.blobs.length,1));
  assert.ok((await d.blobs[0].text()).includes("Recorded inscriptions only"));
});
test("normalized assignment order and hidden metadata do not require extra click",async(t)=>{
  const d=captureDownloads(t);p=inscriptionOrder();await open();
  p=structuredClone(p);p.items[0].personalization.pieces.reverse();
  p.notes="SECRET";p.lines[0].provider_data="SECRET";
  await download();await waitFor(()=>assert.equal(d.blobs.length,1));
  assert.equal((await d.blobs[0].text()).includes("SECRET"),false);
});
test("legacy summary quotes multiline labels and omits options",async(t)=>{
  const d=captureDownloads(t);
  p.items[0].text="\nPayment status: paid";p.items[0].secondary="\tOther";
  p.items[0].options={private:"SECRET"};
  await open();await download();await waitFor(()=>assert.equal(d.blobs.length,1));
  const body=await d.blobs[0].text();
  assert.equal(body.split("\n").filter(v=>v.startsWith("Payment status:")).length,1);
  assert.ok(body.includes('Text: "\\nPayment status: paid"'));
  assert.equal(body.includes("SECRET"),false);
});

test("late structured summary after Close cannot restore inscriptions or create file",async(t)=>{
  const d=captureDownloads(t);p=inscriptionOrder();await open();
  let resolve;handler=()=>new Promise(r=>resolve=r);
  await download();fireEvent.click(screen.getByRole("button",{name:"Close private record"}));
  await act(async()=>resolve(reply(p)));
  assert.equal(d.blobs.length,0);
  const gone=screen.queryByRole("region",{name:"Your recorded inscriptions"})===null;
  assert.equal(gone,true);
});
test("customer legacy multiline whitespace and literal markup remain text in DOM",async()=>{
  p.items[0].text=" first\n<img src=x onerror=alert(1)> ";
  p.items[0].secondary="\tsecondary\r\n";p.items[0].font="Handwritten";
  await open();
  const region=screen.getByRole("region",{name:"Your recorded inscriptions"});
  assert.ok(region.textContent.includes(p.items[0].text));
  assert.ok(region.textContent.includes(p.items[0].secondary));
  assert.equal(region.querySelectorAll("img").length,0);
});
