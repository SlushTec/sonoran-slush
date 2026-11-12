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

test("Python inscription whitespace parity preserves BOM rather than JavaScript trim", () => {
  const accepted = [" \uFEFF ", "\u200B", " é 🌵 "];
  for (const text of accepted) {
    const value = pieceOrder({mode:"identical"});
    value.items[0].personalization.text = text;
    value.lines[0].item = structuredClone(value.items[0]);
    for (const piece of value.lines[0].personalization_snapshot.pieces) piece.text = text;
    assert.equal(PieceDisplay.recordedPersonalization(value).rows[0].text, text);
  }
  const value = pieceOrder({mode:"identical"});
  value.items[0].personalization.text = " \uFEFF ";
  value.lines[0].item = structuredClone(value.items[0]);
  for (const piece of value.lines[0].personalization_snapshot.pieces) piece.text = " \uFEFF ";
  render(React.createElement(PieceDisplay.default,{record:value}));
  assert.ok(document.body.textContent.includes("\\u{FEFF}"));
  assert.ok(document.body.textContent.includes("do not engrave these display codes"));
});

const HistoryDisplay = require("../../apps/storefront/src/components/RecordedHistory.tsx");
const historyEntry = (label="Recorded fixture",at="2030-01-01T12:34:56.123456+00:00")=>({label,at});
test("staff history preserves original order, duplicates and exact timestamp without unknown fields",()=>{
 const entries=[historyEntry("Later","2030-01-02T00:00:00+00:00"),historyEntry("Earlier"),historyEntry("Earlier")];
 const result=HistoryDisplay.recordedHistory({timeline:entries.map(x=>({...x,secret:"not rendered"}))});
 assert.deepEqual(result,{kind:"recorded",entries});
});
test("staff history distinguishes legacy absence from empty",()=>{
 assert.equal(HistoryDisplay.recordedHistory({}).kind,"absent");
 assert.equal(HistoryDisplay.recordedHistory({timeline:[]}).kind,"recorded");
 render(React.createElement(HistoryDisplay.default,{record:{}}));
 assert.ok(screen.getByText(/No history field/));
 cleanup();
 render(React.createElement(HistoryDisplay.default,{record:{timeline:[]}}));
 assert.ok(screen.getByText(/recorded history is empty/));
});
for(const at of ["2030-02-30T00:00:00Z","1900-02-29T00:00:00Z","2030-04-31T00:00:00Z","0000-01-01T00:00:00Z","2030-00-01T00:00:00Z","2030-13-01T00:00:00Z","2030-01-00T00:00:00Z","2030-01-01T24:00:00Z","2030-01-01T00:60:00Z","2030-01-01T00:00:60Z","2030-01-01T00:00:00+24:00","2030-01-01T00:00:00+00:60","2030-01-01T00:00:00","2030-01-01","1234",null,true,1,"2030-01-01T00:00:00.1234567Z"]) {
 test("history rejects invalid timestamp "+String(at),()=>assert.equal(HistoryDisplay.validHistoryTimestamp(at),false));
}
for(const at of ["2000-02-29T00:00:00Z","2028-02-29T23:59:59.123456-23:59","0001-01-01T00:00:00+00:00","9999-12-31T00:00:00+14:00"]) {
 test("history preserves valid exact timestamp "+at,()=>assert.equal(HistoryDisplay.recordedHistory({timeline:[historyEntry("Valid",at)]}).entries[0].at,at));
}
for(const timeline of [null,{},true,"bad",[null],[{}],[{label:"x",at:1}],[historyEntry("")],[historyEntry("a".repeat(501))],[historyEntry("\ud800")],Array(1001).fill(historyEntry())]) {
 test("history malformed bounded input rejects "+JSON.stringify(timeline).slice(0,50),()=>assert.throws(()=>HistoryDisplay.recordedHistory({timeline}),/reconciliation/));
}
test("history max boundaries and Unicode codepoints are preserved",()=>{
 const label="🌵".repeat(500);
 const result=HistoryDisplay.recordedHistory({timeline:Array(1000).fill(historyEntry(label))});
 assert.equal(result.entries.length,1000);assert.equal(result.entries[0].label,label);
});
test("history safely displays markup, multiline and format legend, no unknown secrets",()=>{
 const label="<img src=x>\nJosé 🌵\u202e";
 render(React.createElement(HistoryDisplay.default,{record:{timeline:[{...historyEntry(label),token:"hidden-capability"}]}}));
 assert.ok(document.querySelector("img")===null);
 assert.ok(document.body.textContent.includes("José 🌵"));
 assert.ok(document.body.textContent.includes("\\u{202E}"));
 assert.ok(!document.body.textContent.includes("hidden-capability"));
});
test("history pagination is bounded and resets on document change",async()=>{
 const mounted=render(React.createElement(HistoryDisplay.default,{record:{timeline:Array.from({length:51},(_,i)=>historyEntry("Event "+i))}}));
 assert.equal(screen.getAllByRole("listitem").length,25);
 fireEvent.click(screen.getByRole("button",{name:"Next history page"}));
 assert.ok(screen.getByText("Event 25"));
 fireEvent.click(screen.getByRole("button",{name:"Next history page"}));
 assert.equal(screen.getAllByRole("listitem").length,1);
 mounted.rerender(React.createElement(HistoryDisplay.default,{record:{timeline:[historyEntry("New record")]}}));
 await waitFor(()=>assert.ok(screen.getByText("History page 1 of 1")));
});
test("malformed history never renders partial entries",()=>{
 render(React.createElement(HistoryDisplay.default,{record:{timeline:[historyEntry("partial-private"),historyEntry("bad","2030-02-30T00:00:00Z")]}}));
 assert.ok(screen.getByRole("alert"));
 assert.ok(!document.body.textContent.includes("partial-private"));
});
test("staff Lock clears recorded history",async()=>{
 doc={...doc,timeline:[historyEntry("Private recorded event")]}; await open();
 assert.ok(screen.getByText("Private recorded event"));
 fireEvent.click(screen.getByRole("button",{name:"Lock workspace"}));
 assert.ok(screen.queryByRole("region",{name:"Recorded history"})===null);
});


