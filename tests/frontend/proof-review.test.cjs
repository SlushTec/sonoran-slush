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
  require("../../apps/storefront/src/components/ProofReviewPortal.tsx").default;
const stamp = "2026-11-11T12:00:00+00:00",
  hash = "a".repeat(64);
const makeProof = (id = "prf_test", version = 2) => ({
  id,
  kind: "proof",
  order_id: "ord_test",
  version,
  status: "awaiting_approval",
  approved_version: null,
  proof_text: "Exact wording " + version,
  binding_schema: 1,
  context_hash: hash,
});
function makeDetail(p = makeProof(), version = p.version) {
  return {
    revision: {
      schema_version: 1,
      proof_id: p.id,
      order_id: p.order_id,
      version,
      proof_text: "Exact wording " + version,
      context_hash: hash,
      prepared_at: stamp,
      limitations:
        "Local text/configuration evidence only; no image/export, physical, identity or machine qualification.",
    },
    material_context: {
      order_id: p.order_id,
      items: [
        { product_slug: "synthetic", quantity: 1, text: "Test inscription" },
      ],
      lines: null,
      total_minor: 1000,
      currency: "USD",
    },
    decisions:
      p.status === "approved"
        ? [
            {
              schema_version: 1,
              proof_id: p.id,
              order_id: p.order_id,
              version,
              context_hash: hash,
              sequence: 1,
              action: "approve",
              comment: "",
              recorded_at: stamp,
              actor_scope: "holder of this private proof capability",
            },
          ]
        : [],
  };
}
const reply = (v, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let calls = [],
  p;
function mock(handler) {
  p = makeProof();
  calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (handler) {
      const r = await handler(url, opts);
      if (r) return r;
    }
    if (url.endsWith("/history/2")) return reply(makeDetail(p));
    if (url.endsWith("/history/1")) return reply(makeDetail(p, 1));
    if (url.includes("/history?"))
      return reply({
        proof_id: p.id,
        items: [
          { version: 1, context_hash: hash, prepared_at: stamp },
          { version: 2, context_hash: hash, prepared_at: stamp },
        ],
        next_cursor: null,
        legacy_history_unknown: false,
      });
    return reply(p);
  };
}
async function open() {
  render(React.createElement(Portal));
  fireEvent.change(screen.getByLabelText("Proof reference"), {
    target: { value: "prf_test" },
  });
  fireEvent.change(screen.getByLabelText("Private access code"), {
    target: { value: "synthetic-code" },
  });
  fireEvent.submit(document.querySelector("form"));
  await screen.findByRole("button", { name: "Approve version 2" });
}
test.beforeEach(() => {
  process.env.NEXT_PUBLIC_COMMERCE_API_URL = "https://commerce.qa.invalid";
  mock();
});
test.afterEach(() => {
  cleanup();
  localStorage.clear();
  delete process.env.NEXT_PUBLIC_COMMERCE_API_URL;
});
test("current exact evidence, private token and explicit version approval", async () => {
  mock((url, opts) => {
    if (url.endsWith("/approve")) {
      assert.deepEqual(JSON.parse(opts.body), {
        version: 2,
        decision: "approve",
        comment: "",
      });
      p = { ...p, status: "approved", approved_version: p.version };
      return reply(p);
    }
  });
  await open();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Approve version 2" }));
  await screen.findByRole("status");
  assert.equal(calls.filter((x) => x.url.endsWith("/approve")).length, 1);
  assert.ok(
    calls.every(
      (x) => x.opts.headers.Authorization === "Bearer synthetic-code",
    ),
  );
  assert.equal(localStorage.length, 0);
  assert.ok(!location.href.includes("synthetic-code"));
});
test("historical view is read only and returning current refetches", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Past versions" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "View version 1" }),
  );
  await screen.findByRole("heading", { name: "Historical proof (read only)" });
  await screen.findByText("Exact wording 1");
  assert.equal(screen.queryByRole("checkbox") === null, true);
  assert.equal(screen.queryByRole("button", { name: "Request changes" }) === null, true);
  fireEvent.click(
    screen.getByRole("button", { name: "Return to current proof" }),
  );
  await screen.findByRole("button", { name: "Approve version 2" });
  assert.equal(calls.filter((x) => x.url.endsWith("/prf_test")).length, 2);
});
for (const event of [
  "close",
  "credentials",
  "popstate",
  "pagehide",
  "pageshow",
  "unmount",
])
  test("late lookup cannot restore private state after " + event, async () => {
    let resolve;
    mock((url) =>
      url.endsWith("/prf_test") ? new Promise((r) => (resolve = r)) : undefined,
    );
    const r = render(React.createElement(Portal));
    fireEvent.change(screen.getByLabelText("Proof reference"), {
      target: { value: "prf_test" },
    });
    fireEvent.change(screen.getByLabelText("Private access code"), {
      target: { value: "synthetic-code" },
    });
    fireEvent.submit(document.querySelector("form"));
    await waitFor(() => assert.ok(resolve));
    if (event === "close")
      fireEvent.click(
        screen.getByRole("button", { name: "Close private record" }),
      );
    else if (event === "credentials")
      fireEvent.change(screen.getByLabelText("Private access code"), {
        target: { value: "changed-code" },
      });
    else if (event === "unmount") r.unmount();
    else {
      const ev = new window.Event(event);
      if (event === "pageshow")
        Object.defineProperty(ev, "persisted", { value: true });
      fireEvent(window, ev);
    }
    await act(async () => {
      resolve(reply(p));
      await Promise.resolve();
    });
    assert.equal(
      screen.queryByRole("heading", { name: "Current proof" }) === null,
      true,
    );
    assert.equal(calls.length, 1);
  });
