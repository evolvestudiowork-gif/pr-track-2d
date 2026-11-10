# PR Track 2D — macOS

Có ZIP standalone native cho Apple Silicon (arm64) và Intel (x86_64) trong mỗi GitHub Release. Không cần Python trên máy nhận. Chưa kiểm tra tích hợp Premiere/Gatekeeper trên Mac thật.

## Bộ cài được build thế nào

Workflow **Build release assets** (`.github/workflows/build-release-assets.yml`, chạy tay trong tab Actions) build engine trên `macos-26` (Apple Silicon) và `macos-15-intel` (Intel), kiểm thử engine trên chính máy đó, rồi gắn ZIP vào Release. Quy trình phát hành: xem [GITHUB-RELEASES.md](GITHUB-RELEASES.md).

## Cài trên Mac

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

Tracking hai chiều, Position/Scale/Rotation, Estimated, Apply cho Graphic ngắn, Reset và giao diện dùng chung với Windows. Updates trên Mac chọn asset theo kiến trúc của tiến trình CEP. Nếu Release chỉ có ZIP Windows, Mac sẽ không báo có bộ cài phù hợp.

## Build thủ công trên Mac

Trong một checkout mới, cài Python 3.11 đúng kiến trúc và `pip install -r scripts/requirements-build.txt`, chuẩn bị giấy phép Python tại `build/Python-LICENSE.txt`, rồi chạy:

```sh
python3 scripts/build_runtime.py
python3 scripts/verify_runtime.py
python3 scripts/package_macos.py
```

PyInstaller cần chạy trên macOS để tạo runtime macOS: https://pyinstaller.org/en/stable/
CEP: https://github.com/Adobe-CEP/CEP-Resources

## Một phiên bản, nhiều hệ điều hành

Windows, macOS arm64 và macOS x86_64 dùng chung một tag và một Release. Không tạo tag riêng cho Mac.
