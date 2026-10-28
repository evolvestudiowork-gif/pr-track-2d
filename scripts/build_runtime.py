"""Build on Windows x64 using .build-env with PyInstaller installed."""
from pathlib import Path
import importlib.metadata as metadata
import json
import shutil
import subprocess
import sys
import platform

root = Path(__file__).resolve().parents[1]
if sys.platform not in ("win32", "darwin"):
    raise SystemExit("Build on Windows x64 or macOS with native Python.")
subprocess.run([
    sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onedir",
    "--console", "--noupx", "--name", "PRTrackEngine",
    "--distpath", str(root / "build" / "runtime"),
    "--workpath", str(root / "build" / "pyinstaller"),
    "--specpath", str(root / "build"),
    str(root / "extension" / "engine" / "tracker.py"),
], check=True)
source = root / "build" / "runtime" / "PRTrackEngine"
target = root / "extension" / "runtime" if sys.platform == 'win32' else root / 'build' / 'macos-extension' / 'runtime'
shutil.copytree(source, target, dirs_exist_ok=True, symlinks=True)
licenses = target / "licenses"
licenses.mkdir(exist_ok=True)
python_license = next((p for p in [Path(sys.base_prefix)/'LICENSE.txt',root/'build/Python-LICENSE.txt',Path(sys.base_prefix)/'lib'/f'python{sys.version_info.major}.{sys.version_info.minor}'/'LICENSE.txt'] if p.is_file()),None)
if not python_license:
    raise SystemExit('Python license not found; include it before distribution.')
shutil.copy2(python_license, licenses / "Python.txt")
opencv_package = next(name for name in ('opencv-python-headless', 'opencv-python')
                      if name in {d.metadata['Name'] for d in metadata.distributions()})
packages = ('numpy', opencv_package, 'pyinstaller')
for name in packages:
    dist = metadata.distribution(name)
    for file in dist.files or []:
        if "license" in file.name.lower() or "copying" in file.name.lower():
            destination = licenses / name / Path(str(file))
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dist.locate_file(file), destination)
(target / "build-info.json").write_text(json.dumps({
    "python": sys.version.split()[0],
    "platform": sys.platform, "architecture": platform.machine(),
    "packages": {name: metadata.version(name) for name in packages},
}, indent=2), encoding="utf-8")
print(target)
