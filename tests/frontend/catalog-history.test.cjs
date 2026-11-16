// DOM-level interaction checks. This does not launch a browser or claim device QA.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { JSDOM } = require("jsdom");
const dom = new JSDOM(
  '<!doctype html><html lang="en"><head><title>Storefront test</title></head><body><div id="test-root"></div></body></html>',
  { url: "https://review.example.test/" },
);
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLDialogElement",
  "Node",
  "MutationObserver",
  "localStorage",
  "sessionStorage",
  "location",
  "getComputedStyle",
]) {
  Object.defineProperty(global, key, {
    value:
      key === "getComputedStyle"
        ? dom.window.getComputedStyle.bind(dom.window)
        : dom.window[key],
    configurable: true,
    writable: true,
  });
}
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const React = require("react");
const originalLoad = Module._load,
  originalResolve = Module._resolveFilename;
Module._load = function (request, parent, main) {
  if (request === "next/link")
    return {
      __esModule: true,
      default: React.forwardRef(function Link(
        { href, children, prefetch, ...props },
        ref,
      ) {
        return React.createElement("a", { href, ref, ...props }, children);
      }),
    };
  if (request === "next/navigation")
    return {
      usePathname: () => location.pathname,
      useSearchParams: () => new URLSearchParams(location.search),
    };
  return originalLoad.apply(this, arguments);
};
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
  require.extensions[ext] = (mod, filename) =>
    mod._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      filename,
    );
const {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} = require("@testing-library/react");
const {
  StoreProvider,
} = require("../../apps/storefront/src/components/Store.tsx");
const CatalogSearch =
  require("../../apps/storefront/src/components/CatalogSearch.tsx").default;
const wrap = (props = {}) =>
  render(
    React.createElement(
      StoreProvider,
      null,
      React.createElement(CatalogSearch, props),
    ),
  );
test.afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/shop");
});

test("typed search persists encoded Unicode without adding history entries or dropping other URL state", async () => {
  window.history.replaceState(
    { fixture: "preserve" },
    "",
    "/shop?campaign=test#results",
  );
  wrap();
  await screen.findByRole("searchbox");
  const length = window.history.length;
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "José & 🌵 / gift" },
  });
  await waitFor(() =>
    assert.equal(
      new URLSearchParams(location.search).get("q"),
      "José & 🌵 / gift",
    ),
  );
  assert.equal(new URLSearchParams(location.search).get("campaign"), "test");
  assert.equal(location.hash, "#results");
  assert.equal(window.history.length, length);
  assert.equal(window.history.state.fixture, "preserve");
});

test("typed query and all selected controls survive unmount and restored catalog visit", async () => {
  const first = wrap();
  await screen.findByRole("searchbox");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "decanter" },
  });
  fireEvent.change(screen.getByLabelText("Material"), {
    target: { value: "Glass" },
  });
  fireEvent.change(screen.getByLabelText("Sort by"), {
    target: { value: "za" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Bar & glassware/ }));
  const before = location.href;
  first.unmount();
  wrap();
  await waitFor(() =>
    assert.equal(screen.getByRole("searchbox").value, "decanter"),
  );
  assert.equal(screen.getByLabelText("Material").value, "Glass");
  assert.equal(screen.getByLabelText("Sort by").value, "za");
  assert.equal(location.href, before);
  assert.ok(screen.getByText(/2 thoughtful gifts/));
});

test("external navigation query changes restore all fields instead of merging old state", async () => {
  window.history.replaceState(
    {},
    "",
    "/shop?q=decanter&material=Glass&sort=za",
  );
  const view = wrap();
  await waitFor(() =>
    assert.equal(screen.getByRole("searchbox").value, "decanter"),
  );
  window.history.replaceState({}, "", "/shop?q=tumbler");
  view.rerender(
    React.createElement(
      StoreProvider,
      null,
      React.createElement(CatalogSearch),
    ),
  );
  await waitFor(() =>
    assert.equal(screen.getByRole("searchbox").value, "tumbler"),
  );
  assert.equal(screen.getByLabelText("Material").value, "All materials");
  assert.equal(screen.getByLabelText("Sort by").value, "featured");
});

test("unknown URL filter values fail to safe defaults and cannot become object properties", async () => {
  window.history.replaceState(
    {},
    "",
    "/shop?category=__proto__&occasion=constructor&material=toString&sort=evil",
  );
  wrap();
  await waitFor(() =>
    assert.equal(screen.getByLabelText("Material").value, "All materials"),
  );
  assert.equal(screen.getByLabelText("Occasion").value, "All occasions");
  assert.equal(screen.getByLabelText("Sort by").value, "featured");
  assert.ok(screen.getByText("41 thoughtful gifts"));
});

test("reset removes selected filter parameters while preserving unrelated query, fragment and sort", async () => {
  window.history.replaceState(
    {},
    "",
    "/shop?campaign=test&q=missing&material=Wood&sort=az#results",
  );
  wrap();
  await screen.findByText("No gifts found, just yet.");
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => assert.equal(screen.getByRole("searchbox").value, ""));
  const p = new URLSearchParams(location.search);
  assert.equal(p.has("q"), false);
  assert.equal(p.has("material"), false);
  assert.equal(p.get("sort"), "az");
  assert.equal(p.get("campaign"), "test");
  assert.equal(location.hash, "#results");
});

test("category routes retain explicit All gifts override across reload", async () => {
  window.history.replaceState({}, "", "/shop/photo-crystals");
  const view = wrap({ category: "photo-crystals" });
  await screen.findByRole("searchbox");
  fireEvent.click(screen.getByRole("button", { name: /All gifts/ }));
  await waitFor(() =>
    assert.equal(new URLSearchParams(location.search).get("category"), ""),
  );
  view.unmount();
  wrap({ category: "photo-crystals" });
  await waitFor(() => assert.ok(screen.getByText("41 thoughtful gifts")));
});
