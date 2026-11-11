// Explicit local integration smoke, not a mocked unit test.
// PROOF_SMOKE_PYTHON must name the existing locked interpreter. Build the storefront
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
  python = process.env.PROOF_SMOKE_PYTHON;
if (!python)
  throw Error(
    "Set PROOF_SMOKE_PYTHON to the existing locked Python interpreter.",
  );
const base = path.resolve(
  process.env.PROOF_SMOKE_TEMP || path.join(root, "artifacts/smoke-tmp"),
);
fs.mkdirSync(base, { recursive: true });
const temp = fs.mkdtempSync(path.join(base, "pp-smoke-"));
if (
  path.dirname(path.resolve(temp)) !== base ||
  !path.basename(temp).startsWith("pp-smoke-")
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
    await request(
      "/v1/admin/retail-test/stock/smoke",
      { expected_version: 0, on_hand: 5 },
      staff,
    );
    await request(
      "/v1/admin/retail-test/offers/makertwist-40oz-tumbler",
      {
        expected_version: 0,
        unit_price_minor: 1234,
        stock_id: "smoke",
        units_per_item: 1,
        pieces_per_item: 1,
      },
      staff,
    );
    const cart = await request("/v1/cart", {
      request_id: randomUUID(),
      items: [
        {
          product_slug: "makertwist-40oz-tumbler",
          quantity: 1,
          personalization: { mode: "identical", text: "Synthetic engraving" },
        },
      ],
    });
    const order = await request(
      "/v1/cart/" + cart.id + "/orders",
      { version: 1 },
      cart.access_token,
    );
    const proof = await request(
      "/v1/admin/proofs",
      {
        order_id: order.id,
        expected_proof_version: 0,
        proof_text: "Synthetic exact proof version one",
      },
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
    await page.goto(ui + "/proofs");
    await page.getByLabel("Proof reference").fill(proof.id);
    await page.getByLabel("Private access code").fill(proof.access_token);
    await page.getByRole("button", { name: "Open securely" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Approve version 1" }).click();
    await page.locator(".form-success[role=status]").waitFor();
    const first = await request(
      "/v1/proofs/" + proof.id + "/history/1",
      undefined,
      proof.access_token,
    );
    assert.equal(first.decisions.length, 1);
    assert.equal(first.decisions[0].action, "approve");
    assert.equal(
      first.revision.proof_text,
      "Synthetic exact proof version one",
    );
    await request(
      "/v1/admin/proofs",
      {
        order_id: order.id,
        expected_proof_version: 1,
        proof_text: "Synthetic exact proof version two",
      },
      staff,
    );
    await page.getByRole("button", { name: "Refresh current proof" }).click();
    await page.getByRole("button", { name: "Approve version 2" }).waitFor();
    await page.getByRole("button", { name: "Past versions" }).click();
    await page.getByRole("button", { name: "View version 1" }).click();
    await page
      .getByText("Synthetic exact proof version one", { exact: true })
      .waitFor();
    assert.equal(await page.getByRole("checkbox").count(), 0);
    assert.deepEqual(
      await request(
        "/v1/proofs/" + proof.id + "/history/1",
        undefined,
        proof.access_token,
      ),
      first,
    );
    fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(root, "artifacts/proof-real-backend.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Return to current proof" }).click();
    await page.getByRole("checkbox").waitFor();
    await page.getByRole("button", { name: "Close private record" }).click();
    assert.equal(await page.getByLabel("Private access code").inputValue(), "");
    assert.ok(relayed >= 9);
    console.log(
      JSON.stringify({
        result: "PASS",
        source: "real loopback ASGI app, isolated synthetic database",
        browser: "headless Chromium",
        relayed_requests: relayed,
        approval_events: first.decisions.length,
        prior_revision_immutable: true,
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
    assert.ok(path.basename(temp).startsWith("pp-smoke-"));
    fs.rmSync(temp, { recursive: true, force: true });
    console.log(
      "Owned browser/server processes stopped; loopback ports closed; synthetic temporary database removed.",
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
