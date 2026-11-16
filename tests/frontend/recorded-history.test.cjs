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

const History = require("../../apps/storefront/src/components/RecordedHistory.tsx");
test.afterEach(() => cleanup());
const at = "2030-01-02T03:04:05.123456-07:00";
function labels(record) {
  render(React.createElement(History.default, { record }));
  return [...document.querySelectorAll("li > div > bdi")].map(
    (e) => e.textContent,
  );
}
for (const code of [0, 0x202e, 0x2028, 0x2029, 0xe0001]) {
  test(
    "history distinguishes literal escape from control U+" + code.toString(16),
    () => {
      const escape = "\\u{" + code.toString(16).toUpperCase() + "}";
      const literal = "before" + escape + "after";
      const control = "before" + String.fromCodePoint(code) + "after";
      const record = {
        timeline: [
          { label: literal, at },
          { label: control, at },
        ],
      };
      const before = JSON.stringify(record);
      assert.deepEqual(labels(record), [
        "before\\" + escape + "after",
        literal,
      ]);
      assert.equal(JSON.stringify(record), before);
      assert.deepEqual(
        History.recordedHistory(record).entries,
        record.timeline,
      );
      assert.deepEqual(
        [...document.querySelectorAll("time")].map((e) =>
          e.getAttribute("datetime"),
        ),
        [at, at],
      );
    },
  );
}
test("history preserves slash runs, ordinary Unicode and multiline labels without markup", () => {
  const values = [
    "\\",
    "\\\\",
    "\\" + String.fromCodePoint(0x202e),
    "José 🌵\nnext\tcolumn\rreturn",
    "<script>not markup</script>&",
  ];
  const expected = ["\\\\", "\\\\\\\\", "\\\\\\u{202E}", values[3], values[4]];
  assert.deepEqual(
    labels({ timeline: values.map((label) => ({ label, at })) }),
    expected,
  );
  assert.equal(document.querySelectorAll("script").length, 0);
  assert.ok(
    document.body.textContent.includes(
      "Literal backslashes are doubled; formatting controls are shown as \\u{CODE}.",
    ),
  );
});
