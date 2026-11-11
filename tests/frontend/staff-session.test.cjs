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

const Staff =
  require("../../apps/storefront/src/components/StaffWorkspace.tsx").default;
const summary = { counts: { submitted: 1 }, recent: [] };
const quote = () => ({
  id: "quo_test",
  kind: "retail",
  status: "offered",
  version: 2,
  total_minor: 1234,
  message: "Synthetic reviewed terms",
  items: [],
});
let doc, calls, handler;
const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
function login() {
  fireEvent.change(screen.getByLabelText("Staff access code"), {
    target: { value: "synthetic-staff" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
}
async function workspace() {
  render(React.createElement(Staff));
  login();
  await screen.findByRole("heading", { name: "Needs a little attention." });
}
async function open() {
  await workspace();
  fireEvent.change(screen.getByLabelText("Record reference"), {
    target: { value: doc.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open record" }));
  await screen.findByText(doc.id);
}
test.beforeEach(() => {
  process.env.NEXT_PUBLIC_COMMERCE_API_URL = "https://commerce.qa.invalid";
  doc = quote();
  calls = [];
  handler = null;
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (handler) {
      const r = await handler(url, opts);
      if (r) return r;
    }
    return reply(url.endsWith("/summary") ? summary : doc);
  };
});
test.afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_COMMERCE_API_URL;
});
test("regression: late mutation cannot reopen locked staff workspace or start old overview", async () => {
  await open();
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  fireEvent.click(
    screen.getByRole("button", { name: "Offer a new quote version" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lock workspace" }));
  await act(async () => resolve(reply({ ...doc, version: 3 })));
  assert.ok(screen.getByLabelText("Staff access code"));
  assert.equal(screen.queryByText(doc.id), null);
  assert.equal(calls.filter((x) => x.url.endsWith("/summary")).length, 1);
  assert.equal(screen.getByLabelText("Staff access code").value, "");
});
for (const phase of ["login", "open", "action", "overview"])
  for (const event of ["lock", "popstate", "pagehide", "pageshow", "unmount"])
    test("late " + phase + " isolated after " + event, async () => {
      let resolve;
      if (phase === "login") {
        handler = () => new Promise((r) => (resolve = r));
        render(React.createElement(Staff));
        login();
      } else if (phase === "open") {
        await workspace();
        handler = () => new Promise((r) => (resolve = r));
        fireEvent.change(screen.getByLabelText("Record reference"), {
          target: { value: doc.id },
        });
        fireEvent.click(screen.getByRole("button", { name: "Open record" }));
      } else {
        await open();
        handler = (url) =>
          phase === "overview" && !url.endsWith("/summary")
            ? reply({ ...doc, version: 3 })
            : new Promise((r) => (resolve = r));
        fireEvent.click(
          screen.getByRole("button", { name: "Offer a new quote version" }),
        );
        if (phase === "overview") await waitFor(() => assert.ok(resolve));
      }
      if (event === "lock")
        fireEvent.click(screen.getByRole("button", { name: "Lock workspace" }));
      else if (event === "unmount") cleanup();
      else if (event === "pageshow")
        window.dispatchEvent(
          new window.PageTransitionEvent("pageshow", { persisted: true }),
        );
      else window.dispatchEvent(new window.Event(event));
      await act(async () =>
        resolve(
          reply(
            phase === "login" || phase === "overview"
              ? summary
              : { ...doc, version: 3 },
          ),
        ),
      );
      assert.equal(
        screen.queryByRole("heading", { name: "Needs a little attention." }),
        null,
      );
      assert.equal(screen.queryByText(doc.id), null);
    });
test("credential edit invalidates pending login and old failure", async () => {
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  render(React.createElement(Staff));
  login();
  fireEvent.change(screen.getByLabelText("Staff access code"), {
    target: { value: "new-staff" },
  });
  await act(async () => resolve(reply({}, 403)));
  assert.equal(screen.queryByRole("alert"), null);
  assert.equal(screen.getByLabelText("Staff access code").value, "new-staff");
});
test("record reference edit invalidates pending mutation and clears terms", async () => {
  await open();
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  fireEvent.click(
    screen.getByRole("button", { name: "Offer a new quote version" }),
  );
  fireEvent.change(screen.getByLabelText("Record reference"), {
    target: { value: "quo_next" },
  });
  await act(async () => resolve(reply({ ...doc, version: 3 })));
  assert.equal(
    screen.queryByRole("button", { name: "Offer a new quote version" }),
    null,
  );
  assert.equal(calls.filter((x) => x.url.endsWith("/summary")).length, 1);
  assert.equal(screen.queryByRole("status"), null);
});
test("new staff session unaffected by old response or finally", async () => {
  await open();
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  fireEvent.click(
    screen.getByRole("button", { name: "Offer a new quote version" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lock workspace" }));
  handler = null;
  login();
  await screen.findByRole("heading", { name: "Needs a little attention." });
  await act(async () => resolve(reply({}, 409)));
  assert.equal(screen.queryByRole("alert"), null);
  assert.equal(screen.queryByText(doc.id), null);
  assert.equal(calls.length, 4);
});
test("duplicate action blocked and exact captured staff/body retained", async () => {
  await open();
  let resolve;
  handler = (url, opts) => {
    assert.deepEqual(JSON.parse(opts.body), {
      version: 2,
      total_minor: 1234,
      message: "Synthetic reviewed terms",
    });
    assert.equal(opts.headers.Authorization, "Bearer synthetic-staff");
    return new Promise((r) => (resolve = r));
  };
  const b = screen.getByRole("button", { name: "Offer a new quote version" });
  fireEvent.click(b);
  fireEvent.click(b);
  assert.equal(calls.length, 3);
  fireEvent.click(screen.getByRole("button", { name: "Lock workspace" }));
  await act(async () => resolve(reply({ ...doc, version: 3 })));
});
test("confirmed write followed by summary failure stays honestly confirmed", async () => {
  await open();
  handler = (url) =>
    url.endsWith("/summary") ? reply({}, 503) : reply({ ...doc, version: 3 });
  fireEvent.click(
    screen.getByRole("button", { name: "Offer a new quote version" }),
  );
  await screen.findByRole("alert");
  assert.match(screen.getByRole("status").textContent, /confirmed this action/);
  assert.match(screen.getByRole("alert").textContent, /Do not repeat/);
  assert.equal(calls.filter((x) => x.url.endsWith("/offer")).length, 1);
});
test("mismatched action record is unconfirmed and never triggers summary", async () => {
  await open();
  handler = () => reply({ ...doc, id: "other" });
  fireEvent.click(
    screen.getByRole("button", { name: "Offer a new quote version" }),
  );
  await screen.findByRole("alert");
  assert.equal(screen.queryByRole("status"), null);
  assert.equal(calls.filter((x) => x.url.endsWith("/summary")).length, 1);
});
test("new record clears proof shipment and readiness drafts", async () => {
  doc = {
    ...doc,
    id: "ord_first",
    kind: "order",
    status: "in_production",
    proof_status: "approved",
    payment_status: "paid",
  };
  await open();
  fireEvent.change(screen.getByLabelText("Exact proof text / layout details"), {
    target: { value: "Old proof" },
  });
  fireEvent.change(screen.getByLabelText("Carrier / delivery method"), {
    target: { value: "Old carrier" },
  });
  fireEvent.change(screen.getByLabelText("Tracking reference"), {
    target: { value: "Old tracking" },
  });
  for (const c of screen.getAllByRole("checkbox")) fireEvent.click(c);
  doc = { ...doc, id: "ord_next" };
  fireEvent.change(screen.getByLabelText("Record reference"), {
    target: { value: doc.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "Open record" }));
  await screen.findByText(doc.id);
  assert.equal(
    screen.getByLabelText("Exact proof text / layout details").value,
    "",
  );
  assert.equal(screen.getByLabelText("Carrier / delivery method").value, "");
  assert.equal(screen.getByLabelText("Tracking reference").value, "");
  assert.ok(screen.getAllByRole("checkbox").every((c) => !c.checked));
});
test("valid new order receipt clears on record edit and Lock", async () => {
  doc.status = "accepted";
  await open();
  handler = (url) =>
    url.endsWith("/summary")
      ? reply(summary)
      : reply({
          id: "ord_new",
          status: "awaiting_payment",
          access_token: "synthetic-private-receipt",
        });
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare order from accepted version" }),
  );
  await screen.findByRole("button", { name: "Download receipt" });
  assert.ok(!document.body.textContent.includes("synthetic-private-receipt"));
  fireEvent.change(screen.getByLabelText("Record reference"), {
    target: { value: "quo_next" },
  });
  assert.equal(
    screen.queryByRole("button", { name: "Download receipt" }),
    null,
  );
  fireEvent.click(screen.getByRole("button", { name: "Lock workspace" }));
  assert.equal(screen.getByLabelText("Staff access code").value, "");
});
test("ordinary pageshow preserves credential entry", () => {
  render(React.createElement(Staff));
  fireEvent.change(screen.getByLabelText("Staff access code"), {
    target: { value: "synthetic" },
  });
  window.dispatchEvent(
    new window.PageTransitionEvent("pageshow", { persisted: false }),
  );
  assert.equal(screen.getByLabelText("Staff access code").value, "synthetic");
});

for (const patch of [
  { total_minor: "1234" },
  { message: { bad: true } },
  { version: true },
  { items: [{ product_slug: "x", quantity: 1, text: { bad: true } }] },
])
  test(
    "malformed record does not gain action authority " + JSON.stringify(patch),
    async () => {
      Object.assign(doc, patch);
      await workspace();
      fireEvent.change(screen.getByLabelText("Record reference"), {
        target: { value: doc.id },
      });
      fireEvent.click(screen.getByRole("button", { name: "Open record" }));
      await screen.findByRole("alert");
      assert.equal(
        screen.queryByRole("button", { name: "Offer a new quote version" }),
        null,
      );
    },
  );
test("late new-record receipt after Lock is discarded without summary", async () => {
  doc.status = "accepted";
  await open();
  let resolve;
  handler = () => new Promise((r) => (resolve = r));
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare order from accepted version" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lock workspace" }));
  await act(async () =>
    resolve(
      reply({
        id: "ord_new",
        status: "awaiting_payment",
        access_token: "synthetic-secret",
      }),
    ),
  );
  assert.equal(
    screen.queryByRole("button", { name: "Download receipt" }),
    null,
  );
  assert.equal(calls.filter((x) => x.url.endsWith("/summary")).length, 1);
  assert.ok(!document.body.textContent.includes("synthetic-secret"));
});

test("real Inquiry nullable date and quantity remain readable",async()=>{doc.date=null;doc.quantity=null;await open();assert.ok(screen.getByRole("button",{name:"Offer a new quote version"}));});
