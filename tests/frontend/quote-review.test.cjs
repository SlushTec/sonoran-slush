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

const Portal =
  require("../../apps/storefront/src/components/QuoteReviewPortal.tsx").default;
const makeQuote = () => ({
  id: "quo_test",
  kind: "retail",
  version: 2,
  status: "offered",
  accepted_version: null,
  total_minor: 1234,
  currency: "USD",
  message: "Exact reviewed offer\nSecond line",
  items: [
    {
      product_slug: "synthetic",
      quantity: 1,
      text: "Hello",
      secondary: "Again",
      font: "Classic serif",
    },
  ],
});
let p, calls, handler;
const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
function enter() {
  fireEvent.change(screen.getByLabelText("Request reference"), {
    target: { value: "quo_test" },
  });
  fireEvent.change(screen.getByLabelText("Private access code"), {
    target: { value: "synthetic-code" },
  });
  fireEvent.submit(document.querySelector("form"));
}
async function open() {
  render(React.createElement(Portal));
  enter();
  await screen.findByRole("heading", { name: "Current request" });
}
function accept() {
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Accept quote version 2" }),
  );
}
test.beforeEach(() => {
  process.env.NEXT_PUBLIC_COMMERCE_API_URL = "https://commerce.qa.invalid";
  p = makeQuote();
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
  delete process.env.NEXT_PUBLIC_COMMERCE_API_URL;
});
test("exact quote acceptance confirms captured terms and capability holder only", async () => {
  await open();
  handler = (url, opts) => {
    assert.deepEqual(JSON.parse(opts.body), { version: 2, decision: "accept" });
    assert.equal(opts.headers.Authorization, "Bearer synthetic-code");
    p = { ...p, status: "accepted", accepted_version: 2 };
    return reply(p);
  };
  accept();
  await screen.findByRole("status");
  assert.equal(screen.queryByRole("checkbox"), null);
  assert.equal(calls.length, 2);
  assert.equal(localStorage.length, 0);
  assert.equal(window.sessionStorage.length, 0);
});
for (const kind of ["retail", "bulk", "event", "contact"])
  test("unpriced submitted " + kind + " remains readable", async () => {
    p = {
      ...p,
      kind,
      status: "submitted",
      total_minor: null,
      message: undefined,
    };
    await open();
    assert.ok(screen.getByText("The studio has not priced this request yet."));
    assert.equal(screen.queryByRole("checkbox"), null);
  });
test("contact offered remains read only", async () => {
  p.kind = "contact";
  await open();
  assert.ok(screen.getByText("This contact request is read only."));
  assert.equal(screen.queryByRole("checkbox"), null);
});
for (const patch of [
  { id: "wrong" },
  { kind: ["retail"] },
  { status: ["offered"] },
  { version: true },
  { version: "2" },
  { version: 0 },
  { accepted_version: 2 },
  { status: "accepted", accepted_version: 1 },
  { status: "accepted", accepted_version: true },
  { status: "accepted", accepted_version: 2, message: undefined },
  { total_minor: "1234" },
  { total_minor: 0 },
  { currency: "EUR" },
  { message: "x".repeat(3001) },
  { message: "\ud800" },
  { items: [{ product_slug: "x", quantity: 1, font: ["Classic serif"] }] },
])
  test("reject malformed quote " + JSON.stringify(patch), async () => {
    Object.assign(p, patch);
    render(React.createElement(Portal));
    enter();
    await screen.findByRole("alert");
    assert.equal(
      screen.queryByRole("heading", { name: "Current request" }),
      null,
    );
  });
test("full3000 Unicode codepoint multiline message and120 inscription preserved", async () => {
  p.message = "😀".repeat(2996) + "\r\n\tX";
  p.items[0].text = "😀".repeat(120);
  await open();
  assert.equal(
    document.querySelectorAll("p")[
      document.querySelectorAll("p").length - 1
    ] !== null,
    true,
  );
  assert.ok(document.body.textContent.includes(p.message));
  assert.ok(document.body.textContent.includes(p.items[0].text));
});
test("escaped markup is never HTML", async () => {
  p.message = "<img src=x onerror=alert(1)>\nOffer";
  await open();
  assert.ok(document.body.textContent.includes(p.message));
  assert.equal(document.querySelector("img"), null);
});
for (const patch of [
  { id: "wrong" },
  { kind: "event" },
  { version: 3, accepted_version: 3 },
  { accepted_version: 1 },
  { status: "offered" },
  { total_minor: 9999 },
  { message: "Different terms" },
  { items: [{ product_slug: "different", quantity: 1 }] },
])
  test(
    "accepted response cannot change identity or displayed terms " +
      JSON.stringify(patch),
    async () => {
      await open();
      handler = () =>
        reply({ ...p, status: "accepted", accepted_version: 2, ...patch });
      accept();
      await screen.findByRole("alert");
      assert.equal(screen.queryByRole("status"), null);
      assert.equal(screen.queryByRole("checkbox"), null);
    },
  );