// Bounded SS-044.AC2 read-only fixture display; all earlier session tests unchanged.
const projectFixture =
  require("../../apps/storefront/src/components/FixtureAvailability.tsx").fixtureAvailability;
function availabilityFixture() {
  return {lot_id:"lot_test",component_id:"blank",unit:"piece",version:2,
    locations:[{location_id:"shop",condition_units:{available:10,damaged:3,sample:2,
      in_production:4,completed:5,shipped:6},reserved_units:2,free_units:8}],
    test_mode:true,checkout_authoritative:false};
}
const availabilityPath="/v1/admin/retail-test/component-ledger/lots/lot_test/availability";
async function availabilityWorkspace() {
  await workspace();
  await act(async () => {});
}
function requestAvailability(reference="lot_test") {
  fireEvent.change(screen.getByLabelText("Test lot reference"),{target:{value:reference}});
  fireEvent.submit(screen.getByLabelText("Test lot reference").closest("form"));
}
test("fixture availability uses a positive independent projection, not original metadata",()=>{
  const raw=availabilityFixture();
  raw.private={order_id:"PRIVATE"};raw.locations[0].private="PRIVATE";
  raw.locations[0].condition_units.__unused=0;
  assert.ok(projectFixture(raw,"lot_test")===null,"exact condition keys required");
  delete raw.locations[0].condition_units.__unused;
  const actual=projectFixture(raw,"lot_test");
  assert.deepEqual(actual,availabilityFixture());
  assert.notEqual(actual,raw);assert.notEqual(actual.locations,raw.locations);
  assert.notEqual(actual.locations[0].condition_units,raw.locations[0].condition_units);
  assert.equal(JSON.stringify(actual).includes("PRIVATE"),false);
  raw.locations[0].free_units=7;
  assert.equal(actual.locations[0].free_units,8,"projected state does not alias source");
});
for(const [name,damage] of [
  ["wrong lot",d=>d.lot_id="other"],["missing component",d=>delete d.component_id],
  ["unsafe component",d=>d.component_id="bad\n"],["wrong unit",d=>d.unit="crate"],
  ["bool version",d=>d.version=true],["negative version",d=>d.version=-1],
  ["unsafe version",d=>d.version=9007199254740992],["float version",d=>d.version=1.5],
  ["string version",d=>d.version="2"],["null locations",d=>d.locations=null],
  ["missing locations",d=>delete d.locations],["101 locations",d=>d.locations=Array(101).fill(d.locations[0])],
  ["duplicate location",d=>d.locations.push(structuredClone(d.locations[0]))],
  ["bad location",d=>d.locations[0].location_id="<script>"],
  ["null bucket",d=>d.locations[0]=null],["null conditions",d=>d.locations[0].condition_units=null],
  ["missing condition",d=>delete d.locations[0].condition_units.shipped],
  ["extra condition",d=>d.locations[0].condition_units.rejected=0],
  ["bool physical",d=>d.locations[0].condition_units.available=true],
  ["float damaged",d=>d.locations[0].condition_units.damaged=0.5],
  ["negative sample",d=>d.locations[0].condition_units.sample=-1],
  ["text production",d=>d.locations[0].condition_units.in_production="4"],
  ["oversized completed",d=>d.locations[0].condition_units.completed=1000001],
  ["nonfinite shipped",d=>d.locations[0].condition_units.shipped=Infinity],
  ["bool reserved",d=>d.locations[0].reserved_units=false],
  ["negative reserved",d=>d.locations[0].reserved_units=-1],
  ["missing free",d=>delete d.locations[0].free_units],
  ["arithmetic mismatch",d=>d.locations[0].free_units=9],
  ["reserved exceeds physical",d=>{d.locations[0].reserved_units=11;d.locations[0].free_units=0}],
  ["numeric test mode",d=>d.test_mode=1],["false test mode",d=>d.test_mode=false],
  ["string test mode",d=>d.test_mode="true"],["numeric authority",d=>d.checkout_authoritative=0],
  ["true authority",d=>d.checkout_authoritative=true],["missing authority",d=>delete d.checkout_authoritative],
]){
 test("fixture availability rejects "+name,()=>{
   const raw=availabilityFixture();damage(raw);
   assert.ok(projectFixture(raw,"lot_test")===null);
 });
}
for(const value of [null,[],1,"raw",true]){
 test("fixture availability rejects primitive "+JSON.stringify(value),()=>assert.ok(projectFixture(value,"lot_test")===null));
}
test("fixture limits accept exactly100 unique locations and version zero",()=>{
 const raw=availabilityFixture();raw.version=0;
 raw.locations=Array.from({length:100},(_,i)=>({...structuredClone(raw.locations[0]),location_id:"place_"+i}));
 assert.deepEqual(projectFixture(raw,"lot_test"),raw);
 raw.locations=[];assert.deepEqual(projectFixture(raw,"lot_test"),raw);
});
test("fixture display never fetches before staff verification or without explicit lookup",async()=>{
 render(React.createElement(Staff));
 assert.ok(screen.queryByLabelText("Test lot reference")===null);
 assert.equal(calls.length,0);
 login();await screen.findByLabelText("Test lot reference");
 assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith("/summary"));
});
test("fixture display renders exact escaped conditions, read-only scope and memory-only auth",async()=>{
 handler=(url)=>url.endsWith("/availability")?reply({...availabilityFixture(),private:"PRIVATE"}):null;
 await availabilityWorkspace();requestAvailability();
 await screen.findByLabelText("Verified test lot readout");
 assert.match(screen.getByLabelText("Verified test lot readout").textContent,/Free \(unreserved\)8/);
 assert.match(document.body.textContent,/Reserved \(active\)2/);
 assert.match(document.body.textContent,/Observed lot version 2/);
 assert.equal(document.body.textContent.includes("PRIVATE"),false);
 const call=calls.find(c=>c.url.endsWith("/availability"));
 assert.equal(call.url,"https://commerce.qa.invalid"+availabilityPath);
 assert.equal(call.opts.method,"GET");assert.equal(call.opts.body,undefined);
 assert.equal(call.opts.headers.Authorization,"Bearer synthetic-staff");
 assert.equal(new URL(call.url).search,"");assert.equal(new URL(call.url).hash,"");
 assert.equal(localStorage.length,0);
 assert.equal(calls.some(c=>c.opts.method!=="GET"),false);
});
test("fixture empty registered lot is different from missing and malformed state",async()=>{
 handler=url=>url.endsWith("/availability")?reply({...availabilityFixture(),locations:[]}):null;
 await availabilityWorkspace();requestAvailability();
 await screen.findByText("This registered test lot has no recorded locations or quantities.");
 handler=url=>url.endsWith("/availability")?reply({private:"PRIVATE"}):null;
 requestAvailability();
 await screen.findByText("The test availability response could not be verified. No quantities are shown.");
 assert.ok(screen.queryByLabelText("Verified test lot readout")===null);
 assert.equal(document.body.textContent.includes("PRIVATE"),false);
});
for(const [status,message]of [
 [401,"Staff access could not be verified. Lock the workspace and sign in again."],
 [403,"Staff access could not be verified. Lock the workspace and sign in again."],
 [404,"No registered test lot was found for that reference."],
 [409,"Test availability needs reconciliation. No quantities can be shown safely."],
 [503,"Test inventory is not available in this workspace. Normal work is unchanged."],
 [500,"Test availability could not be read. Try again; no stock was changed."],
]){
 test("fixture status "+status+" clears old data without echoing provider text",async()=>{
  handler=url=>url.endsWith("/availability")?reply(availabilityFixture()):null;
  await availabilityWorkspace();requestAvailability();await screen.findByLabelText("Verified test lot readout");
  handler=url=>url.endsWith("/availability")?reply({detail:"PRIVATE RAW ERROR"},status):null;
  fireEvent.submit(screen.getByLabelText("Test lot reference").closest("form"));
  assert.ok(screen.queryByLabelText("Verified test lot readout")===null);
  await screen.findByText(message);
  assert.equal(document.body.textContent.includes("PRIVATE"),false);
 });
}
test("fixture invalid reference never starts network read",async()=>{
 await availabilityWorkspace();requestAvailability("bad/reference");
 await screen.findByText("Use a test lot reference with 1–100 letters, numbers, hyphens or underscores.");
 assert.equal(calls.length,1);
});
test("fixture repeated pending submit is admitted once",async()=>{
 let release;
 handler=url=>url.endsWith("/availability")?new Promise(r=>release=r):null;
 await availabilityWorkspace();requestAvailability();
 const form=screen.getByLabelText("Test lot reference").closest("form");
 fireEvent.submit(form);fireEvent.submit(form);
 assert.equal(calls.filter(c=>c.url.endsWith("/availability")).length,1);
 await act(async()=>release(reply(availabilityFixture())));
 await screen.findByLabelText("Verified test lot readout");
});
for(const action of ["edit","clear","lock","back","pagehide","restore"]){
 test("fixture pending "+action+" cannot restore stale quantities or errors",async()=>{
  let release;
  handler=url=>url.endsWith("/availability")?new Promise(r=>release=r):null;
  await availabilityWorkspace();requestAvailability();
  if(action==="edit")fireEvent.change(screen.getByLabelText("Test lot reference"),{target:{value:"other"}});
  else if(action==="clear")fireEvent.click(screen.getByRole("button",{name:"Clear inventory view"}));
  else if(action==="lock")fireEvent.click(screen.getByRole("button",{name:"Lock workspace"}));
  else if(action==="back")act(()=>window.dispatchEvent(new window.PopStateEvent("popstate")));
  else if(action==="pagehide")act(()=>window.dispatchEvent(new window.Event("pagehide")));
  else act(()=>window.dispatchEvent(new window.PageTransitionEvent("pageshow",{persisted:true})));
  await act(async()=>release(reply(availabilityFixture())));
  assert.ok(screen.queryByLabelText("Verified test lot readout")===null);
  assert.equal(document.body.textContent.includes("Observed lot version"),false);
  if(["lock","back","pagehide","restore"].includes(action)){
    assert.ok(screen.queryByLabelText("Test lot reference")===null);
    assert.equal(screen.getByLabelText("Staff access code").value,"");
  }
 });
}
test("fixture newer lookup wins and an older error cannot replace it",async()=>{
 let old;handler=url=>{
  if(url.includes("/lots/lot_test/"))return new Promise(r=>old=r);
  if(url.includes("/lots/other/"))return reply({...availabilityFixture(),lot_id:"other"});
  return null;
 };
 await availabilityWorkspace();requestAvailability();requestAvailability("other");
 await screen.findByLabelText("Verified test lot readout");
 assert.match(document.body.textContent,/Test lot other/);
 await act(async()=>old(reply({detail:"PRIVATE"},409)));
 assert.match(document.body.textContent,/Test lot other/);
 assert.ok(screen.queryByText(/needs reconciliation/)===null);
 assert.equal(document.body.textContent.includes("PRIVATE"),false);
});
test("fixture generic transport failure shows a safe empty state",async()=>{
 handler=url=>{if(url.endsWith("/availability"))throw Error("PRIVATE");return null;};
 await availabilityWorkspace();requestAvailability();
 await screen.findByText("Test availability could not be read. Try again; no stock was changed.");
 assert.ok(screen.queryByLabelText("Verified test lot readout")===null);
 assert.equal(document.body.textContent.includes("PRIVATE"),false);
});

test("fixture exact condition keys cannot come from inherited properties",()=>{
 const raw=availabilityFixture(),source=raw.locations[0].condition_units;
 raw.locations[0].condition_units=Object.assign(Object.create(source),
   {one:0,two:0,three:0,four:0,five:0,six:0});
 assert.ok(projectFixture(raw,"lot_test")===null);
});
test("fixture old session result cannot overwrite a new verified session",async()=>{
 let old;handler=url=>{
  if(url.includes("/lots/lot_test/"))return new Promise(r=>old=r);
  if(url.includes("/lots/other/"))return reply({...availabilityFixture(),lot_id:"other"});
  return null;
 };
 await availabilityWorkspace();requestAvailability();
 fireEvent.click(screen.getByRole("button",{name:"Lock workspace"}));
 login();await screen.findByLabelText("Test lot reference");await act(async()=>{});requestAvailability("other");
 await screen.findByLabelText("Verified test lot readout");
 await act(async()=>old(reply(availabilityFixture())));
 assert.match(document.body.textContent,/Test lot other/);
 assert.equal(document.body.textContent.includes("Test lot lot_test"),false);
 assert.equal(localStorage.length,0);
});
