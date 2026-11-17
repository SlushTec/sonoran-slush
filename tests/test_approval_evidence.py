"""Bounded inventory fidelity checks, not product approval."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("approval_evidence", ROOT / "scripts/check_approval_evidence.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ApprovalEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.summary = module.build()

    def test_exact_inventory(self):
        self.assertEqual(module.OUTPUT.read_text(encoding="utf-8"), self.data)
        self.assertEqual(module.SUMMARY.read_text(encoding="utf-8"), self.summary)
        rows = json.loads(self.data)["rows"]
        self.assertEqual(len({r["slug"] for r in rows}), 41)
        self.assertEqual(sum(r["facts"]["asset"] is not None for r in rows), 40)

    def test_modified_row_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            output, summary = Path(tmp)/"inventory.json", Path(tmp)/"summary.md"
            changed = json.loads(self.data)
            changed["rows"][0]["facts"]["rights_as_recorded"] = "invented approval"
            output.write_text(json.dumps(changed), encoding="utf-8")
            summary.write_text(self.summary, encoding="utf-8")
            with patch.object(module,"OUTPUT",output), patch.object(module,"SUMMARY",summary), patch("sys.argv",["check","--check"]), patch.object(module,"build",return_value=(self.data,self.summary)):
                with self.assertRaisesRegex(AssertionError,"JSON inventory differs"):
                    module.main()

    def test_modified_checklist_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            output, summary = Path(tmp)/"inventory.json", Path(tmp)/"summary.md"
            output.write_text(self.data,encoding="utf-8");summary.write_text("Approved for sale",encoding="utf-8")
            with patch.object(module,"OUTPUT",output), patch.object(module,"SUMMARY",summary), patch("sys.argv",["check","--check"]), patch.object(module,"build",return_value=(self.data,self.summary)):
                with self.assertRaisesRegex(AssertionError,"Checklist differs"):
                    module.main()

    def test_changed_source_invalidates_inventory(self):
        original = module.blob
        def altered(ref,path):
            data=original(ref,path)
            return data+b" " if ref=="HEAD" and path==module.INPUTS[0] else data
        with patch.object(module,"blob",side_effect=altered):
            with self.assertRaisesRegex(AssertionError,"Input changed"):
                module.build()

if __name__ == "__main__":
    unittest.main()