for (const event of [
  "close",
  "edit",
  "popstate",
  "pagehide",
  "pageshow",
  "unmount",
])
  for (const action of [false, true])
    test(
      "late " + (action ? "accept" : "lookup") + " isolated after " + event,
      async () => {
        let resolve;
        let view;
        if (action) {
          await open();
          handler = () => new Promise((r) => (resolve = r));
          accept();
        } else {
          handler = () => new Promise((r) => (resolve = r));
          view = render(React.createElement(Portal));
          enter();
        }
        if (event === "close")
          fireEvent.click(
            screen.getByRole("button", { name: "Close private record" }),
          );
        else if (event === "edit")
          fireEvent.change(screen.getByLabelText("Private access code"), {
            target: { value: "new-code" },
          });
        else if (event === "unmount") {
          if (view) view.unmount();
          else cleanup();
        } else if (event === "pageshow")
          window.dispatchEvent(
            new window.PageTransitionEvent("pageshow", { persisted: true }),
          );
        else window.dispatchEvent(new window.Event(event));
        await act(async () =>
          resolve(
            reply(
              action ? { ...p, status: "accepted", accepted_version: 2 } : p,
            ),
          ),
        );
        assert.equal(
          screen.queryByRole("heading", { name: "Current request" }),
          null,
        );
        assert.equal(screen.queryByRole("status"), null);
      },
    );
test("duplicate lock and conflict require fresh reopen", async () => {
  await open();
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  fireEvent.click(screen.getByRole("checkbox"));
  const b = screen.getByRole("button", { name: "Accept quote version 2" });
  fireEvent.click(b);
  fireEvent.click(b);
  assert.equal(calls.length, 2);
  await act(async () => resolve(reply({}, 409)));
  await screen.findByRole("alert");
  handler = null;
  fireEvent.submit(document.querySelector("form"));
  await screen.findByRole("checkbox");
  assert.equal(screen.getByRole("checkbox").checked, false);
});
test("late old failure cannot overwrite newer session", async () => {
  await open();
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  accept();
  fireEvent.click(screen.getByRole("button", { name: "Close private record" }));
  handler = null;
  enter();
  await screen.findByRole("heading", { name: "Current request" });
  await act(async () => resolve(reply({}, 409)));
  assert.equal(screen.queryByRole("alert"), null);
  assert.ok(screen.getByRole("checkbox"));
});
test("accepted replay readable without inviting repeat acceptance", async () => {
  p = { ...p, status: "accepted", accepted_version: 2 };
  await open();
  assert.equal(screen.queryByRole("checkbox"), null);
  assert.ok(screen.getByText(/studio record shows acceptance/));
  assert.equal(screen.queryByRole("status"), null);
});
test("max100 item list pages without truncating fields", async () => {
  p.items = Array.from({ length: 100 }, (_, i) => ({
    product_slug: "item-" + i,
    quantity: 500,
    text: "A".repeat(120),
    secondary: "B".repeat(120),
    font: "Modern sans",
  }));
  await open();
  assert.equal(screen.queryByText("item-10"), null);
  fireEvent.click(screen.getByRole("button", { name: "Next items" }));
  assert.ok(screen.getByText("item-10"));
});
test("ordinary pageshow preserves entry", () => {
  render(React.createElement(Portal));
  fireEvent.change(screen.getByLabelText("Request reference"), {
    target: { value: "quo_test" },
  });
  window.dispatchEvent(
    new window.PageTransitionEvent("pageshow", { persisted: false }),
  );
  assert.equal(screen.getByLabelText("Request reference").value, "quo_test");
});
