"""Run on the same Mac/architecture that built and tested the runtime."""
from pathlib import Path
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
if sys.platform != 'darwin':
    raise SystemExit('Build the standalone macOS ZIP on a Mac or the GitHub macOS runner.')
arch = platform.machine()
if arch not in ('arm64', 'x86_64'):
    raise SystemExit('Unsupported Mac architecture.')
runtime = root / 'build/macos-extension/runtime'
info = json.loads((runtime/'build-info.json').read_text())
if info.get('platform') != 'darwin' or info.get('architecture') != arch:
    raise SystemExit('Runtime architecture mismatch.')
if not os.access(runtime/'PRTrackEngine', os.X_OK):
    raise SystemExit('Build the native runtime first.')
version = json.loads((root/'package.json').read_text())['version']
bundle = f'PR-Track-2D-{version}-macOS-{arch}-Standalone'
stage = root / 'build' / 'packages' / bundle
if stage.exists():
    raise SystemExit('Package stage already exists. Use a fresh checkout/build folder.')
shutil.copytree(root/'extension',stage/'extension',symlinks=True,
                ignore=shutil.ignore_patterns('runtime','config.json','__pycache__','*.pyc'))
shutil.copytree(runtime,stage/'extension/runtime',symlinks=True)
for name in ['Install-PRTrack.command','README-macOS.md']:
    shutil.copy2(root/name,stage/name)
(stage/'scripts').mkdir()
shutil.copy2(root/'scripts/install-macos.sh',stage/'scripts/install-macos.sh')
for name in ['Install-PRTrack.command','scripts/install-macos.sh']:
    (stage/name).chmod(0o755)
dist=root/'dist'; dist.mkdir(exist_ok=True)
output=dist/(bundle+'.zip')
subprocess.run(['ditto','-c','-k','--sequesterRsrc','--keepParent',str(stage),str(output)],check=True)
output.with_suffix('.zip.sha256').write_text(hashlib.sha256(output.read_bytes()).hexdigest()+'  '+output.name+'\n')
print(output)