for (const route of ["history", "detail", "action"])
  test("late " + route + " response ignored after Close", async () => {
    await open();
    let resolve;
    const original = global.fetch;
    global.fetch = (url, opts) => {
      if (
        (route === "history" && url.includes("/history?")) ||
        (route === "detail" && url.endsWith("/history/1")) ||
        (route === "action" && url.endsWith("/approve"))
      )
        return new Promise((r) => (resolve = r));
      return original(url, opts);
    };
    if (route === "history")
      fireEvent.click(screen.getByRole("button", { name: "Past versions" }));
    else if (route === "detail") {
      fireEvent.click(screen.getByRole("button", { name: "Past versions" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "View version 1" }),
      );
    } else {
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(
        screen.getByRole("button", { name: "Approve version 2" }),
      );
    }
    await waitFor(() => assert.ok(resolve));
    fireEvent.click(
      screen.getByRole("button", { name: "Close private record" }),
    );
    await act(async () =>
      resolve(
        reply(
          route === "action"
            ? { ...p, status: "approved" }
            : route === "detail"
              ? makeDetail(p, 1)
              : {
                  proof_id: p.id,
                  items: [],
                  next_cursor: null,
                  legacy_history_unknown: false,
                },
        ),
      ),
    );
    assert.equal(
      screen.queryByRole("heading", { name: /Current proof|Historical proof/ }) === null,
      true,
    );
    assert.equal(screen.queryByRole("status") === null, true);
    assert.equal(screen.getByLabelText("Private access code").value, "");
  });
test("legacy remains readable without approval", async () => {
  mock();
  delete p.binding_schema;
  delete p.context_hash;
  render(React.createElement(Portal));
  fireEvent.change(screen.getByLabelText("Proof reference"), {
    target: { value: "prf_test" },
  });
  fireEvent.change(screen.getByLabelText("Private access code"), {
    target: { value: "code" },
  });
  fireEvent.submit(document.querySelector("form"));
  await screen.findByText(/retained legacy proof/);
  assert.equal(screen.queryByRole("checkbox") === null, true);
  assert.equal(calls.length, 1);
});
for (const corruption of [
  "wrong_id",
  "wrong_version",
  "wrong_hash",
  "wrong_text",
  "bad_context",
  "bad_schema",
])
  test("malformed evidence denies approval " + corruption, async () => {
    mock((url) => {
      if (url.endsWith("/history/2")) {
        const d = makeDetail();
        if (corruption === "wrong_id") d.revision.proof_id = "other";
        if (corruption === "wrong_version") d.revision.version = 1;
        if (corruption === "wrong_hash")
          d.revision.context_hash = "b".repeat(64);
        if (corruption === "wrong_text") d.revision.proof_text = "changed";
        if (corruption === "bad_context") d.material_context.items = null;
        if (corruption === "bad_schema") d.revision.schema_version = true;
        return reply(d);
      }
    });
    render(React.createElement(Portal));
    fireEvent.change(screen.getByLabelText("Proof reference"), {
      target: { value: "prf_test" },
    });
    fireEvent.change(screen.getByLabelText("Private access code"), {
      target: { value: "code" },
    });
    fireEvent.submit(document.querySelector("form"));
    await screen.findByRole("alert");
    assert.equal(screen.queryByRole("checkbox") === null, true);
  });
