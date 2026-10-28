"""Source-only distribution suitable for GitHub upload; excludes machine files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo
import json

root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text())['version']
files=[]
for directory in ['extension','scripts','tests','.github']:
    files.extend(p for p in (root/directory).rglob('*') if p.is_file()
                 and not any(part in ('runtime','__pycache__') for part in p.relative_to(root).parts)
                 and p.suffix!='.pyc' and p.name!='config.json')
files.extend(root/name for name in ['package.json','.gitignore','README.md','README-macOS.md',
                                   'GITHUB-RELEASES.md','Install-PRTrack.command','Install-PRTrack.cmd'])
output=root/'dist'/f'PR-Track-2D-{version}-macOS-Source-Kit.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output,'w',ZIP_DEFLATED) as archive:
    for file in sorted(files):
        name=file.relative_to(root).as_posix()
        entry=ZipInfo(name)
        entry.create_system=3
        entry.external_attr=(0o100755 if file.suffix in ('.sh','.command') else 0o100644)<<16
        entry.compress_type=ZIP_DEFLATED
        archive.writestr(entry,file.read_bytes())
print(output)
