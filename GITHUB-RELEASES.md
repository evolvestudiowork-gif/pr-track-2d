# Phát hành PR Track 2D qua GitHub

Repo đề xuất: `TEN-TAI-KHOAN/pr-track-2d`, Public.
Nếu muốn giữ source private: dùng repo public `pr-track-2d-releases` chỉ chứa Release.
Panel hiện hỗ trợ public GitHub.com, không lưu token và không đọc repo private.

## Thiết lập một lần

1. Tạo repo trên GitHub. Push source nếu muốn công khai source.
2. Trong panel → Updates → GitHub Repository, nhập `owner/repo` rồi bấm **Check for Updates**.
3. Giữ bật **Check for Updates khi mở panel**. Repo và lựa chọn này lưu trên máy, giữ qua lần cài đè.

## Mỗi lần phát hành

1. Tăng version trong package.json, manifest.xml, badge HTML, host.jsx, bridge.js và updates.js.
2. Nếu engine thay đổi, build lại runtime; chạy kiểm thử và `python scripts/package.py`.
3. GitHub → Releases → Draft a new release. Tag `v0.4.2` (đổi thành version thực tế).
4. Upload `PR-Track-2D-0.4.2-Windows-Standalone.zip` từ dist; đính kèm SHA256 nếu có.
5. Publish Release chính thức, không chọn Pre-release. Chọn Set as latest khi cần.

**Push commit hoặc tạo tag riêng không phát hành bộ cài.** ZIP Source code mà GitHub tự tạo không có runtime.
Không đưa `.build-env`, runtime sinh tự động, build, test-output hay cấu hình máy vào Git.
ZIP installer được upload riêng ở Release assets.

Panel gọi [GitHub Latest Release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)
khi mở và khi bấm Check for Updates. Chỉ báo tải nếu version mới hơn và có asset standalone đúng tên.
Nút tải mở trang Release trong trình duyệt. Người dùng tải ZIP, đóng Premiere và chạy Install-PRTrack.cmd.
Không tự chạy file tải xuống, không tự thay plugin đang hoạt động.
Mất mạng, chưa có Release hoặc rate limit chỉ hiện trạng thái Updates; Tracking vẫn chạy offline.

Bản đầu có tính năng này vẫn cần cài thủ công. Không thể tự thêm updater vào các bản cũ đã cài.

## Windows và macOS cùng Release v0.5.0

Đính kèm Windows-Standalone.zip, macOS-arm64-Standalone.zip và macOS-x86_64-Standalone.zip (cùng tiền tố PR-Track-2D-0.5.0-) vào một Release v0.5.0. Hai ZIP Mac cần được build/kiểm thử trên runner Mac trước. Không cần tạo Release 0.6.0 chỉ để thêm OS. Các bản đã cài 0.5.0 sẽ không báo phiên bản mới khi thêm asset cùng version; người dùng tải thủ công đúng OS từ Release.
