from pathlib import Path
import json
from scripts.check_links import check
ROOT=Path(__file__).resolve().parents[2]

def test_active_document_links_resolve():
    assert check()>10

def test_all_release_gates_remain_closed():
    gates=json.loads((ROOT/'infra/releases/production-gates.json').read_text())
    for key in ['deployment_enabled','live_payments_enabled','live_email_enabled','customer_data_import_enabled']:
        assert gates[key] is False
    assert gates['owner_approval'] is None and gates['blockers']

def test_docker_context_excludes_historical_and_private_material():
    ignore=(ROOT/'.dockerignore').read_text().splitlines()
    for path in ['archive','docs','**/.env','**/*.key','**/*.tfstate*']:
        assert path in ignore
