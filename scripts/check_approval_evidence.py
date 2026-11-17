"""Build/check a bounded prerequisite inventory; never grants product approval."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = "9cb9a6073fb0619ee931c42e1e315d82ce5f8f78"
INPUTS = ["docs/assets/product-sources.json", "packages/contracts/catalog.reference.json",
          "docs/assets/SUPPLIER-AND-PHOTO-REGISTER.md", "docs/business/SOURCE-REGISTER.md",
          "docs/requirements/CUSTOMER-EXPERIENCE.md"]
OUTPUT = ROOT / "docs/assets/APPROVAL-EVIDENCE.json"
SUMMARY = ROOT / "docs/assets/APPROVAL-CHECKLIST.md"

def blob(ref, path):
    return subprocess.check_output(["git", "show", ref + ":" + path], cwd=ROOT)

def digest(value):
    return hashlib.sha256(value).hexdigest()

def build():
    inputs = {path: blob(BASE, path) for path in INPUTS}
    # Later source changes require a new reviewed inventory, not silent stale reuse.
    for path, data in inputs.items():
        assert blob("HEAD", path) == data, "Input changed since reviewed baseline: " + path
    sources = json.loads(inputs[INPUTS[0]])["products"]
    catalog = json.loads(inputs[INPUTS[1]])
    products = {p["slug"]: p for p in catalog["products"]}
    assert len(products) == len(catalog["products"]) == 41
    assert set(products) == set(sources), "Source/catalog slug coverage differs"
    rows = []
    for slug in sorted(products):
        source, product = sources[slug], products[slug]
        path = source.get("asset_path")
        asset = None
        if path:
            assert path.startswith("apps/storefront/public/products/")
            data = blob(BASE, path)
            assert blob("HEAD", path) == data, "Asset changed: " + path
            assert digest(data) == source["asset_sha256"], "Registered asset hash differs: " + slug
            assert source["width"] > 0 and source["height"] > 0
            asset = {"path": path, "sha256": digest(data), "width_px": source["width"], "height_px": source["height"]}
        assert product["price_minor"] is None and product["purchasable"] is False
        decisions = ["Supply an approved current price/options record before retail totals or price filtering."]
        if path:
            decisions.append("Provide evidence permitting this exact image's commercial publication, or an approved replacement; private-review status is not that permission.")
            decisions.append("Provide a verified physical-scale reference for the actual offered blank; pixel dimensions alone do not establish scale.")
        else:
            decisions.append("Provide the actual balsa/painted-finish product photo and matching material/finish evidence; do not substitute the held blank.")
        if source["match"] in ["representative_blank", "documented_brand"]:
            decisions.append("Identify and verify the exact offered blank, including dimensions and contents; candidate or brand match is insufficient.")
        else:
            decisions.append("Confirm the actual offered product/shape and supported specifications; recorded match classification alone is not manufacturing qualification.")
        rows.append({"slug": slug, "name": product["name"], "category": product["category"],
            "facts": {"source_url": source.get("source_url"), "source_paths": source.get("source_paths", []),
                "match_as_recorded": source["match"], "rights_as_recorded": source["rights"],
                "display_as_recorded": source.get("public_display"), "source_note_as_recorded": source.get("note", ""),
                "source_row_sha256": digest(json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()),
                "asset": asset, "price_minor": product["price_minor"], "purchasable": product["purchasable"]},
            "not_established_by_reviewed_register": {"commercial_permission": "Not established; no permission approval is inferred from the recorded rights statement.",
                "physical_scale_proof": "Not established by this register's asset dimensions; no claim is made about evidence outside reviewed inputs.",
                "retail_price_approval": "No price supplied in the navigation catalog."},
            "decision_or_evidence_needed": decisions})
    assert sum(row["facts"]["asset"] is not None for row in rows) == 40
    assert sum("brochure" in v["rights"] for v in sources.values()) == 11
    assert sum("Supplier reference image" in v["rights"] for v in sources.values()) == 29
    assert sum(v["match"] == "representative_blank" for v in sources.values()) == 17
    assert sum(v["match"] == "documented_brand" for v in sources.values()) == 3
    assert all(v.get("public_display") == "owner_private_review" for v in sources.values() if v.get("asset_path"))
    result = {"schema_version": 1, "kind": "approval_evidence_inventory_not_approval", "baseline_commit": BASE,
        "scope": "Derived only from the five listed repository inputs and their registered asset bytes. Does not query external rights, stock or prices; does not close Linear acceptance or authorize publication.",
        "input_sha256": {path: digest(data) for path, data in inputs.items()},
        "counts": {"catalog_rows": 41, "registered_images": 40, "held_without_image": 1, "missing_prices": 41, "purchasable": 0},
        "rows": rows}
    md = ["# Store approval evidence checklist", "", "This is an evidence inventory, not approval. Baseline: `" + BASE + "`.",
        "The JSON companion preserves all 41 rows, exact source classifications/rights statements, 40 asset hashes and pixel dimensions, five input hashes, missing-evidence labels and concrete next decisions. No prices, permissions or classifications were changed.", "",
        "## Owner/reviewer checklist", "", "- [ ] For the 11 brochure images, establish commercial publication permission for the exact images; the recorded original photographer/license is not reconstructed.",
        "- [ ] For the 29 supplier reference images, establish commercial reuse permission or supply approved replacements. A supplier link is not a license.",
        "- [ ] Resolve the 17 representative blanks and 3 brand-only matches against actual offered blanks, dimensions and set contents.",
        "- [ ] Supply the held balsa/painted-finish photo and material evidence; keep it undisplayed meanwhile.",
        "- [ ] Provide physical scale evidence for actual offerings; image pixel width/height is not a scale test.",
        "- [ ] Supply approved current price/option records. All 41 navigation prices are null and none are purchasable.",
        "- [ ] Keep human screen-reader/real-device and representative production-sample acceptance separate from automated browser checks.", "",
        "SS-004/SS-007/SS-008 prerequisites are catalogued here; SS-059 initial collections/styles/fonts and SS-010 account/cross-device retention/auth decisions remain separate. No whole parent criterion is closed.", "",
        "## Per-row register", "", "Every displayed image remains `owner_private_review`. 'Missing' below means not established by the bounded reviewed inputs, not that no evidence exists elsewhere.", "",
        "| Product | Recorded match | Image / private-review basis | Missing evidence / next decision |", "| --- | --- | --- | --- |"]
    for row in rows:
        f=row["facts"]; name=row["name"]; url=f["source_url"]; link=("["+name+"]("+url+")") if url else name
        basis=("Brochure; license not reconstructed" if "brochure" in f["rights_as_recorded"] else "Supplier; commercial reuse unverified") if f["asset"] else "Held; not displayed"
        needs="Commercial permission, actual-blank/scale verification, approved price/options" if f["asset"] else "Actual balsa/painted photo/material evidence and approved price/options"
        md.append("| "+link+" (`"+row["slug"]+"`) | `"+f["match_as_recorded"]+"` | "+basis+" | "+needs+" |")
    md.extend(["", "## Verification", "", "Run `python scripts/check_approval_evidence.py --check`. It compares this inventory to the pinned source bytes, checks current input/asset identity, exact 41-slug coverage, 40 registered image hashes/dimensions, and the unchanged null-price/non-purchasable boundary. It is not a rights determination or a broad storefront regression gate.", ""])
    return json.dumps(result, ensure_ascii=False, indent=2)+"\n", "\n".join(md)

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--check", action="store_true");args=parser.parse_args()
    data, summary=build()
    if args.check:
        assert OUTPUT.read_text(encoding="utf-8") == data, "JSON inventory differs"
        assert SUMMARY.read_text(encoding="utf-8") == summary, "Checklist differs"
    else:
        OUTPUT.write_text(data, encoding="utf-8");SUMMARY.write_text(summary, encoding="utf-8")
    print(json.dumps({"rows":41,"images":40,"missing_prices":41,"purchasable":0,"check":args.check}))

if __name__ == "__main__":
    main()
