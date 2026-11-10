import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "apps/storefront/out");
const catalog = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/catalog.reference.json"),
    "utf8",
  ),
);
const pages = [
  "",
  "shop",
  "custom-orders",
  "events",
  "our-work",
  "help",
  "about",
  "cart",
  "checkout",
  "account",
  "orders",
  "proofs",
  "admin",
  "privacy",
  "terms",
  "help/photo-guide",
  "help/shipping",
  "help/returns",
  "gift-finder",
  "saved",
  "quotes",
  "contact",
  "accessibility",
  ...catalog.categories.map((c) => "shop/" + c.slug),
  ...catalog.products.map((p) => "products/" + p.slug),
  "products/photo-crystal-collection",
];
const routes = new Set(pages.map((p) => "/" + p.replace(/\/$/, "")));
let links = 0;
for (const p of pages) {
  const file = path.join(out, p, "index.html");
  assert.ok(fs.existsSync(file), "Missing route: /" + p);
  const html = fs.readFileSync(file, "utf8");
  assert.equal(
    (html.match(/<h1[\s>]/g) || []).length,
    1,
    "Expected one H1: /" + p,
  );
  assert.match(html, /<main[^>]+id="main"/, "Missing main landmark: /" + p);
  assert.match(html, /noindex/, "Review route must not be indexed: /" + p);
  for (const image of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    assert.ok(
      image[1].startsWith("/"),
      "Image must be self-hosted: " + image[1],
    );
    assert.ok(
      fs.existsSync(path.join(out, image[1])),
      "Missing image: " + image[1],
    );
  }
  for (const match of html.matchAll(/<a[^>]+href="([^"]+)"/g)) {
    if (!match[1].startsWith("/")) continue;
    const target =
      new URL(
        match[1].replaceAll("&amp;", "&"),
        "https://review.example.test",
      ).pathname.replace(/\/$/, "") || "/";
    assert.ok(
      routes.has(target),
      "Broken internal route from /" + p + ": " + target,
    );
    links++;
  }
}
assert.equal(fs.existsSync(path.join(out, "archive")), false);
console.log(
  JSON.stringify(
    {
      pages: pages.length,
      categories: catalog.categories.length,
      products: catalog.products.length,
      internal_links_checked: links,
      self_hosted_product_images: Object.keys(
        JSON.parse(
          fs.readFileSync(
            path.join(root, "apps/storefront/src/lib/product-media.json"),
            "utf8",
          ),
        ),
      ).length,
      one_h1_per_page: true,
      archive_public: false,
    },
    null,
    2,
  ),
);
