# PR Track 2D 🌸

Plugin Motion Tracking 2D cho Adobe Premiere Pro 2026 trên Windows.

## Tính năng

- Tracking Position, Scale và Rotation với checkbox riêng.
- Track Forward từ Playhead đến cuối clip.
- Apply chuyển động vào Text / Graphic.
- Reset Tracking của lần Apply gần nhất trong phiên.
- Tiếp tục khi mất bám; đánh dấu Frame dự đoán là Estimated.
- Kiểm tra cập nhật qua GitHub Releases.
- Xử lý video trên máy, có sẵn runtime, không cần cài Python.

## Tải và cài đặt

1. Mở [Releases](https://github.com/evolvestudiowork-gif/pr-track-2d/releases/latest).
2. Tải file `PR-Track-2D-…-Windows-Standalone.zip` trong Assets.
3. Giải nén toàn bộ, đóng Premiere rồi chạy `Install-PRTrack.cmd`.
4. Mở Premiere → Window → Extensions → PR Track 2D.

Đây là bản beta CEP chưa ký số. Máy mới cần cho phép extension
CEP phát triển; bộ cài sẽ thông báo nếu chưa có thiết lập này.

## Cách dùng

1. Chọn video trên Timeline và đặt Playhead tại Frame bắt đầu.
2. Bấm lấy video, khoanh vùng có chi tiết rõ.
3. Chọn Position, Scale và/hoặc Rotation rồi bấm Track Forward.
4. Xem lại kết quả, chọn Text / Graphic rồi bấm Apply.

Frame Estimated là dữ liệu dự đoán khi mất bám, có thể bị trượt.
Hãy xem lại trước khi Apply.

## Cập nhật

Trong panel → Updates, nhập Repository:

`evolvestudiowork-gif/pr-track-2d`

Bật kiểm tra tự động khi mở panel. Khi có bản mới, tải ZIP
từ Release, đóng Premiere và chạy bộ cài để nâng cấp.

## Giới hạn

- Tracking 2D, chưa hỗ trợ Perspective hoặc 3D.
- Không đảm bảo bám chính xác khi vật thể mờ, bị che hoặc ra khỏi hình.
- Scale cần Graphic bật Uniform Scale.
- Reset Tracking chỉ nhớ lần Apply gần nhất trong phiên hiện tại.

## Báo lỗi

Tạo Issue kèm phiên bản plugin, Premiere và thông báo lỗi.
Nếu có thể, đính kèm ảnh vùng Tracking hoặc đoạn video mẫu ngắn.
