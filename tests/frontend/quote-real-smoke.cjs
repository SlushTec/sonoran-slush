// Explicit local integration smoke, not a mocked unit test.
// QUOTE_SMOKE_PYTHON must name the existing locked interpreter. Build the storefront
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
  python = process.env.QUOTE_SMOKE_PYTHON;
if (!python)
  throw Error(
    "Set QUOTE_SMOKE_PYTHON to the existing locked Python interpreter.",
  );
const base = path.resolve(
  process.env.QUOTE_SMOKE_TEMP || path.join(root, "artifacts/smoke-tmp"),
);
fs.mkdirSync(base, { recursive: true });
const temp = fs.mkdtempSync(path.join(base, "qt-smoke-"));
if (
  path.dirname(path.resolve(temp)) !== base ||
  !path.basename(temp).startsWith("qt-smoke-")
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
  env.SONORAN_TEST_PAYMENTS_ENABLED = "false";
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
      {
        version: 1,
        total_minor: 1234,
        message: "Synthetic reviewed offer\nSecond line",
      },
      staff,
    );
    const contact = await request("/v1/contact", {
      request_id: randomUUID(),
      kind: "contact",
      name: "Synthetic Customer",
      email: "synthetic@example.test",
      consent: true,
      items: [],
    });
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
    await page.goto(ui + "/quotes");
    await page.getByLabel("Request reference").fill(quote.id);
    await page.getByLabel("Private access code").fill(quote.access_token);
    await page.getByRole("button", { name: "Open securely" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Accept quote version 2" }).click();
    await page.locator(".form-success[role=status]").waitFor();
    const accepted = await request(
      "/v1/quotes/" + quote.id,
      undefined,
      quote.access_token,
    );
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.accepted_version, 2);
    assert.equal(accepted.total_minor, 1234);
    assert.equal(accepted.message, "Synthetic reviewed offer\nSecond line");
    const replay = await request(
      "/v1/quotes/" + quote.id + "/accept",
      { version: 2, decision: "accept" },
      quote.access_token,
    );
    assert.deepEqual(replay, accepted);
    fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(root, "artifacts/quote-real-backend.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Close private record" }).click();
    await page.getByLabel("Request reference").fill(contact.id);
    await page.getByLabel("Private access code").fill(contact.access_token);
    await page.getByRole("button", { name: "Open securely" }).click();
    await page.getByText("This contact request is read only.").waitFor();
    assert.equal(await page.getByRole("checkbox").count(), 0);
    await page.getByRole("button", { name: "Close private record" }).click();
    assert.equal(await page.getByLabel("Private access code").inputValue(), "");
    assert.ok(relayed >= 3);
    console.log(
      JSON.stringify({
        result: "PASS",
        source:
          "real loopback ASGI and isolated synthetic database; no provider calls",
        relayed_requests: relayed,
        accepted_version: accepted.accepted_version,
        replay_identical: true,
        contact_readonly: true,
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
    assert.ok(path.basename(temp).startsWith("qt-smoke-"));
    fs.rmSync(temp, { recursive: true, force: true });
    console.log(
      "Owned browser/server processes stopped; loopback ports closed; synthetic temporary database removed.",
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