test("409 action invalidates approval until refresh, duplicate click issues one mutation", async () => {
  mock((url) =>
    url.endsWith("/approve")
      ? reply({ detail: "Refresh current version" }, 409)
      : undefined,
  );
  await open();
  fireEvent.click(screen.getByRole("checkbox"));
  const button = screen.getByRole("button", { name: "Approve version 2" });
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByRole("alert");
  assert.equal(calls.filter((x) => x.url.endsWith("/approve")).length, 1);
  assert.equal(screen.queryByRole("checkbox") === null, true);
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh current proof" }),
  );
  await screen.findByRole("checkbox");
});
test("full supplementary Unicode names accepted and only 25 inscriptions rendered", async () => {
  mock((url) => {
    if (url.endsWith("/history/2")) {
      const d = makeDetail();
      d.material_context.lines = [
        {
          personalization_snapshot: {
            pieces: Array.from({ length: 50 }, (_, i) => ({
              set_index: i,
              piece_index: 0,
              text: "😀".repeat(120),
            })),
          },
        },
      ];
      return reply(d);
    }
  });
  await open();
  assert.equal(screen.getAllByText(/Item 1, set/).length, 25);
  fireEvent.click(screen.getByRole("button", { name: "Next inscriptions" }));
  assert.ok(screen.getByText(/set 50/));
});
test("history cursor pagination and retry stay bounded", async () => {
  let first = true;
  mock((url) => {
    if (url.includes("/history?")) {
      if (first) {
        first = false;
        return reply({ detail: "Try history again" }, 503);
      }
      const after = Number(new URL(url).searchParams.get("after"));
      return reply({
        proof_id: p.id,
        items: [{ version: after + 1, context_hash: hash, prepared_at: stamp }],
        next_cursor: after ? null : 1,
        legacy_history_unknown: false,
      });
    }
  });
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Past versions" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Past versions" }));
  await screen.findByRole("button", { name: "View version 1" });
  fireEvent.click(screen.getByRole("button", { name: "Next history page" }));
  await screen.findByRole("button", { name: "View version 2" });
  assert.ok(calls.some((x) => x.url.includes("after=1&limit=25")));
  fireEvent.click(
    screen.getByRole("button", { name: "Previous history page" }),
  );
  await screen.findByRole("button", { name: "View version 1" });
});
test("rendered proof text is never HTML", async () => {
  mock();
  p.proof_text = "<img src=x onerror=alert(1)>";
  global.fetch = async (url) =>
    reply(
      url.endsWith("/history/2")
        ? {
            ...makeDetail(p),
            revision: { ...makeDetail(p).revision, proof_text: p.proof_text },
          }
        : p,
    );
  await open();
  assert.equal(document.querySelectorAll(".proof-content img").length, 0);
  assert.ok(screen.getByText(p.proof_text));
});

test("secondary inscription and font are shown from real Item fields", async () => {
  mock((url) => {
    if (url.endsWith("/history/2")) {
      const d = makeDetail();
      d.material_context.items[0].secondary = "Second line matters";
      d.material_context.items[0].font = "Classic serif";
      return reply(d);
    }
  });
  await open();
  assert.ok(screen.getByText("Second line matters"));
  assert.ok(screen.getByText("Font: Classic serif"));
});
test("historical detail hash must match selected metadata", async () => {
  mock((url) => {
    if (url.endsWith("/history/1")) {
      const d = makeDetail(p, 1);
      d.revision.context_hash = "b".repeat(64);
      return reply(d);
    }
  });
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Past versions" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "View version 1" }),
  );
  await screen.findByRole("alert");
  assert.equal(screen.queryByText("Exact wording 1") === null, true);
  assert.equal(screen.queryByRole("checkbox") === null, true);
});
test("ordinary initial pageshow preserves entered credentials", async () => {
  render(React.createElement(Portal));
  fireEvent.change(screen.getByLabelText("Proof reference"), {
    target: { value: "prf_test" },
  });
  fireEvent.change(screen.getByLabelText("Private access code"), {
    target: { value: "code" },
  });
  fireEvent(window, new window.Event("pageshow"));
  assert.equal(screen.getByLabelText("Private access code").value, "code");
});
test("old failure cannot overwrite newly reopened valid session", async () => {
  let reject;
  mock((url) =>
    url.endsWith("/prf_test") ? new Promise((_, r) => (reject = r)) : undefined,
  );
  render(React.createElement(Portal));
  fireEvent.change(screen.getByLabelText("Proof reference"), {
    target: { value: "prf_test" },
  });
  fireEvent.change(screen.getByLabelText("Private access code"), {
    target: { value: "old-code" },
  });
  fireEvent.submit(document.querySelector("form"));
  await waitFor(() => assert.ok(reject));
  fireEvent.click(screen.getByRole("button", { name: "Close private record" }));
  mock();
  fireEvent.change(screen.getByLabelText("Proof reference"), {
    target: { value: "prf_test" },
  });
  fireEvent.change(screen.getByLabelText("Private access code"), {
    target: { value: "new-code" },
  });
  fireEvent.submit(document.querySelector("form"));
  await screen.findByRole("checkbox");
  await act(async () => reject(new Error("late old failure")));
  assert.equal(screen.queryByRole("alert") === null, true);
  assert.ok(screen.getByRole("checkbox"));
  assert.ok(
    calls.every((x) => x.opts.headers.Authorization === "Bearer new-code"),
  );
});
for (const field of [
  "proof_text",
  "secondary",
  "text",
  "slug",
  "font",
  "option_key",
  "option_value",
  "option_count",
  "surrogate",
  "comment",
])
  test(
    "bounded response refuses malformed rendered field " + field,
    async () => {
      mock((url) => {
        if (url.endsWith("/history/2")) {
          const d = makeDetail();
          const item = d.material_context.items[0];
          if (field === "proof_text") d.revision.proof_text = "x".repeat(5001);
          if (field === "secondary") item.secondary = "x".repeat(121);
          if (field === "text") item.text = "x".repeat(121);
          if (field === "slug") item.product_slug = "x".repeat(101);
          if (field === "font") item.font = "Unknown font";
          if (field === "option_key")
            item.options = { ["x".repeat(61)]: "value" };
          if (field === "option_value") item.options = { key: "x".repeat(201) };
          if (field === "option_count")
            item.options = Object.fromEntries(
              Array.from({ length: 17 }, (_, i) => ["key" + i, "value"]),
            );
          if (field === "surrogate") item.text = "\ud800";
          if (field === "comment")
            d.decisions = [
              {
                sequence: 1,
                action: "approve",
                comment: "x".repeat(1501),
                recorded_at: stamp,
                actor_scope: "holder of this private proof capability",
              },
            ];
          return reply(d);
        }
      });
      render(React.createElement(Portal));
      fireEvent.change(screen.getByLabelText("Proof reference"), {
        target: { value: "prf_test" },
      });
      fireEvent.change(screen.getByLabelText("Private access code"), {
        target: { value: "code" },
      });
      fireEvent.submit(document.querySelector("form"));
      await screen.findByRole("alert");
      assert.equal(screen.queryByRole("checkbox") === null, true);
    },
  );
