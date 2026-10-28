"""Package the complete standalone Windows runtime; never ship a partial bundle."""
from pathlib import Path
import json
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
if not (root / 'extension/runtime/PRTrackEngine.exe').is_file():
    raise SystemExit('Run scripts/build_runtime.py first. Standalone runtime is missing.')
dist = root / "dist"
dist.mkdir(exist_ok=True)
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
if "var VERSION = '" + version + "';" not in (root / 'extension/js/updates.js').read_text(encoding='utf-8'):
    raise SystemExit('Updater version does not match package.json.')
output = dist / f"PR-Track-2D-{version}-Windows-Standalone.zip"
files = [root / "Install-PRTrack.cmd", root / "scripts" / "Install.ps1", root / "README.md", root / "CAI-DAT.txt", root / "GITHUB-RELEASES.md"]
files += [p for p in (root / "extension").rglob("*") if p.is_file()
          and "__pycache__" not in p.parts and p.name != "config.json" and p.suffix != ".pyc"]
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(root).as_posix())
print(output)
