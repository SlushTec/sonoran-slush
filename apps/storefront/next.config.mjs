import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const reviewExport = process.env.SONORAN_REVIEW_EXPORT === "1";
if (process.env.SONORAN_STAGE && process.env.SONORAN_STAGE !== "scaffold") {
  throw new Error(
    "This foundation is not approved for staging/production commerce. Complete release gates first.",
  );
}
/** @type {import('next').NextConfig} */
const config = {
  output: reviewExport ? "export" : "standalone",
  trailingSlash: reviewExport,
  outputFileTracingRoot: root,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
if (reviewExport) delete config.headers;
export default config;
