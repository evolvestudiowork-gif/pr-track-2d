# Changelog

Mọi thay đổi đáng chú ý của PR Track 2D. Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [Semantic Versioning](https://semver.org/lang/vi/).

Khi phát hành, đổi tiêu đề `Chưa phát hành` thành số phiên bản. Nội dung mục đó được dùng làm ghi chú của GitHub Release.

## [Chưa phát hành]

## [0.6.2] - 2026-11-11

### Sửa lỗi

- Graphic bị nhảy khỏi vị trí đã đặt sau khi Apply nếu Playhead đã dời khỏi Frame mốc. Nay Graphic giữ đúng vị trí tại Frame đang đứng (Playhead) lúc bấm Apply; nếu Playhead nằm ngoài đoạn đã Track thì vẫn dùng Frame mốc như trước.

## [0.6.1] - 2026-11-10

### Sửa lỗi

- Bộ cài Windows báo "running scripts is disabled on this system" trên máy chặn chạy script PowerShell (Execution Policy). `Install-PRTrack.cmd` nay chạy bộ cài với `-ExecutionPolicy Bypass`, chỉ cho riêng lần chạy đó, không đổi thiết lập của máy.

## [0.6.0] - 2026-11-10

### Thay đổi

- Hỗ trợ Premiere Pro 2027 (27.x) bên cạnh 2026.
- Giao diện chia thành ba bước **Source → Track → Apply**, có dấu ✓ khi hoàn tất từng bước.
- Màu nền, màu chữ và cỡ chữ theo giao diện Premiere, tự đổi khi chỉnh độ sáng trong Preferences › Appearance. Màu nhấn đổi sang xanh như panel gốc.
- Hướng dẫn dài trong panel chuyển thành tooltip trên từng nút và link tới README.
- Nút **Reset** chuyển lên tiêu đề bước Track. Phiên bản hiển thị trong mục Updates.
- Mục Updates mặc định kiểm tra repo `evolvestudiowork-gif/pr-track-2d`.
- Thông báo dùng thống nhất một cách gọi: câu tiếng Việt, tên trong Premiere và tên nút giữ tiếng Anh.

### Sửa lỗi

- Không kéo chuột khoanh vùng được trên Preview trong Premiere trên macOS: panel nghe pointer events, loại mà trình duyệt nhúng của Premiere không phát khi dùng chuột thật. Nay dùng mouse events.
- Viền vùng chọn mỏng còn khoảng 0.5px, gần như không thấy với video độ phân giải cao. Nay luôn dày 2px trên màn hình.
- Dòng trạng thái bị thụt đầu dòng khi mới mở panel.
- Thông báo yêu cầu bấm "Track Both Directions" và "Áp dụng" không khớp tên nút thật.
- Plugin báo lỗi thay vì ghi Keyframe nhầm thuộc tính nếu Premiere đổi thứ tự thuộc tính Motion.

### Nội bộ

- Tách `panel.js` thành `controls.js`, `preview.js`, `messages.js`; engine Python bỏ kế thừa giữa hai tracker.
- Số phiên bản chỉ khai báo trong `package.json`; `npm version` đồng bộ sang các file còn lại.

## [0.5.2]

### Thay đổi

- Chọn riêng hướng Track: **Backward**, **Track Both**, **Forward**.
- **Use Selected Graphic** giữ đích Apply theo ID, kể cả khi selection trên Timeline thay đổi.
- **Remove Tracking** khôi phục lần Apply gần nhất và giữ dữ liệu Track.
- **Reset Tracking** xóa vùng chọn và kết quả Track, đưa Preview về Frame mốc; giữ Source, Target và thiết lập.
- Apply hiện rõ lý do khi chưa sẵn sàng. Advanced và Updates tách thành hai mục.

## [0.5.1]

- Engine standalone được kiểm tra trên Windows, Mac Apple Silicon và Mac Intel.

## [0.5.0]

- Thêm bản standalone cho macOS Apple Silicon (arm64) và Intel (x86_64), dùng chung Release với bản Windows.

[Chưa phát hành]: https://github.com/evolvestudiowork-gif/pr-track-2d/compare/v0.6.2...HEAD
[0.6.2]: https://github.com/evolvestudiowork-gif/pr-track-2d/releases/tag/v0.6.2
[0.6.1]: https://github.com/evolvestudiowork-gif/pr-track-2d/releases/tag/v0.6.1
[0.6.0]: https://github.com/evolvestudiowork-gif/pr-track-2d/releases/tag/v0.6.0
[0.5.2]: https://github.com/evolvestudiowork-gif/pr-track-2d/releases/tag/v0.5.2
[0.5.1]: https://github.com/evolvestudiowork-gif/pr-track-2d/releases/tag/v0.5.1
[0.5.0]: https://github.com/evolvestudiowork-gif/pr-track-2d/releases/tag/v0.5.0
