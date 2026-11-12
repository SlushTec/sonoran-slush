// Actual local ASGI integration with a TEST-PROCESS-ONLY provider adapter stub. Never calls Square.
// SQUARE_SMOKE_PYTHON must name the existing locked interpreter. Build the storefront
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
  python = process.env.SQUARE_SMOKE_PYTHON;
if (!python)
  throw Error(
    "Set SQUARE_SMOKE_PYTHON to the existing locked Python interpreter.",
  );
const base = path.resolve(
  process.env.SQUARE_SMOKE_TEMP || path.join(root, "artifacts/smoke-tmp"),
);
fs.mkdirSync(base, { recursive: true });
const temp = fs.mkdtempSync(path.join(base, "sq-smoke-"));
if (
  path.dirname(path.resolve(temp)) !== base ||
  !path.basename(temp).startsWith("sq-smoke-")
)
  throw Error("Unexpected owned temporary path.");
const staff = randomBytes(32).toString("hex"),
  access = randomBytes(32).toString("hex"),
  children = [];
let browser;
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
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Owned local server did not become ready: " + logs());
}
async function stop(c) {
  if (c.exitCode !== null) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  else c.kill("SIGTERM");
  for (let n = 0; n < 30 && c.exitCode === null; n++)
    await new Promise((r) => setTimeout(r, 100));
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
  env.SONORAN_TEST_PAYMENTS_ENABLED = "true";
  env.SQUARE_ENVIRONMENT = "sandbox";
  for (const key of [
    "SQUARE_SANDBOX_ACCESS_TOKEN",
    "SQUARE_SANDBOX_LOCATION_ID",
    "SQUARE_SANDBOX_MERCHANT_ID",
    "SQUARE_SANDBOX_WEBHOOK_KEY",
  ])
    env[key] = "synthetic-not-a-credential";
  env.SQUARE_WEBHOOK_NOTIFICATION_URL =
    "https://webhook.invalid/v1/webhooks/payments";
  // This monkeypatch exists only in this isolated smoke process, never the app.
  const runner = [
    "import urllib.request",
    "from services.commerce.app import payments",
    "from services.commerce.app.main import app",
    "import uvicorn",
    "def no_network(*args, **kwargs): raise RuntimeError('External provider access forbidden in smoke')",
    "urllib.request.build_opener = no_network",
    "def fake(fields):",
    "    assert fields['order']['line_items'][0]['base_price_money'] == {'amount': 1234, 'currency': 'USD'}",
    "    return {'id':'fixture-link','order_id':'fixture-provider-order','url':'https://sandbox.square.link/u/offline'}",
    "payments.square_checkout = fake",
    "uvicorn.run(app, host='127.0.0.1', port=" +
      apiPort +
      ", log_level='warning')",
  ].join("\n");
  const backendLogs = start(python, ["-c", runner], env);
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
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      assert.equal(
        r.status,
        200,
        "Synthetic API " + route + " failed: " + JSON.stringify(d),
      );
      return d;
    }
    const quote = await request("/v1/quotes", {
      request_id: randomUUID(),
      kind: "retail",
      name: "Synthetic Customer",
      email: "synthetic@example.test",
      consent: true,
      items: [
        {
          product_slug: "makertwist-40oz-tumbler",
          quantity: 1,
          text: "Synthetic engraving",
          font: "Classic serif",
        },
      ],
    });
    await request(
      "/v1/admin/quotes/" + quote.id + "/offer",
      { version: 1, total_minor: 1234, message: "Synthetic reviewed total" },
      staff,
    );
    await request(
      "/v1/quotes/" + quote.id + "/accept",
      { version: 2, decision: "accept" },
      quote.access_token,
    );
    const order = await request(
      "/v1/admin/orders",
      { quote_id: quote.id, version: 2 },
      staff,
    );
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    let relayed = 0;
    await page.route("https://commerce.qa.invalid/**", async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      const response = await fetch(api + u.pathname + u.search, {
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
    let navigation = 0;
    await page.route("https://sandbox.square.link/**", async (route) => {
      assert.equal(
        route.request().url(),
        "https://sandbox.square.link/u/offline",
      );
      navigation++;
      await route.fulfill({
        contentType: "text/plain",
        body: "Offline provider-navigation interception",
      });
    });
    await page.goto(ui + "/orders");
    await page.getByLabel("Order reference").fill(order.id);
    await page.getByLabel("Private access code").fill(order.access_token);
    await page.getByRole("button", { name: "Open securely" }).click();
    await page
      .getByRole("button", { name: "Open Square sandbox checkout" })
      .waitFor();
    const summaryPending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download order summary" }).click();
    const summary = await summaryPending,
      stream = await summary.createReadStream(),
      chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const summaryBody = Buffer.concat(chunks).toString("utf8");
    assert.ok(summaryBody.includes("Payment status: unpaid"));
    assert.ok(summaryBody.includes("Not a paid receipt or tax invoice."));
    assert.ok(summaryBody.includes(order.id));
    assert.ok(summaryBody.includes("Reviewed total: USD 12.34"));
    assert.ok(!summaryBody.includes(order.access_token));
    assert.equal(
      summary.suggestedFilename(),
      "sonoran-order-" + order.id + ".txt",
    );
    fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(root, "artifacts/order-real-backend.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Open Square sandbox checkout" })
      .click();
    await page.waitForURL("https://sandbox.square.link/u/offline");
    assert.equal(navigation, 1);
    const after = await request(
      "/v1/orders/" + order.id,
      undefined,
      order.access_token,
    );
    assert.equal(after.payment_status, "unpaid");
    const storedAfter = await request("/v1/admin/records/" + order.id, undefined, staff);
    assert.equal(storedAfter.checkout_session_id, "fixture-link");
    assert.equal(Object.hasOwn(after, "checkout_session_id"), false);
    assert.equal(Object.hasOwn(after, "payment_provider"), false);
    const replay = await request(
      "/v1/checkout/sessions",
      { order_id: order.id, version: 1 },
      order.access_token,
    );
    assert.equal(replay.url, "https://sandbox.square.link/u/offline");
    assert.equal(replay.provider, "square");
    assert.equal(replay.test_mode, true);
    assert.ok(relayed >= 2);
    console.log(
      JSON.stringify({
        result: "PASS",
        source:
          "real loopback ASGI and database; provider adapter stubbed only in isolated test process; external navigation intercepted",
        relayed_requests: relayed,
        navigation_intercepted: navigation,
        payment_status: after.payment_status,
        session_replayed: true,
        private_order_summary_verified: true,
        owned_pids: children.map((c) => c.pid),
        ports: [apiPort, uiPort],
      }),
    );
  } finally {
    if (browser) await browser.close();
    for (const c of children.reverse()) await stop(c);
    for (const port of [apiPort, uiPort]) {
      let closed = false;
      try {
        await fetch("http://127.0.0.1:" + port + "/health");
      } catch {
        closed = true;
      }
      assert.ok(closed, "Owned port remains open: " + port);
    }
    assert.equal(path.dirname(path.resolve(temp)), base);
    assert.ok(path.basename(temp).startsWith("sq-smoke-"));
    fs.rmSync(temp, { recursive: true, force: true });
    console.log(
      "Owned browser/server processes stopped; loopback ports closed; synthetic temporary database removed.",
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
