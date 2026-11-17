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

const priceLabel = "Final reviewed total (USD)";
const detailsLabel = "Quote details, inclusions & applicable terms";
for (const amount of [
  "0",
  "0.00",
  "1000000",
  "999999.999",
  "90071992547409.92",
  "9".repeat(400),
]) {
  test(
    "invalid quote total stays editable with no request: " +
      amount.slice(0, 30),
    async () => {
      await open();
      fireEvent.change(screen.getByLabelText(priceLabel), {
        target: { value: amount },
      });
      fireEvent.change(screen.getByLabelText(detailsLabel), {
        target: { value: "Reviewed synthetic quote terms" },
      });
      const before = calls.length;
      fireEvent.click(
        screen.getByRole("button", { name: "Offer a new quote version" }),
      );
      assert.equal(calls.length, before);
      assert.equal(screen.getByLabelText(priceLabel).value, amount);
      assert.equal(
        screen.getByLabelText(detailsLabel).value,
        "Reviewed synthetic quote terms",
      );
      assert.ok(screen.getByText(doc.id));
      assert.ok(
        screen.getByRole("alert").textContent.includes("reviewed USD total"),
      );
    },
  );
}
for (const [amount, minor] of [
  ["0.01", 1],
  ["999999.99", 99999999],
  ["12.34", 1234],
  ["00012.3", 1230],
]) {
  test("valid quote boundary sends exact cents: " + amount, async () => {
    await open();
    fireEvent.change(screen.getByLabelText(priceLabel), {
      target: { value: amount },
    });
    handler = (url, opts) =>
      url.endsWith("/offer")
        ? reply({ ...doc, version: doc.version + 1, total_minor: minor })
        : null;
    fireEvent.click(
      screen.getByRole("button", { name: "Offer a new quote version" }),
    );
    await screen.findByText(
      "The service confirmed this action. Payment and production gates remain separate.",
    );
    const offers = calls.filter((c) => c.url.endsWith("/offer"));
    assert.equal(offers.length, 1);
    assert.equal(JSON.parse(offers[0].opts.body).total_minor, minor);
  });
}
test("operator can correct rejected total without reopening or losing terms", async () => {
  await open();
  const details = screen.getByLabelText(detailsLabel).value;
  fireEvent.change(screen.getByLabelText(priceLabel), {
    target: { value: "0" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Offer a new quote version" }),
  );
  assert.equal(calls.filter((c) => c.url.endsWith("/offer")).length, 0);
  fireEvent.change(screen.getByLabelText(priceLabel), {
    target: { value: "42.05" },
  });
  handler = (url) =>
    url.endsWith("/offer")
      ? reply({ ...doc, version: doc.version + 1, total_minor: 4205 })
      : null;
  fireEvent.click(
    screen.getByRole("button", { name: "Offer a new quote version" }),
  );
  await screen.findByText(
    "The service confirmed this action. Payment and production gates remain separate.",
  );
  const offers = calls.filter((c) => c.url.endsWith("/offer"));
  assert.equal(offers.length, 1);
  assert.deepEqual(JSON.parse(offers[0].opts.body), {
    version: 2,
    total_minor: 4205,
    message: details,
  });
  assert.equal(calls.filter((c) => c.url.includes("/records/")).length, 1);
});
