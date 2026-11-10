from pathlib import Path
import json
import sys
from services.commerce.app.main import app as commerce
from services.assistant.app.main import app as assistant
ROOT = Path(__file__).resolve().parents[1]

def export(check: bool = False):
    for name, app in [("commerce", commerce), ("assistant", assistant)]:
        path = ROOT / "packages/contracts" / f"openapi-{name}.json"
        expected = json.dumps(app.openapi(), sort_keys=True, indent=2) + "\n"
        if check:
            if not path.exists() or path.read_text() != expected:
                raise ValueError(f"Contract drift: {path}; run python -m scripts.export_contracts")
        else:
            path.write_text(expected)

if __name__ == "__main__":
    export("--check" in sys.argv)
    print("OpenAPI contracts checked" if "--check" in sys.argv else "OpenAPI contracts exported")
