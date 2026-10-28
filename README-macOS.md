# PR Track 2D v0.5.0 — macOS preview

Phần hỗ trợ macOS đã được bổ sung vào source. **Chưa có runtime macOS được build hoặc kiểm thử trên máy hiện tại (Windows).** Gói Source Kit không phải bộ cài chạy ngay.

## Tạo bộ cài qua GitHub Actions

1. Giải nén Source Kit và đưa toàn bộ source lên repo, giữ cả `.github/workflows/build-macos.yml`.
2. Repo hiện chỉ chứa README/Releases thì cần thêm source trước; không upload `.build-env`, `build`, runtime Windows hoặc `dist`.
3. Mở **Actions → Build macOS standalone → Run workflow**.
4. Workflow chạy độc lập trên `macos-15` (Apple Silicon) và `macos-15-intel` (Intel), build native và kiểm thử engine. Workflow không tự publish Release.
5. Khi cả hai job thành công, tải Artifacts. Mỗi artifact chứa ZIP standalone thật và SHA256.
6. Giải nén artifact ngoài để lấy ZIP `PR-Track-2D-<version>-macOS-arm64-Standalone.zip` hoặc `...-macOS-x86_64-Standalone.zip`, rồi đính kèm ZIP đó vào GitHub Release.

Build bằng runner macOS 15: phạm vi đầu tiên cần kiểm chứng là macOS 15 trở lên với Premiere Pro 2026. Chưa cam kết chạy trên bản macOS cũ hơn.

## Cài trên Mac sau khi build thành công

1. Chọn đúng ZIP theo kiến trúc chạy Premiere/CEP. Apple Silicon chạy native dùng arm64; Intel hoặc CEP chạy Rosetta cần x86_64.
2. Giải nén bằng Finder/Archive Utility để giữ symlink và quyền executable.
3. Đóng Premiere, mở `Install-PRTrack.command` trong thư mục đã giải nén.
4. Installer kiểm tra CEP 12 development mode và engine, sao lưu bản cũ rồi cài vào `~/Library/Application Support/Adobe/CEP/extensions/vn.prtrack.panel`.
5. Mở Premiere → Window → Extensions → PR Track 2D.

Không cần cài Python trên máy nhận. Build runtime cần Python/OpenCV/PyInstaller, nhưng workflow đã lo các bước này.

## Trạng thái ký số

Đây là bản phát triển CEP chưa ký số; engine PyInstaller không có Developer ID/notarization cho phân phối đại trà. macOS có thể chặn khi tải từ Internet. Installer không gỡ quarantine, không tắt Gatekeeper và không tự bật CEP development mode. Cần kiểm chứng cài đặt trên Mac thật; để phát hành thuận tiện cần Developer ID, notarization và quy trình ký extension.

Nếu macOS từ chối mở, xem thông báo hệ thống hoặc hướng dẫn chính thức của Apple. Không coi build CI thành công là đã xác nhận Gatekeeper hay Premiere.

## Tính năng dùng chung

Tracking hai chiều, Position/Scale/Rotation, Estimated, Apply cho Graphic ngắn, Reset và giao diện hồng pastel dùng chung với Windows. Updates trên Mac chọn asset theo kiến trúc của tiến trình CEP. Nếu Release chỉ có ZIP Windows, Mac sẽ không báo có bộ cài phù hợp.

## Build thủ công trên Mac

Trong một checkout mới, cài Python 3.11 đúng kiến trúc, dependencies trong workflow, chuẩn bị giấy phép Python tại `build/Python-LICENSE.txt`, rồi chạy:

```sh
python3 scripts/build_runtime.py
python3 scripts/verify_runtime.py
python3 scripts/package_macos.py
```

PyInstaller cần chạy trên macOS để tạo runtime macOS: https://pyinstaller.org/en/stable/
CEP: https://github.com/Adobe-CEP/CEP-Resources

## Một phiên bản, nhiều hệ điều hành

Windows, macOS arm64 và macOS x86_64 dùng chung tag **v0.5.0**. Đính kèm các ZIP standalone theo OS vào cùng Release; không tạo tag riêng cho Mac. Source Kit chỉ để build, không phải asset cài đặt dành cho người dùng cuối.
