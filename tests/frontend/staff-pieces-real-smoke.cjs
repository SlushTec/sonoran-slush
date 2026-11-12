// Explicit local integration smoke, not a mocked unit test.
// PIECES_SMOKE_PYTHON must name the existing locked interpreter. Build the storefront
// with NEXT_PUBLIC_COMMERCE_API_URL=https://commerce.qa.invalid before this command.
const { spawn, spawnSync } = require("node:child_process"),
  { randomUUID, randomBytes } = require("node:crypto");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  net = require("node:net"),
  assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");
const root = path.resolve(__dirname, "../.."),
  python = process.env.PIECES_SMOKE_PYTHON;
if (!python)
  throw Error(
    "Set PIECES_SMOKE_PYTHON to the existing locked Python interpreter.",
  );
const base = path.resolve(
  process.env.PIECES_SMOKE_TEMP || path.join(root, "artifacts/smoke-tmp"),
);
fs.mkdirSync(base, { recursive: true });
const temp = fs.mkdtempSync(path.join(base, "pieces-smoke-"));
if (
  path.dirname(path.resolve(temp)) !== base ||
  !path.basename(temp).startsWith("pieces-smoke-")
)
  throw Error("Unexpected owned temporary path.");
const staff = randomBytes(32).toString("hex"),
  access = randomBytes(32).toString("hex"),
  children = [];
let browser,
  outcome,
  stage = "startup";
