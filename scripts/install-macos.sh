#!/bin/bash
set -euo pipefail
[[ "$(uname -s)" == "Darwin" ]] || { echo "Installer nay chi danh cho macOS."; exit 1; }
package_root="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$package_root/extension"
engine="$source_dir/runtime/PRTrackEngine"
[[ -f "$source_dir/CSXS/manifest.xml" && -x "$engine" ]] || { echo "Goi cai thieu runtime macOS. Hay giai nen day du ZIP dung kien truc CPU."; exit 1; }
if pgrep -f '/Adobe Premiere Pro[^/]*/Contents/MacOS/' >/dev/null; then
  echo "Hay dong Premiere Pro truoc khi cai."; exit 1
fi
debug_mode="$(defaults read com.adobe.CSXS.12 PlayerDebugMode 2>/dev/null || true)"
[[ "$debug_mode" == "1" ]] || { echo "CEP 12 development mode chua duoc cho phep. Ban beta chua ky so; installer khong tu doi thiet lap bao mat."; exit 1; }
printf '%s\n' '{"command":"check"}' | "$engine" > /dev/null || { echo "Engine khong chay duoc. Kiem tra dung goi Apple Silicon/Intel va trang thai cho phep ung dung cua macOS."; exit 1; }
extensions_root="$HOME/Library/Application Support/Adobe/CEP/extensions"
mkdir -p "$extensions_root"
destination="$extensions_root/vn.prtrack.panel"
stage="$(mktemp -d "$extensions_root/.prtrack-stage.XXXXXX")"
ditto "$source_dir" "$stage"
printf '%s\n' '{"bundled":true,"python":""}' > "$stage/config.json"
printf '%s\n' '{"command":"check"}' | "$stage/runtime/PRTrackEngine" > /dev/null
if [[ -e "$destination" ]]; then
  backup_root="$HOME/Library/Application Support/PR Track 2D/backups"
  mkdir -p "$backup_root"
  backup="$(mktemp -d "$backup_root/panel.XXXXXX")"
  mv "$destination" "$backup/panel"
  echo "Ban cu duoc luu tai: $backup/panel"
fi
if ! mv "$stage" "$destination"; then
  if [[ -n "${backup:-}" ]]; then mv "$backup/panel" "$destination"; fi
  echo "Cai dat that bai; da thu khoi phuc ban cu."; exit 1
fi
echo "Da cai PR Track 2D. Mo Premiere > Window > Extensions > PR Track 2D."
