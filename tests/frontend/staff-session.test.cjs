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
  assert.equal(screen.queryByText(doc.id) === null, true);
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
        screen.queryByRole("heading", { name: "Needs a little attention." }) === null,
        true,
      );
      assert.equal(screen.queryByText(doc.id) === null, true);
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
  assert.equal(screen.queryByRole("alert") === null, true);
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
    screen.queryByRole("button", { name: "Offer a new quote version" }) === null,
    true,
  );
  assert.equal(calls.filter((x) => x.url.endsWith("/summary")).length, 1);
  assert.equal(screen.queryByRole("status") === null, true);
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
  assert.equal(screen.queryByRole("alert") === null, true);
  assert.equal(screen.queryByText(doc.id) === null, true);
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
  assert.equal(screen.queryByRole("status") === null, true);
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
    screen.queryByRole("button", { name: "Download receipt" }) === null,
    true,
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
        screen.queryByRole("button", { name: "Offer a new quote version" }) === null,
        true,
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
    screen.queryByRole("button", { name: "Download receipt" }) === null,
    true,
  );
  assert.equal(calls.filter((x) => x.url.endsWith("/summary")).length, 1);
  assert.ok(!document.body.textContent.includes("synthetic-secret"));
});

test("real Inquiry nullable date and quantity remain readable",async()=>{doc.date=null;doc.quantity=null;await open();assert.ok(screen.getByRole("button",{name:"Offer a new quote version"}));});


