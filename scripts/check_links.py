from pathlib import Path
import json
import re
import subprocess
from urllib.parse import unquote, urlsplit
ROOT = Path(__file__).resolve().parents[1]

def check():
    manifest=json.loads((ROOT/'archive/2026-10-14-pre-native/manifest.json').read_text())
    retained={r['original_path'] for r in manifest['files'] if r['retained_active_unchanged']}
    names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
    checked=0
    for name in set(names):
        if not name.endswith('.md') or name in retained or name.startswith('archive/') or not (ROOT/name).is_file(): continue
        for raw in re.findall(r'\[[^\]]+\]\(([^)]+)\)',(ROOT/name).read_text()):
            target=raw.split(' ',1)[0]
            if target.startswith('#') or urlsplit(target).scheme: continue
            path=unquote(target.split('#',1)[0])
            if not path: continue
            if not ((ROOT/name).parent/path).exists(): raise ValueError(f'Broken internal link in {name}: {target}')
            checked+=1
    return checked
if __name__=='__main__': print(f'{check()} active-document internal links verified')
