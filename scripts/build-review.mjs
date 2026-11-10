import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build", "--workspace", "@sonoran/storefront"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      SONORAN_REVIEW_EXPORT: "1",
    },
  },
);
process.exit(result.status ?? 1);