const PieceDisplay = require("../../apps/storefront/src/components/RecordedPersonalization.tsx");
function pieceOrder({ mode = "per_piece", quantity = 2, count = 2, lines = 1 } = {}) {
  const items = [], priced = [];
  for (let line = 0; line < lines; line++) {
    const pieces = Array.from({ length: quantity * count }, (_, n) => ({
      set_index: Math.floor(n / count), piece_index: n % count,
      text: mode === "identical" ? "  José 🌵  " : "Line " + line + " name " + n,
    }));
    const item = { product_slug: "makertwist-40oz-tumbler", quantity, text: "", secondary: "",
      font: "Classic serif", options: {},
      personalization: mode === "identical" ? { mode, text: "  José 🌵  " } :
        { mode, pieces: [...pieces].reverse() } };
    items.push(item);
    priced.push({ item: structuredClone(item), stock_units: quantity * 7,
      personalization_snapshot: { schema_version: 1, mode, line_index: line,
        quantity, pieces_per_item: count, pieces } });
  }
  return { id: "ord_mapping", kind: "order", status: "awaiting_payment", version: 1,
    payment_status: "unpaid", proof_status: "awaiting_proof", items, lines: priced };
}
test("recorded mapping separates same-SKU lines and normalizes arbitrary input order", () => {
  const value = pieceOrder({ lines: 2 });
  const parsed = PieceDisplay.recordedPersonalization(value);
  assert.equal(parsed.rows.length, 8);
  assert.deepEqual(parsed.rows.map(p => [p.line,p.set,p.piece]), [
    [0,0,0],[0,0,1],[0,1,0],[0,1,1],[1,0,0],[1,0,1],[1,1,0],[1,1,1],
  ]);
  assert.equal(parsed.rows[4].text, "Line 1 name 0");
  assert.equal(value.lines[0].stock_units, 14);
});
test("identical mapping retains all valid whitespace and Unicode code points", () => {
  const value = pieceOrder({ mode: "identical" });
  value.items[0].personalization.text = "🌵".repeat(120);
  value.lines[0].item = structuredClone(value.items[0]);
  for (const p of value.lines[0].personalization_snapshot.pieces) p.text = "🌵".repeat(120);
  assert.equal(PieceDisplay.recordedPersonalization(value).rows[0].text, "🌵".repeat(120));
  assert.equal(PieceDisplay.recordedPersonalization(pieceOrder({mode:"identical"})).rows[0].text, "  José 🌵  ");
});
test("exact 500-per-line and 2000-order mapping bounds remain readable", () => {
  const parsed = PieceDisplay.recordedPersonalization(pieceOrder({quantity:5,count:100,lines:4}));
  assert.equal(parsed.rows.length, 2000);
  assert.equal(parsed.rows[1999].piece, 99);
});
const badMappings = [
  ["missing snapshot", v => delete v.lines[0].personalization_snapshot],
  ["explicit null", v => v.items[0].personalization = null],
  ["unknown snapshot field", v => v.lines[0].personalization_snapshot.extra = true],
  ["boolean schema", v => v.lines[0].personalization_snapshot.schema_version = true],
  ["string schema", v => v.lines[0].personalization_snapshot.schema_version = "1"],
  ["wrong line", v => v.lines[0].personalization_snapshot.line_index = 1],
  ["boolean line", v => v.lines[0].personalization_snapshot.line_index = false],
  ["wrong quantity", v => v.lines[0].personalization_snapshot.quantity = 1],
  ["boolean count", v => v.lines[0].personalization_snapshot.pieces_per_item = true],
  ["string count", v => v.lines[0].personalization_snapshot.pieces_per_item = "2"],
  ["zero count", v => v.lines[0].personalization_snapshot.pieces_per_item = 0],
  ["large count", v => v.lines[0].personalization_snapshot.pieces_per_item = 101],
  ["missing piece", v => v.lines[0].personalization_snapshot.pieces.pop()],
  ["duplicate piece", v => v.lines[0].personalization_snapshot.pieces[1] = {...v.lines[0].personalization_snapshot.pieces[0]}],
  ["unsorted snapshot", v => v.lines[0].personalization_snapshot.pieces.reverse()],
  ["wrong text", v => v.lines[0].personalization_snapshot.pieces[0].text = "Different"],
  ["wrong item identity", v => v.lines[0].item.product_slug = "other-product"],
  ["wrong item quantity", v => v.lines[0].item.quantity = 1],
  ["wrong item assignment", v => v.lines[0].item.personalization.pieces[0].text = "Different"],
  ["competing inscription", v => v.items[0].text = "Other"],
  ["competing secondary", v => v.items[0].secondary = "Other"],
  ["competing option", v => v.items[0].options.Name = "Other"],
  ["too many lines", v => v.items = Array(101).fill(v.items[0])],
  ["missing lines", v => delete v.lines],
  ["extra line", v => v.lines.push(structuredClone(v.lines[0]))],
  ["control inscription", v => v.lines[0].personalization_snapshot.pieces[0].text = "Bad\u0085text"],
  ["surrogate inscription", v => v.lines[0].personalization_snapshot.pieces[0].text = "\ud800"],
  ["overlong inscription", v => v.lines[0].personalization_snapshot.pieces[0].text = "🌵".repeat(121)],
  ["out-of-range set", v => v.lines[0].personalization_snapshot.pieces[0].set_index = 499],
  ["boolean piece index", v => v.lines[0].personalization_snapshot.pieces[0].piece_index = false],
];
for (const [name, mutate] of badMappings) test("recorded mapping fails closed: " + name, () => {
  const value = pieceOrder(); mutate(value);
  assert.throws(() => PieceDisplay.recordedPersonalization(value), /reconciliation/);
});
test("mapping rejects too many pieces at line and order boundaries", () => {
  assert.throws(() => PieceDisplay.recordedPersonalization(pieceOrder({quantity:167,count:3})), /reconciliation/);
  assert.throws(() => PieceDisplay.recordedPersonalization(pieceOrder({quantity:5,count:100,lines:5})), /reconciliation/);
});
test("legacy allocation stays explicitly absent and hidden fields never render", () => {
  const value = {items:[{product_slug:"pet-tags",quantity:1,text:"Old engraving",secondary:"Back text",
    font:"Modern sans",options:{"Surface":"Wood"},notes:"PRIVATE_NOTES",internal_cost:"PRIVATE_COST"}]};
  render(React.createElement(PieceDisplay.default,{record:value}));
  assert.ok(screen.getByText(/Legacy configuration/));
  assert.ok(screen.getByText("Back text"));
  assert.ok(!document.body.textContent.includes("PRIVATE_NOTES"));
  assert.ok(!document.body.textContent.includes("PRIVATE_COST"));
  assert.ok(screen.queryByRole("list") === null);
});
test("orphan snapshot on legacy item fails rather than inventing allocation", () => {
  const value = pieceOrder(); delete value.items[0].personalization;
  assert.throws(() => PieceDisplay.recordedPersonalization(value), /reconciliation/);
});
test("recorded mapping pagination is bounded and resets on record replacement", async () => {
  const value = pieceOrder({quantity:30,count:1});
  const mounted = render(React.createElement(PieceDisplay.default,{record:value}));
  assert.equal(screen.getAllByRole("listitem").length,25);
  fireEvent.click(screen.getByRole("button",{name:"Next piece page"}));
  assert.equal(screen.getAllByRole("listitem").length,5);
  mounted.rerender(React.createElement(PieceDisplay.default,{record:pieceOrder()}));
  await waitFor(() => assert.ok(screen.getByText("Piece page 1 of 1")));
});
test("markup is escaped and format characters cannot forge piece labels", () => {
  const value = pieceOrder({mode:"identical"});
  const inscription = '<img src=x onerror=alert(1)>\u202e';
  value.items[0].personalization.text = inscription;
  value.lines[0].item = structuredClone(value.items[0]);
  for(const p of value.lines[0].personalization_snapshot.pieces) p.text = inscription;
  render(React.createElement(PieceDisplay.default,{record:value}));
  assert.ok(document.querySelector("img") === null);
  assert.ok(document.body.textContent.includes("\\u{202E}"));
});
test("malformed recorded mapping shows reconciliation without partial names", () => {
  const value = pieceOrder(); value.lines[0].personalization_snapshot.pieces[3].text = "Bad";
  render(React.createElement(PieceDisplay.default,{record:value}));
  assert.ok(screen.getByRole("alert").textContent.includes("could not be verified"));
  assert.ok(!document.body.textContent.includes("Line 0 name"));
});
test("staff order mapping disappears with Lock and does not persist", async () => {
  doc = pieceOrder();
  await open();
  assert.ok(screen.getByRole("region",{name:"Recorded personalization"}));
  assert.ok(screen.getByText("Line 0 name 0"));
  fireEvent.click(screen.getByRole("button",{name:"Lock workspace"}));
  assert.ok(screen.queryByRole("region",{name:"Recorded personalization"}) === null);
  assert.ok(screen.queryByText("Line 0 name 0") === null);
});

