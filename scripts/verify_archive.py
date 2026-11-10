"""Verify complete original Git tree, archived bytes and unchanged business sources."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "archive/2026-10-14-pre-native/manifest.json"
BASE = "8238fd378ca54dcfd654aa1c099b4f21416f2826"

def verify() -> dict:
    data = json.loads(MANIFEST.read_text())
    if data["base_commit"] != BASE:
        raise ValueError("Unexpected archival base")
    expected = set(subprocess.check_output(["git", "ls-tree", "-r", "--name-only", BASE], cwd=ROOT, text=True).splitlines())
    records = data["files"]
    if len(records) != len(expected) or {r["original_path"] for r in records} != expected:
        raise ValueError("Archive manifest does not cover the complete original tree")
    preserved = 0
    for record in records:
        original = subprocess.check_output(["git", "show", BASE + ":" + record["original_path"]], cwd=ROOT)
        archived = (ROOT / record["archive_path"]).read_bytes()
        if archived != original or hashlib.sha256(archived).hexdigest() != record["sha256"] or len(archived) != record["bytes"]:
            raise ValueError("Archive mismatch: " + record["original_path"])
        if record["retained_active_unchanged"]:
            if (ROOT / record["original_path"]).read_bytes() != original:
                raise ValueError("Business source changed: " + record["original_path"])
            preserved += 1
    if (ROOT / "site").exists():
        raise ValueError("Legacy site must not remain an active scaffold")
    return {"archived_files_verified": len(records), "unchanged_business_files_verified": preserved, "base_commit": BASE}

if __name__ == "__main__":
    print(json.dumps(verify(), indent=2))
