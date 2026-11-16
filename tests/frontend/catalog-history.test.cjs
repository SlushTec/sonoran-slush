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
let navigationQuery;
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
      useSearchParams: () =>
        new URLSearchParams(navigationQuery ?? location.search),
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
  navigationQuery = undefined;
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

test("delayed initial navigation effect cannot erase a newer typed query", async () => {
  window.history.replaceState({}, "", "/shop?campaign=test");
  navigationQuery = "";
  wrap();
  await screen.findByRole("searchbox");
  navigationQuery = "campaign=test";
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "d" } });
  await waitFor(() => assert.equal(screen.getByRole("searchbox").value, "d"));
  assert.equal(new URLSearchParams(location.search).get("q"), "d");
});

test("category buttons expose exactly one pressed choice through selection and reset", async () => {
  wrap();
  const selected = () => screen.getAllByRole("button", { pressed: true });
  await waitFor(() => assert.equal(selected().length, 1));
  assert.match(selected()[0].textContent, /All gifts/);
  fireEvent.click(screen.getByRole("button", { name: /Bar & glassware/ }));
  assert.equal(selected().length, 1);
  assert.match(selected()[0].textContent, /Bar & glassware/);
  assert.equal(screen.getByRole("button", { name: /All gifts/ }).getAttribute("aria-pressed"), "false");
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  assert.equal(selected().length, 1);
  assert.match(selected()[0].textContent, /All gifts/);
});

test("pressed category follows restored URL and category-route reset", async () => {
  window.history.replaceState({}, "", "/shop/photo-crystals?category=glassware-bar");
  const view = wrap({ category: "photo-crystals" });
  await waitFor(() => assert.match(screen.getByRole("button", { pressed: true }).textContent, /Bar & glassware/));
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  assert.match(screen.getByRole("button", { pressed: true }).textContent, /Photo crystals/);
  view.unmount();
  wrap({ category: "photo-crystals" });
  await waitFor(() => assert.match(screen.getByRole("button", { pressed: true }).textContent, /Photo crystals/));
});

for (const action of ["Clear search", "Reset filters", "Clear filters"]) {
  test(action + " returns focus to search after removing the recovery control", async () => {
    window.history.replaceState({}, "", "/shop?q=zznomatch&campaign=test&sort=za#results");
    wrap();
    await screen.findByText("No gifts found, just yet.");
    const button = screen.getByRole("button", { name: action });
    button.focus();
    assert.equal(document.activeElement, button);
    fireEvent.click(button);
    await waitFor(() => assert.equal(screen.getByRole("searchbox").value, ""));
    assert.ok(document.activeElement === screen.getByRole("searchbox"), "search retains focus");
    assert.equal(new URLSearchParams(location.search).has("q"), false);
    assert.equal(new URLSearchParams(location.search).get("sort"), "za");
    assert.equal(new URLSearchParams(location.search).get("campaign"), "test");
    assert.equal(location.hash, "#results");
  });
}

test("single-word typo offers an explicit eligible recovery without changing filters or history", async () => {
  window.history.replaceState({fixture:"preserve"}, "", "/shop?category=drinkware&q=tumblre&sort=za&campaign=test#results");
  wrap();
  await screen.findByText("No gifts found, just yet.");
  assert.equal(screen.getByRole("searchbox").value, "tumblre");
  const length = window.history.length;
  const suggestion = screen.getByRole("button", {name:"Search for tumbler",exact:true});
  suggestion.focus();
  fireEvent.click(suggestion);
  assert.equal(screen.getByRole("searchbox").value, "tumbler");
  assert.ok(document.activeElement === screen.getByRole("searchbox"), "recovery keeps typing focus");
  assert.ok(!screen.queryByText("No gifts found, just yet."));
  assert.equal(new URLSearchParams(location.search).get("category"), "drinkware");
  assert.equal(new URLSearchParams(location.search).get("sort"), "za");
  assert.equal(new URLSearchParams(location.search).get("campaign"), "test");
  assert.equal(location.hash, "#results");
  assert.equal(window.history.length, length);
  assert.equal(window.history.state.fixture, "preserve");
});

test("typo recovery never suggests products outside selected filters", async () => {
  window.history.replaceState({}, "", "/shop?category=photo-crystals&material=Wood&q=tumblre");
  wrap();
  await screen.findByText("No gifts found, just yet.");
  assert.equal(screen.queryAllByRole("button", {name:/^Search for /}).length, 0);
  assert.equal(screen.getByRole("searchbox").value, "tumblre");
});

test("search hints cover one edit and adjacent swaps with bounded deterministic vocabulary", () => {
  const { suggestSearchTerms } = require("../../apps/storefront/src/lib/search-recovery.ts");
  for (const query of ["tumblre", "tumblr", "tumblerr", "tumblerx", "xumbler", "TUMBLRE "]) {
    assert.deepEqual(suggestSearchTerms(query, ["A Tumbler", "Tumbler"]), ["tumbler"], query);
  }
  for (const query of ["tumbler", "tu", "blue tumbler", "tumzzler", "", "🌵", "éclair", "a".repeat(33)]) {
    assert.deepEqual(suggestSearchTerms(query, ["Tumbler"]), [], query);
  }
  assert.deepEqual(suggestSearchTerms("tumbler", ["TUMBLER"]), []);
  assert.deepEqual(suggestSearchTerms("carts", ["parts darts carts tarts carts marts"]), ["darts", "marts", "parts"]);
  assert.deepEqual(suggestSearchTerms("tumblre", []), []);
});
