// Explicit local integration smoke, not a mocked unit test.
// CROSS_SMOKE_PYTHON must name the existing locked interpreter. Build the storefront
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
  python = process.env.CROSS_SMOKE_PYTHON;
if (!python)
  throw Error(
    "Set CROSS_SMOKE_PYTHON to the existing locked Python interpreter.",
  );
const base = path.resolve(
  process.env.CROSS_SMOKE_TEMP || path.join(root, "artifacts/smoke-tmp"),
);
fs.mkdirSync(base, { recursive: true });
const temp = fs.mkdtempSync(path.join(base, "cross-smoke-"));
if (
  path.dirname(path.resolve(temp)) !== base ||
  !path.basename(temp).startsWith("cross-smoke-")
)
  throw Error("Unexpected owned temporary path.");
const staff = randomBytes(32).toString("hex"),
  access = randomBytes(32).toString("hex"),
  children = [];
let browser,
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
          text: "Synthetic José 🌵",
          font: "Classic serif",
        },
      ],
    });
    // Separate supported-API fixture for cross-order denial, not another customer.
    const otherQuote = await request("/v1/quotes", {
      request_id: randomUUID(),
      kind: "retail",
      name: "Synthetic Other",
      email: "other@example.test",
      consent: true,
      items: [
        {
          product_slug: "makertwist-40oz-tumbler",
          quantity: 1,
          text: "Other fixture",
        },
      ],
    });
    await request(
      "/v1/admin/quotes/" + otherQuote.id + "/offer",
      { version: 1, total_minor: 1234, message: "Other synthetic offer" },
      staff,
    );
    await request(
      "/v1/quotes/" + otherQuote.id + "/accept",
      { version: 2, decision: "accept" },
      otherQuote.access_token,
    );
    const otherOrder = await request(
      "/v1/admin/orders",
      { quote_id: otherQuote.id, version: 2 },
      staff,
    );

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 1280, height: 900 },
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
    const staffPage = await context.newPage(),
      quotePage = await context.newPage(),
      orderPage = await context.newPage(),
      proofPage = await context.newPage();
    const button = (p, name) => p.getByRole("button", { name, exact: true });
    async function openStaff(id) {
      await staffPage.goto(ui + "/admin");
      await staffPage.getByLabel("Staff access code").fill(staff);
      await button(staffPage, "Open workspace").click();
      await staffPage.getByLabel("Record reference").fill(id);
      await button(staffPage, "Open record").click();
    }
    async function lock() {
      await button(staffPage, "Lock workspace").click();
      assert.ok(
        (await staffPage.getByLabel("Staff access code").inputValue()) === "",
        "Staff code cleared",
      );
      assert.ok(
        (await button(staffPage, "Download receipt").count()) === 0,
        "Receipt dismissed",
      );
    }
    async function openPrivate(p, route, label, receipt) {
      await p.goto(ui + route);
      await p.getByLabel(label).fill(receipt.id);
      await p.getByLabel("Private access code").fill(receipt.access_token);
      await button(p, "Open securely").click();
    }
    async function closePrivate(p) {
      await button(p, "Close private record").click();
      assert.ok(
        (await p.getByLabel("Private access code").inputValue()) === "",
        "Private code cleared",
      );
    }
    async function download(p, name) {
      const pending = p.waitForEvent("download");
      await button(p, name).click();
      const file = await pending,
        stream = await file.createReadStream(),
        chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const content = Buffer.concat(chunks).toString("utf8");
      await file.delete();
      return content;
    }
    async function denied(route, body, token, allowed) {
      const r = await fetch(api + route, {
        redirect: "error",
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      stage = "capability denial HTTP " + r.status;
      assert.ok(allowed.includes(r.status), "Capability or stage gate denied");
      return r.json();
    }
    function fixtureFingerprint() {
      const code = [
        "import sqlite3, pathlib, hashlib, sys",
        "p=pathlib.Path(sys.argv[1]).resolve()",
        "db=sqlite3.connect(p.as_uri()+'?mode=ro', uri=True)",
        "db.execute('BEGIN')",
        "h=hashlib.sha256()",
        "for line in db.iterdump(): h.update(line.encode('utf-8')); h.update(b'\\n')",
        "db.close()",
        "sys.stdout.write(h.hexdigest())",
      ].join("\n");
      const result = spawnSync(
        python,
        ["-c", code, path.join(temp, "fixture.sqlite3")],
        {
          cwd: root,
          windowsHide: true,
          encoding: "utf8",
          env,
          timeout: 10000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      assert.ok(
        result.status === 0 && /^[a-f0-9]{64}$/.test(result.stdout),
        "Owned readonly fixture fingerprint",
      );
      return result.stdout;
    }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const offerMessage =
      "Synthetic connected offer\nExact engraving and total only.";
    stage = "staff quote/order stage";
    await openStaff(quote.id);
    await staffPage.getByLabel("Final reviewed total (USD)").fill("12.34");
    await staffPage
      .getByLabel("Quote details, inclusions & applicable terms")
      .fill(offerMessage);
    await button(staffPage, "Offer a new quote version").click();
    await staffPage.locator(".form-success[role=status]").waitFor();
    const offered = await request(
      "/v1/quotes/" + quote.id,
      undefined,
      quote.access_token,
    );
    assert.ok(
      offered.version === 2 &&
        offered.total_minor === 1234 &&
        offered.message === offerMessage,
      "Offered exact terms",
    );
    await lock();
    stage = "quote acceptance";
    await openPrivate(quotePage, "/quotes", "Request reference", quote);
    await quotePage.getByRole("checkbox").check();
    await button(quotePage, "Accept quote version 2").click();
    await quotePage.locator(".form-success[role=status]").waitFor();
    const accepted = await request(
      "/v1/quotes/" + quote.id,
      undefined,
      quote.access_token,
    );
    assert.ok(
      accepted.status === "accepted" &&
        accepted.accepted_version === 2 &&
        accepted.message === offerMessage,
      "Exact quote acceptance",
    );
    await closePrivate(quotePage);
    stage = "staff quote/order stage";
    await openStaff(quote.id);
    await button(staffPage, "Prepare order from accepted version").click();
    await button(staffPage, "Download receipt").waitFor();
    const order = JSON.parse(await download(staffPage, "Download receipt"));
    assert.ok(
      typeof order.id === "string" &&
        order.id.startsWith("ord_") &&
        typeof order.access_token === "string",
      "Order receipt shape",
    );
    await lock();
    stage = "order summary";
    await openPrivate(orderPage, "/orders", "Order reference", order);
    await button(orderPage, "Download order summary").waitFor();
    const initial = await request(
      "/v1/orders/" + order.id,
      undefined,
      order.access_token,
    );
    const firstSummary = await download(orderPage, "Download order summary");
    assert.ok(
      firstSummary.includes("USD 12.34") &&
        firstSummary.includes("Payment status: unpaid") &&
        firstSummary.includes("Not a paid receipt"),
      "Initial unpaid summary",
    );
    assert.ok(
      !firstSummary.includes(order.access_token) &&
        !firstSummary.includes(staff),
      "Summary excludes capabilities",
    );
    stage = "staff proof preparation";
    await openStaff(order.id);
    await staffPage
      .getByLabel("Exact proof text / layout details")
      .fill("Synthetic connected José 🌵 proof");
    await button(staffPage, "Prepare next proof version").click();
    await button(staffPage, "Download receipt").waitFor();
    stage = "proof receipt parsing";
    const proof = JSON.parse(await download(staffPage, "Download receipt"));
    assert.ok(
      typeof proof.id === "string" &&
        proof.id.startsWith("prf_") &&
        typeof proof.access_token === "string",
      "Proof receipt shape",
    );
    await lock();
    stage = "capability rejection";
    const deniedFingerprint = fixtureFingerprint();
    const before = await request(
      "/v1/orders/" + order.id,
      undefined,
      order.access_token,
    );
    await denied("/v1/orders/" + order.id, undefined, quote.access_token, [
      404,
    ]);
    await denied("/v1/orders/" + order.id, undefined, otherOrder.access_token, [
      404,
    ]);
    await denied("/v1/orders/" + otherOrder.id, undefined, order.access_token, [
      404,
    ]);
    await denied("/v1/proofs/" + proof.id, undefined, order.access_token, [
      404,
    ]);
    await denied(
      "/v1/proofs/" + proof.id + "/approve",
      { version: 1, decision: "approve", comment: "" },
      order.access_token,
      [404],
    );
    assert.ok(
      same(
        before,
        await request("/v1/orders/" + order.id, undefined, order.access_token),
      ),
      "Denied capability does not mutate order",
    );
    assert.ok(
      fixtureFingerprint() === deniedFingerprint,
      "Capability denials preserve whole fixture state",
    );
    stage = "proof approval";
    await openPrivate(proofPage, "/proofs", "Proof reference", proof);
    await proofPage.getByRole("checkbox").check();
    await button(proofPage, "Approve version 1").click();
    await proofPage.locator(".form-success[role=status]").waitFor();
    const evidence = await request(
      "/v1/proofs/" + proof.id + "/history/1",
      undefined,
      proof.access_token,
    );
    assert.ok(
      evidence.revision.order_id === order.id &&
        evidence.revision.proof_text === "Synthetic connected José 🌵 proof" &&
        evidence.decisions.length === 1 &&
        evidence.decisions[0].action === "approve",
      "Bound exact proof approved",
    );
    await closePrivate(proofPage);
    const approved = await request(
      "/v1/orders/" + order.id,
      undefined,
      order.access_token,
    );
    assert.ok(
      approved.version === initial.version &&
        approved.proof_status === "approved" &&
        approved.payment_status === "unpaid",
      "Same-version connected proof transition remains unpaid",
    );
    stage = "same-version summary witness";
    let unexpectedDownloads = 0;
    const countDownload = () => unexpectedDownloads++;
    orderPage.on("download", countDownload);
    await button(orderPage, "Download order summary").click();
    await orderPage
      .getByText(
        "The order changed. Review the refreshed details, then choose Download order summary again. No file was created.",
        { exact: true },
      )
      .waitFor();
    await orderPage.waitForTimeout(150);
    assert.ok(
      unexpectedDownloads === 0,
      "Stale same-version summary produces no file",
    );
    orderPage.off("download", countDownload);
    const finalSummary = await download(orderPage, "Download order summary");
    assert.ok(
      finalSummary.includes("Proof status: approved") &&
        finalSummary.includes("Payment status: unpaid") &&
        finalSummary.includes("Not a paid receipt"),
      "Explicit second click exports new proof status without claiming payment",
    );
    for (const secret of [
      staff,
      quote.access_token,
      order.access_token,
      proof.access_token,
    ])
      assert.ok(
        !finalSummary.includes(secret),
        "Summary excludes private capabilities",
      );
    stage = "unpaid release denial";
    const releaseFingerprint = fixtureFingerprint();
    const blocked = await denied(
      "/v1/admin/orders/" + order.id + "/release",
      {
        version: approved.version,
        inventory_reserved: true,
        capacity_confirmed: true,
      },
      staff,
      [409],
    );
    assert.ok(
      blocked.error?.message ===
        "Legacy quote orders need durable inventory and capacity migration before release.",
      "Exact legacy migration hold retained",
    );
    stage = "release state nonmutation";
    assert.ok(
      same(
        approved,
        await request("/v1/orders/" + order.id, undefined, order.access_token),
      ),
      "Unpaid release denied without mutation",
    );
    assert.ok(
      fixtureFingerprint() === releaseFingerprint,
      "Rejected release preserves whole fixture state",
    );
    stage = "close final order";
    await closePrivate(orderPage);
    stage = "browser storage check";
    for (const p of [quotePage, orderPage, proofPage]) {
      assert.ok(
        await p.evaluate(
          (values) => {
            const stored = JSON.stringify([
              Object.entries(localStorage),
              Object.entries(sessionStorage),
            ]);
            return values.every((value) => !stored.includes(value));
          },
          [
            staff,
            quote.access_token,
            order.access_token,
            proof.access_token,
            order.id,
            proof.id,
          ],
        ),
        "No private capabilities or record identities in browser storage",
      );
    }
    fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
    await orderPage.evaluate(() =>
      window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
    );
    await orderPage.screenshot({
      path: path.join(root, "artifacts/cross-portal-closed.png"),
      fullPage: true,
    });
    assert.ok(externalAttempts === 0, "No outside-origin network attempts");
    console.log(
      JSON.stringify({
        result: "PASS",
        source:
          "one real loopback ASGI database; browser staff/quote/order/proof; no provider calls",
        relayed_requests: relayed,
        outside_origin_attempts: externalAttempts,
        exact_quote_accepted: true,
        explicit_receipt_handoffs: true,
        bound_proof_approved: true,
        same_version_summary_guard: true,
        unpaid_order_legacy_migration_hold: true,
        private_sessions_closed: true,
        owned_pids: children.map((c) => c.pid),
        ports: [apiPort, uiPort],
      }),
    );
  } finally {
    if (browser) await browser.close();
    for (const c of children.reverse()) await stop(c);
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
      assert.ok(closed, "Owned port closure not verified");
    }
    assert.equal(path.dirname(path.resolve(temp)), base);
    assert.ok(path.basename(temp).startsWith("cross-smoke-"));
    fs.rmSync(temp, { recursive: true, force: true });
    console.log(
      "Owned browser/server processes stopped; loopback ports closed; synthetic temporary database removed.",
    );
  }
})().catch((e) => {
  console.error(
    "Cross-portal smoke failed at static stage: " +
      stage +
      ". Private diagnostics redacted.",
  );
  process.exitCode = 1;
});