test("maximum supplementary-Unicode proof and second inscription remain valid", async () => {
  mock();
  p.proof_text = "😀".repeat(5000);
  global.fetch = async (url) => {
    if (url.endsWith("/history/2")) {
      const d = makeDetail(p);
      d.revision.proof_text = p.proof_text;
      d.material_context.items[0].secondary = "😀".repeat(120);
      return reply(d);
    }
    return reply(p);
  };
  await open();
  assert.ok(screen.getByText("😀".repeat(5000)));
  assert.ok(screen.getByText("😀".repeat(120)));
});
for (const field of [
  "schema_version",
  "proof_id",
  "order_id",
  "version",
  "context_hash",
  "empty",
  "approved_version",
  "awaiting_with_decision",
  "changes_without_decision",
])
  test(
    "decision response integrity denies false confirmation " + field,
    async () => {
      mock();
      p = { ...p, status: "approved", approved_version: 2 };
      global.fetch = async (url) => {
        if (url.endsWith("/history/2")) {
          const d = makeDetail(p);
          if (field === "empty") d.decisions = [];
          else if (field === "awaiting_with_decision") {
          } else if (field === "changes_without_decision") d.decisions = [];
          else if (field !== "approved_version")
            d.decisions[0][field] =
              field === "schema_version"
                ? true
                : field === "version"
                  ? 1
                  : "wrong";
          return reply(d);
        }
        const out = { ...p };
        if (field === "approved_version") out.approved_version = 1;
        if (field === "awaiting_with_decision") {
          out.status = "awaiting_approval";
          out.approved_version = null;
        }
        if (field === "changes_without_decision") {
          out.status = "changes_requested";
          out.approved_version = null;
        }
        return reply(out);
      };
      render(React.createElement(Portal));
      fireEvent.change(screen.getByLabelText("Proof reference"), {
        target: { value: "prf_test" },
      });
      fireEvent.change(screen.getByLabelText("Private access code"), {
        target: { value: "code" },
      });
      fireEvent.submit(document.querySelector("form"));
      await screen.findByRole("alert");
      assert.equal(screen.queryByRole("checkbox") === null, true);
      assert.equal(screen.queryByRole("status") === null, true);
      assert.ok(screen.getByText(/Evidence not verified/));
    },
  );
test("partial success response without decision evidence never confirms approval", async () => {
  mock((url) => {
    if (url.endsWith("/approve")) {
      p = { ...p, status: "approved", approved_version: 2 };
      return reply(p);
    }
    if (url.endsWith("/history/2") && p.status === "approved") {
      const d = makeDetail(p);
      d.decisions = [];
      return reply(d);
    }
  });
  await open();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Approve version 2" }));
  await screen.findByRole("alert");
  assert.equal(screen.queryByRole("status") === null, true);
  assert.ok(screen.getByText(/Evidence not verified/));
});
