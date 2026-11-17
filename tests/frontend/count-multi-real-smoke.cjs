// Explicit local integration smoke, not a mocked unit test.
// STAFF_SMOKE_PYTHON must name the existing locked interpreter. Build the storefront
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
  python = process.env.STAFF_SMOKE_PYTHON;
if (!python)
  throw Error(
    "Set STAFF_SMOKE_PYTHON to the existing locked Python interpreter.",
  );
const base = path.resolve(
  process.env.STAFF_SMOKE_TEMP || path.join(root, "artifacts/smoke-tmp"),
);
fs.mkdirSync(base, { recursive: true });
const temp = fs.mkdtempSync(path.join(base, "count-multi-smoke-"));
if (
  path.dirname(path.resolve(temp)) !== base ||
  !path.basename(temp).startsWith("count-multi-smoke-")
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
    const baseRoute="/v1/admin/retail-test/component-ledger";
    async function seed(route,body,method="POST") {
      const r=await fetch(api+baseRoute+route,{method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+staff},body:JSON.stringify(body)});
      assert.equal(r.status,200,"Synthetic seed failed");return r.json();
    }
    await seed("/components/blank",{kind:"blank",unit:"piece"},"PUT");
    await seed("/locations/shop",{kind:"workshop"},"PUT");
    await seed("/locations/market",{kind:"market"},"PUT");
    await seed("/lots/lot",{component_id:"blank",supplier_reference:"synthetic",lot_reference:"synthetic"},"PUT");
    await seed("/lots/lot/movements",{request_id:randomUUID(),expected_version:0,quantity:10,purpose:"receipt",destination:{location_id:"shop",condition:"available"},reason:"Synthetic test seed"});
    await seed("/lots/lot/movements",{request_id:randomUUID(),expected_version:1,quantity:3,purpose:"transfer",source:{location_id:"shop",condition:"available"},destination:{location_id:"market",condition:"damaged"},reason:"Synthetic test seed"});
    function snapshot(){const result=spawnSync(python,["-c","import sqlite3,sys,hashlib;from pathlib import Path;c=sqlite3.connect(Path(sys.argv[1]).as_uri()+'?mode=ro',uri=True);print(hashlib.sha256('\\n'.join(c.iterdump()).encode()).hexdigest());c.close()",env.SONORAN_DB_PATH],{env,encoding:"utf8",windowsHide:true});assert.equal(result.status,0,"Read-only snapshot failed");return result.stdout.trim();}
    const before=snapshot();
    browser=await chromium.launch({headless:true,executablePath:process.env.WAYPOINT_BROWSER_EXECUTABLE});
    let relayed=0;
    for(const width of [390,1280]) {
      const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
      const requests=[];
      await page.route("https://commerce.qa.invalid/**",async route=>{
        const req=route.request(),u=new URL(req.url());
        assert.ok(u.pathname.endsWith("/summary")||u.pathname===baseRoute+"/lots/lot/availability"||u.pathname===baseRoute+"/lots/lot/count-preview");
        assert.equal(req.method(),u.pathname.endsWith("/count-preview")?"POST":"GET");
        const r=await fetch(api+u.pathname,{method:req.method(),headers:{"Content-Type":"application/json",Authorization:req.headers().authorization},body:req.postData()||undefined});
        assert.equal(r.status,200,"Read-only API failed");requests.push({path:u.pathname,body:req.postData()?JSON.parse(req.postData()):null});relayed++;
        await route.fulfill({status:r.status,body:await r.text(),contentType:"application/json"});
      });
      await page.goto(ui+"/admin");await page.getByLabel("Staff access code").fill(staff);await page.getByRole("button",{name:"Open workspace"}).click();
      await page.getByLabel("Count lot reference").fill("lot");await page.getByLabel("Count location reference",{exact:true}).fill("shop");await page.getByLabel("Observed test units",{exact:true}).fill("5");
      const storage=await page.evaluate(()=>({...localStorage}));
      await page.getByRole("button",{name:"Add count bucket",exact:true}).click();await page.getByLabel("Count location reference 2",{exact:true}).fill("market");await page.getByLabel("Count condition 2",{exact:true}).selectOption("damaged");await page.getByLabel("Observed test units 2",{exact:true}).fill("4");
      await page.getByRole("button",{name:"Compare test count",exact:true}).focus();await page.keyboard.press("Enter");const view=page.getByLabel("Verified test count comparison");await view.waitFor();
      assert.match(await view.innerText(),/Recorded units\s+7/);assert.match(await view.innerText(),/Recorded units\s+3/);assert.match(await view.innerText(),/\+1/);assert.match(await view.innerText(),/-2/);
      assert.deepEqual(requests.filter(r=>r.body).map(r=>r.body),[{expected_version:2,observations:[{location_id:"shop",condition:"available",observed_units:5},{location_id:"market",condition:"damaged",observed_units:4}]}]);
      assert.deepEqual(await page.evaluate(()=>({...localStorage})),storage);assert.equal(snapshot(),before);
      await page.getByRole("button",{name:"Lock workspace"}).click();assert.equal(await page.getByLabel("Count lot reference").count(),0);await context.close();
    }
    assert.equal(snapshot(),before);
    console.log(JSON.stringify({result:"PASS",widths:[390,1280],source:"actual loopback API with synthetic seeded DB; browser relay is transport only",relayed_requests:relayed,logical_database_sha256:before,unchanged:true,comparison_writes:0}));
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
    assert.ok(path.basename(temp).startsWith("count-multi-smoke-"));
    fs.rmSync(temp, { recursive: true, force: true });
    console.log(
      "Owned browser/server processes stopped; loopback ports closed; synthetic temporary database removed.",
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
