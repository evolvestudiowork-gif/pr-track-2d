# PR Track 2D 🌸

Plugin **Motion Tracking 2D** cho **Adobe Premiere Pro 2026 trên Windows**, giúp gắn Text / Graphic theo chuyển động trong video.

[**Tải phiên bản mới nhất**](https://github.com/evolvestudiowork-gif/pr-track-2d/releases/latest) · [Lịch sử cập nhật](https://github.com/evolvestudiowork-gif/pr-track-2d/releases) · [Báo lỗi](https://github.com/evolvestudiowork-gif/pr-track-2d/issues)

## Tính năng

- **Tracking hai chiều:** chọn vùng tại một Frame mốc, tự Track ngược về đầu và tiến đến cuối phần clip trên Timeline.
- **Position / Scale / Rotation:** chọn riêng hoặc kết hợp bằng checkbox.
- **Apply linh hoạt:** Graphic không cần dài bằng video; chỉ áp dụng vào phần giao với dữ liệu Tracking, tối thiểu 2 Frame.
- **Continue Tracking:** khi mất bám, tiếp tục bằng dữ liệu dự đoán, đánh dấu **Estimated** và hiển thị vùng chọn màu vàng.
- **Reset Tracking:** khôi phục các thuộc tính của lần Apply gần nhất trong phiên làm việc.
- **Preview:** xem vùng Tracking, tiến độ, Confidence và kết quả bằng thanh trượt.
- **Advanced:** Smoothing, Motion Gain và xuất dữ liệu JSON.
- **GitHub Updates:** tự kiểm tra Release mới khi mở panel.
- **Runtime tích hợp:** không cần cài riêng Python, OpenCV hoặc NumPy. Video được xử lý trên máy.

## Yêu cầu

- Windows 64-bit và Adobe Premiere Pro 2026 (26.x), có CEP 12.
- Video có tốc độ Frame cố định (CFR), pixel vuông, tốc độ phát 100%, không phát ngược.
- Nếu video đã dùng speed ramp, Warp Stabilizer hoặc Scale to Frame Size, hãy xuất thành video trước khi Tracking.

**Đây là bản beta CEP chưa ký số.** Máy mới cần cho phép extension CEP phát triển. Bộ cài chỉ kiểm tra thiết lập này và thông báo nếu chưa đáp ứng; không tự thay đổi registry.

## Tải và cài đặt

1. Mở [Latest Release](https://github.com/evolvestudiowork-gif/pr-track-2d/releases/latest).
2. Trong **Assets**, tải `PR-Track-2D-<version>-Windows-Standalone.zip`.
3. Giải nén **toàn bộ** ZIP vào một thư mục.
4. Đóng Premiere, chạy **Install-PRTrack.cmd**.
5. Mở Premiere → **Window → Extensions → PR Track 2D**.

Không chọn gói **Source code (zip)** hoặc **Source code (tar.gz)** mà GitHub tự tạo. Bộ cài standalone nằm trong ZIP được đính kèm riêng ở Assets.

Không chạy bộ cài ngay bên trong ZIP và không tách file EXE khỏi thư mục runtime.

## Cách sử dụng

### 1. Chọn Source và Frame mốc

- Chọn video trên Timeline. Có thể dùng nguyên clip hoặc cắt sẵn đoạn cần Track.
- Đặt Playhead tại **bất kỳ Frame nào bên trong clip** có vật thể rõ.
- Bấm **Get Selected Clip**.
- Nếu đổi Playhead sau khi lấy Source, bấm **Update Frame** rồi khoanh lại vùng.

### 2. Tracking

- Kéo chuột khoanh vùng có chi tiết rõ trong Preview; tránh lấy quá nhiều nền.
- Chọn **Position**, **Scale**, **Rotation** hoặc kết hợp các thuộc tính cần dùng.
- Bấm **Track Both Directions**.

Plugin phân tích từ Frame mốc đến cuối clip, rồi từ Frame mốc ngược về đầu clip. Kết quả được ghép theo đúng thứ tự Timeline và giới hạn trong phần clip đã cắt.

**Stop** hủy lượt đang chạy; hiện chưa giữ kết quả của lượt bị hủy để Apply.

### 3. Xem lại và Apply

- Dùng thanh trượt để kiểm tra kết quả, đặc biệt các Frame **Estimated**.
- Tạo hoặc chọn Text / Graphic trên Timeline.
- Nếu Graphic phủ Frame mốc, đặt chữ tại **Frame mốc** trước khi Apply.
- Nếu Graphic không phủ Frame mốc, đặt chữ tại **Frame đầu phần giao** giữa Graphic và đoạn Tracking.
- Chọn Graphic, bấm **Apply to Selected Graphic**.

Graphic không cần dài bằng video. Phần giao với dữ liệu Tracking cần có ít nhất **2 Frame**.

Với Caption, chuyển sang Graphic trước khi Apply. Plugin di chuyển cả Graphic clip; các lớp bên trong cùng Graphic sẽ đi cùng nhau.

### 4. Reset

Bấm **Reset Tracking** để gỡ các Keyframe của lần Apply gần nhất và khôi phục giá trị ban đầu của các thuộc tính đã áp dụng.

Reset chỉ nhớ lần Apply gần nhất trong phiên hiện tại. Nếu các Keyframe đó đã được chỉnh sửa thủ công, plugin sẽ từ chối tự Reset để bảo vệ thay đổi.

## Kiểm tra cập nhật

Trong **Advanced & Updates → Updates**, nhập Repository:

```text
evolvestudiowork-gif/pr-track-2d
```

Bấm **Check for Updates** và bật **Check for Updates khi mở panel**.

Khi có phiên bản mới, panel hiện nút mở trang Release. Tải ZIP, đóng Premiere và chạy bộ cài để cài đè. **Hiện chưa tự tải, giải nén hoặc cài đặt bản cập nhật.**

Tracking hoạt động offline; kết nối mạng chỉ cần khi kiểm tra hoặc tải bản cập nhật.

## Giới hạn cần biết

- Hỗ trợ chuyển động 2D, chưa hỗ trợ Perspective, biến dạng hoặc 3D.
- Scale cần Graphic bật **Uniform Scale**; video nguồn cần Scale X/Y bằng nhau khi áp dụng Scale/Rotation.
- Các thuộc tính được chọn để Apply phải chưa có Animation.
- Scale/Rotation áp dụng quanh **Anchor Point của Graphic**; offset Position không xoay quanh điểm Tracking như khi Parent layer vào Null trong AE.
- **Estimated là dự đoán**, có thể trượt khỏi vật thể. Chạy hết clip không đồng nghĩa với bám chính xác toàn bộ clip.
- Clip offline, lỗi giải mã hoặc lỗi engine vẫn có thể làm lượt phân tích dừng.

## Bản 0.5.0

Thêm Tracking hai chiều từ Frame mốc, xử lý clip đã cắt, ghép dữ liệu đúng Timeline và giữ giá trị Position/Scale/Rotation tại mốc khi Apply. Giải mã ngược theo cụm để hạn chế RAM.

Đã đạt **65 kiểm thử tự động** và kiểm tra EXE độc lập. Tính năng hai chiều chưa được xác nhận trực tiếp trong Premiere tại thời điểm phát hành.

## Báo lỗi

Tạo [Issue](https://github.com/evolvestudiowork-gif/pr-track-2d/issues) kèm phiên bản plugin, Premiere, nội dung lỗi và thao tác trước khi lỗi xảy ra. Nếu thuận tiện, bổ sung ảnh vùng khoanh hoặc đoạn video mẫu ngắn.