async function unused() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}
function start(command, args, env) {
  const c = spawn(command, args, {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
  let log = "";
  for (const io of [c.stdout, c.stderr])
    io.on("data", (d) => {
      log = (log + d).slice(-16000);
    });
  c.on("error", (e) => {
    log += e.message;
  });
  children.push(c);
  return () => log;
}
async function ready(url, logs) {
  for (let n = 0; n < 120; n++) {
    try {
      if ((await fetch(url, { redirect: "error" })).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Owned local server did not become ready: ");
}
async function stop(c) {
  if (c.exitCode !== null || c.signalCode !== null) return;
  if (!Number.isSafeInteger(c.pid) || c.pid <= 0)
    throw Error("Owned child PID unavailable; no termination attempted");
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  else c.kill("SIGTERM");
  for (let n = 0; n < 30 && c.exitCode === null && c.signalCode === null; n++)
    await new Promise((r) => setTimeout(r, 100));
  if (c.exitCode === null && c.signalCode === null)
    throw Error("Owned child termination unverified");
}
(async () => {
  const apiPort = await unused(),
    uiPort = await unused(),
    api = "http://127.0.0.1:" + apiPort,
    ui = "http://127.0.0.1:" + uiPort;
  const env = {
    ...process.env,
    PYTHONUTF8: "1",
    SONORAN_STAGE: "scaffold",
    SONORAN_REQUESTS_ENABLED: "true",
    SONORAN_RETAIL_TEST_ENABLED: "true",
    SONORAN_ACCESS_SECRET: access,
    SONORAN_STAFF_TOKEN: staff,
    SONORAN_DB_PATH: path.join(temp, "fixture.sqlite3"),
    NEXT_PUBLIC_COMMERCE_API_URL: "https://commerce.qa.invalid",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  // Explicitly disable real provider/payment activation; no production data is used.
  env.SONORAN_TEST_PAYMENTS_ENABLED = "false";
  // Strip ambient provider settings only from this owned child environment.
  for (const key of Object.keys(env)) {
    if (/^(SQUARE_|STRIPE_|PAYPAL_|OPENAI_|ANTHROPIC_|AWS_)/i.test(key))
      delete env[key];
  }
  const backendLogs = start(
    python,
    [
      "-m",
      "uvicorn",
      "services.commerce.app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(apiPort),
    ],
    env,
  );
  const frontendLogs = start(
    process.execPath,
    [
      "scripts/preview-storefront.mjs",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(uiPort),
    ],
    env,
  );
  try {
    await ready(api + "/health", backendLogs);
    await ready(ui + "/api/health", frontendLogs);
    async function request(route, body, token) {
      const r = await fetch(api + route, {
        redirect: "error",
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      assert.equal(r.status, 200, "Synthetic API failed (response redacted)");
      return d;
    }
    stage = "owned backend identity";
    assert.ok(
      children[0].exitCode === null && children[0].signalCode === null,
      "Owned backend alive",
    );
    const empty = await request("/v1/admin/summary", undefined, staff);
    assert.ok(
      empty &&
        Object.keys(empty).sort().join(",") === "counts,recent" &&
        empty.counts &&
        Object.keys(empty.counts).length === 0 &&
        Array.isArray(empty.recent) &&
        empty.recent.length === 0,
      "Fresh nonce authenticated empty owned fixture",
    );
    assert.ok(
      children[0].exitCode === null && children[0].signalCode === null,
      "Owned backend still alive",
    );
    stage = "synthetic API seed";
    await request(
      "/v1/admin/retail-test/stock/pieces-smoke",
      { expected_version: 0, on_hand: 500 },
      staff,
    );
    await request(
      "/v1/admin/retail-test/offers/makertwist-40oz-tumbler",
      {
        expected_version: 0,
        unit_price_minor: 1234,
        stock_id: "pieces-smoke",
        units_per_item: 7,
        pieces_per_item: 2,
      },
      staff,
    );
    const assignments = Array.from({ length: 30 }, (_, n) => ({
      set_index: Math.floor(n / 2),
      piece_index: n % 2,
      text: "Synthetic second " + n,
    }));
    const cart = await request("/v1/cart", {
      request_id: randomUUID(),
      items: [
        {
          product_slug: "makertwist-40oz-tumbler",
          quantity: 15,
          personalization: { mode: "identical", text: "  Synthetic José 🌵  " },
        },
        {
          product_slug: "makertwist-40oz-tumbler",
          quantity: 15,
          personalization: {
            mode: "per_piece",
            pieces: [...assignments].reverse(),
          },
        },
      ],
    });
    const receipt = await request(
      "/v1/cart/" + cart.id + "/orders",
      { version: 1 },
      cart.access_token,
    );
    const before = await request(
      "/v1/orders/" + receipt.id,
      undefined,
      receipt.access_token,
    );
    assert.ok(
      before.lines.length === 2 &&
        before.lines[0].stock_units === 105 &&
        before.lines[1].stock_units === 105,
      "Stock units remain distinct from piece count",
    );
    assert.ok(
      before.lines.every(
        (l) =>
          l.personalization_snapshot.pieces.length === 30 &&
          l.personalization_snapshot.pieces_per_item === 2,
      ),
      "Actual normalized API snapshots",
    );
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      serviceWorkers: "block",
    });
    let relayed = 0,
      externalAttempts = 0;
    await context.route("**/*", async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (u.origin === ui || u.protocol === "blob:" || u.href === "about:blank")
        return route.continue();
      if (u.origin !== "https://commerce.qa.invalid") {
        externalAttempts++;
        return route.abort("blockedbyclient");
      }
      const response = await fetch(api + u.pathname + u.search, {
        redirect: "error",
        method: req.method(),
        headers: {
          "Content-Type": "application/json",
          ...(req.headers().authorization
            ? { Authorization: req.headers().authorization }
            : {}),
        },
        body: req.postData() || undefined,
      });
      relayed++;
      await route.fulfill({
        status: response.status,
        body: await response.text(),
        contentType: "application/json",
      });
    });
    const page = await context.newPage();
    stage = "staff recorded mapping";
    await page.goto(ui + "/admin");
    await page.getByLabel("Staff access code").fill(staff);
    await page.getByRole("button", { name: "Open workspace" }).click();
    await page.getByLabel("Record reference").fill(receipt.id);
    await page
      .getByRole("button", { name: "Open record", exact: true })
      .click();
    const region = page.getByRole("region", {
      name: "Recorded personalization",
    });
    await region
      .getByText(
        "60 recorded pieces. Set and piece numbers below start at 1.",
        { exact: true },
      )
      .waitFor();
    assert.ok(
      (await region.getByRole("listitem").count()) === 25,
      "Bounded mapping rows",
    );
    assert.ok(
      (await region.textContent()).includes("Identical text"),
      "Identical mode visible",
    );
    const history = page.getByRole("region", { name: "Recorded history" });
    assert.ok(
      Array.isArray(before.timeline) &&
        before.timeline.length > 0 &&
        before.timeline.length <= 25,
      "Owned fixture recorded history exists",
    );
    await history.getByRole("listitem").last().waitFor();
    const observedHistory = await history
      .getByRole("listitem")
      .evaluateAll((rows) =>
        rows.map((row) => ({
          label: row.querySelector("div bdi").textContent,
          at: row.querySelector("time").textContent,
        })),
      );
    assert.ok(
      JSON.stringify(observedHistory) ===
        JSON.stringify(before.timeline.map(({ label, at }) => ({ label, at }))),
      "Exact recorded history and order preserved",
    );
    const AXE = require("@axe-core/playwright").default;
    assert.ok(
      (
        await new AXE({ page })
          .include('section[aria-label="Recorded history"]')
          .analyze()
      ).violations.length === 0,
      "Desktop history accessibility",
    );
    const desktopAudit = await new AXE({ page })
      .include('section[aria-label="Recorded personalization"]')
      .analyze();
    assert.ok(
      desktopAudit.violations.length === 0,
      "Scoped desktop accessibility",
    );
    fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await page.screenshot({
      path: path.join(root, "artifacts/staff-pieces-real-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await region.getByRole("button", { name: "Next piece page" }).focus();
    await page.keyboard.press("Enter");
    await region.getByRole("button", { name: "Next piece page" }).click();
    await region.getByText("Synthetic second 29", { exact: true }).waitFor();
    assert.ok(
      (await region.getByRole("listitem").count()) === 10,
      "Second line remains distinct across pages",
    );
    assert.ok(
      (await region.textContent()).includes("Set 15 · Piece 2"),
      "Correct set and piece context",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Mobile no horizontal overflow",
    );
    const mobileAudit = await new AXE({ page })
      .include('section[aria-label="Recorded personalization"]')
      .analyze();
    assert.ok(
      mobileAudit.violations.length === 0,
      "Scoped mobile accessibility",
    );
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    assert.ok(
      (
        await new AXE({ page })
          .include('section[aria-label="Recorded history"]')
          .analyze()
      ).violations.length === 0,
      "Mobile history accessibility",
    );
    await page.screenshot({
      path: path.join(root, "artifacts/staff-pieces-real-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Lock workspace" }).click();
    assert.ok(
      (await page
        .getByRole("region", { name: "Recorded personalization" })
        .count()) === 0,
      "Lock clears mapping",
    );
    assert.ok(
      (await page.getByLabel("Staff access code").inputValue()) === "",
      "Lock clears code",
    );
    assert.ok(
      (await page.getByRole("region", { name: "Recorded history" }).count()) ===
        0,
      "Lock clears history",
    );
    const after = await request(
      "/v1/orders/" + receipt.id,
      undefined,
      receipt.access_token,
    );
    assert.ok(
      JSON.stringify(after) === JSON.stringify(before),
      "Read-only display preserves order",
    );
    assert.ok(externalAttempts === 0, "No outside-origin attempts");
    outcome = {
      result: "PASS",
      source:
        "real loopback ASGI structured retail fixture and staff browser; no provider calls",
      same_sku_lines: 2,
      recorded_pieces: 60,
      stock_units: 210,
      readonly_order: true,
      exact_recorded_history: true,
      desktop_mobile_axe: true,
      relayed_requests: relayed,
      outside_origin_attempts: externalAttempts,
      owned_pids: children.map((c) => c.pid),
      ports: [apiPort, uiPort],
    };
  } finally {
    const cleanupFailures = [];
    if (browser) {
      try {
        await browser.close();
      } catch {
        cleanupFailures.push("browser close unverified");
      }
    }
    for (const c of [...children].reverse()) {
      try {
        await stop(c);
      } catch {
        cleanupFailures.push("owned server stop unverified");
      }
    }
    let portsClosed = true;
    for (const port of [apiPort, uiPort]) {
      const closed = await new Promise((resolve) => {
        const socket = net.createConnection({ host: "127.0.0.1", port });
        let settled = false;
        function finish(value) {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(value);
        }
        socket.setTimeout(2000);
        socket.once("connect", () => finish(false));
        socket.once("timeout", () => finish(false));
        socket.once("error", (error) => finish(error.code === "ECONNREFUSED"));
      });
      if (!closed) {
        portsClosed = false;
        cleanupFailures.push("owned port open or unknown");
      }
    }
    if (
      portsClosed &&
      !cleanupFailures.includes("owned server stop unverified")
    ) {
      try {
        assert.equal(path.dirname(path.resolve(temp)), base);
        assert.ok(path.basename(temp).startsWith("pieces-smoke-"));
        fs.rmSync(temp, { recursive: true, force: true });
      } catch {
        cleanupFailures.push("owned temporary cleanup unverified");
      }
    } else {
      cleanupFailures.push("owned temporary fixture preserved");
    }
    if (cleanupFailures.length) {
      stage = "cleanup: " + cleanupFailures.join("; ");
      throw Error("Owned cleanup incomplete");
    }
    console.log(
      "Owned browser/server processes stopped; loopback ports closed; synthetic temporary database removed.",
    );
  }
  if (outcome) console.log(JSON.stringify(outcome));
})().catch((e) => {
  console.error(
    "Staff mapping smoke failed at static stage: " +
      stage +
      ". Private diagnostics redacted.",
  );
  process.exitCode = 1;
});