test("missing items cannot silently discard orphan normalized assignments", () => {
  const value = pieceOrder(); delete value.items;
  assert.throws(() => PieceDisplay.recordedPersonalization(value), /reconciliation/);
});
test("explicit null legacy fields in structured line item do not equal omission", () => {
  for (const key of ["text", "secondary", "font"]) {
    const value = pieceOrder(); value.lines[0].item[key] = null;
    assert.throws(() => PieceDisplay.recordedPersonalization(value), /reconciliation/);
  }
});

test("present malformed or oversized lines are not silently treated as legacy omission", () => {
  for (const lines of [null, {}, "invalid", Array(101).fill({})]) {
    assert.throws(() => PieceDisplay.recordedPersonalization({items:[],lines}), /reconciliation/);
  }
});

test("legacy multiline inscriptions and options remain readable without structured control restrictions", () => {
  const item = {product_slug:"fixture",quantity:1,text:"José\nsecond line",secondary:"🌵\r\nthird",font:"Classic serif",options:{"Label\nkey":"First\nSecond"}};
  const view = PieceDisplay.recordedPersonalization({items:[item]});
  assert.equal(view.legacy[0].text, item.text);
  assert.equal(view.legacy[0].secondary, item.secondary);
  assert.deepEqual(view.legacy[0].options, Object.entries(item.options));
  render(React.createElement(PieceDisplay.default,{record:{items:[item]}}));
  assert.ok(document.body.textContent.includes(item.text));
  assert.ok(document.body.textContent.includes(item.secondary));
  assert.ok(screen.queryByRole("alert") === null);
});
