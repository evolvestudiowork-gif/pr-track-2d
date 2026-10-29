# PR Track 2D 🌸

Plugin **Motion Tracking 2D** cho **Adobe Premiere Pro 2026 trên Windows và macOS**, giúp gắn Text / Graphic theo chuyển động trong video.

[**Tải phiên bản mới nhất**](https://github.com/evolvestudiowork-gif/pr-track-2d/releases/latest) · [Lịch sử cập nhật](https://github.com/evolvestudiowork-gif/pr-track-2d/releases) · [Báo lỗi](https://github.com/evolvestudiowork-gif/pr-track-2d/issues)

## Giao diện v0.5.2

Source → Preview → Channels → Track → Target → Apply. Chọn riêng Backward / Track Both / Forward; Use Selected Graphic giữ đích Apply theo ID dù đổi selection trên Timeline. Remove Tracking khôi phục lần Apply gần nhất, giữ dữ liệu Track. Apply hiện rõ lý do khi chưa sẵn sàng; Advanced và Updates tách riêng.

Reset All dọn Source, Target, vùng chọn và kết quả Track để bắt đầu lại, đồng thời đưa Channels, Smoothing và Motion Gain về mặc định. Keyframe đã Apply trên Timeline được giữ nguyên.

## Tính năng

- **Tracking hai chiều:** chọn vùng tại một Frame mốc, tự Track ngược về đầu và tiến đến cuối phần clip trên Timeline.
- **Position / Scale / Rotation:** chọn riêng hoặc kết hợp bằng checkbox.
- **Apply linh hoạt:** Graphic không cần dài bằng video; chỉ áp dụng vào phần giao với dữ liệu Tracking, tối thiểu 2 Frame.
- **Continue Tracking:** khi mất bám, tiếp tục bằng dữ liệu dự đoán, đánh dấu **Estimated** và hiển thị vùng chọn màu vàng.
- **Remove Tracking:** khôi phục các thuộc tính của lần Apply gần nhất trong phiên làm việc.
- **Reset All:** xóa Source, Target, vùng chọn, Preview và kết quả Track để bắt đầu lại; đưa Channels, Smoothing và Motion Gain về mặc định.
- **Preview:** xem vùng Tracking, tiến độ, Confidence và kết quả bằng thanh trượt.
- **Advanced:** Smoothing, Motion Gain và xuất dữ liệu JSON.
- **GitHub Updates:** tự kiểm tra Release mới khi mở panel.
- **Runtime tích hợp:** có sẵn cho Windows, Mac Apple Silicon và Mac Intel; không cần cài riêng Python, OpenCV hoặc NumPy. Video được xử lý trên máy.

## Yêu cầu

- Windows 64-bit hoặc macOS Apple Silicon/Intel, Adobe Premiere Pro 2026 (26.x), có CEP 12.
- Engine Mac đã kiểm thử trên runner macOS 26 (Apple Silicon) và macOS 15 (Intel); Premiere/Gatekeeper trên máy Mac thực tế cần kiểm chứng riêng.
- Video có tốc độ Frame cố định (CFR), pixel vuông, tốc độ phát 100%, không phát ngược.
- Nếu video đã dùng speed ramp, Warp Stabilizer hoặc Scale to Frame Size, hãy xuất thành video trước khi Tracking.

**Đây là bản beta CEP chưa ký số.** Máy mới cần cho phép extension CEP phát triển. Bộ cài chỉ kiểm tra thiết lập này và thông báo nếu chưa đáp ứng; không tự thay đổi registry.

## Tải và cài đặt

### Windows

1. Mở [Latest Release](https://github.com/evolvestudiowork-gif/pr-track-2d/releases/latest).
2. Trong **Assets**, tải `PR-Track-2D-<version>-Windows-Standalone.zip`.
3. Giải nén **toàn bộ** ZIP vào một thư mục.
4. Đóng Premiere, chạy **Install-PRTrack.cmd**.
5. Mở Premiere → **Window → Extensions → PR Track 2D**.

Không chọn gói **Source code (zip)** hoặc **Source code (tar.gz)** mà GitHub tự tạo. Bộ cài standalone nằm trong ZIP được đính kèm riêng ở Assets.

Không chạy bộ cài ngay bên trong ZIP và không tách file EXE khỏi thư mục runtime.

### macOS

Trong [Latest Release](https://github.com/evolvestudiowork-gif/pr-track-2d/releases/latest), tải đúng gói theo máy:

- **Apple Silicon (M1/M2/M3/M4…):** `PR-Track-2D-<version>-macOS-arm64-Standalone.zip`.
- **Intel:** `PR-Track-2D-<version>-macOS-x86_64-Standalone.zip`.

Giải nén toàn bộ bằng Finder, đóng Premiere rồi mở **Install-PRTrack.command**. Không cần cài Python. CEP chạy qua Rosetta cần gói x86_64.

Bản Mac chưa có Developer ID/notarization; macOS có thể chặn file tải từ Internet. Installer không gỡ quarantine hoặc tắt Gatekeeper, và không tự bật CEP development mode.

## Cách sử dụng

### 1. Chọn Source và Frame mốc

- Chọn video trên Timeline. Có thể dùng nguyên clip hoặc cắt sẵn đoạn cần Track.
- Đặt Playhead tại **bất kỳ Frame nào bên trong clip** có vật thể rõ.
- Bấm **Use Selected Clip**.
- Nếu đổi Playhead sau khi lấy Source, bấm **Update Frame** rồi khoanh lại vùng.

### 2. Tracking

- Kéo chuột khoanh vùng có chi tiết rõ trong Preview; tránh lấy quá nhiều nền.
- Chọn **Position**, **Scale**, **Rotation** hoặc kết hợp các thuộc tính cần dùng.
- Chọn **Backward**, **Track Both** hoặc **Forward**. Track Both phân tích theo cả hai chiều từ Frame mốc.

Plugin phân tích từ Frame mốc đến cuối clip, rồi từ Frame mốc ngược về đầu clip. Kết quả được ghép theo đúng thứ tự Timeline và giới hạn trong phần clip đã cắt.

**Stop** hủy lượt đang chạy; hiện chưa giữ kết quả của lượt bị hủy để Apply.

### 3. Xem lại và Apply

- Dùng thanh trượt để kiểm tra kết quả, đặc biệt các Frame **Estimated**.
- Tạo hoặc chọn Text / Graphic trên Timeline.
- Nếu Graphic phủ Frame mốc, đặt chữ tại **Frame mốc** trước khi Apply.
- Nếu Graphic không phủ Frame mốc, đặt chữ tại **Frame đầu phần giao** giữa Graphic và đoạn Tracking.
- Chọn Graphic, bấm **Use Selected Graphic**, rồi **Apply**.

Graphic không cần dài bằng video. Phần giao với dữ liệu Tracking cần có ít nhất **2 Frame**.

Với Caption, chuyển sang Graphic trước khi Apply. Plugin di chuyển cả Graphic clip; các lớp bên trong cùng Graphic sẽ đi cùng nhau.

### 4. Remove Tracking

Bấm **Remove Tracking** để gỡ các Keyframe của lần Apply gần nhất và khôi phục giá trị ban đầu của các thuộc tính đã áp dụng.

Remove Tracking chỉ nhớ lần Apply gần nhất trong phiên hiện tại. Nếu các Keyframe đó đã được chỉnh sửa thủ công, plugin sẽ từ chối tự gỡ để bảo vệ thay đổi.

### 5. Reset All khi cần Track lại

Bấm **Reset All** để dọn dữ liệu trong panel rồi chọn Source và khoanh vùng lại. Nếu đang Tracking, bấm **Stop** trước khi Reset.

Reset All giữ nguyên Keyframe đã Apply trên Timeline và vẫn giữ khả năng **Remove Tracking** cho lần Apply gần nhất. Cấu hình Python và Updates được giữ nguyên.

## Kiểm tra cập nhật

Trong **Updates**, nhập Repository:

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

## Trạng thái kiểm thử và phát hành

- Bản **v0.5.1** đã đạt **70 kiểm thử tự động** và kiểm tra engine standalone trên Windows, Mac Apple Silicon và Mac Intel.
- Engine Mac được build và kiểm thử native qua GitHub Actions. Chưa xác nhận trực tiếp toàn bộ workflow và giao diện trong Premiere.
- Các gói hiện là **beta CEP chưa ký số**; bản Mac chưa có Developer ID/notarization.
- **Stop** hiện hủy lượt đang chạy, chưa giữ phần dừng giữa chừng để Apply.

Các yêu cầu cài đặt và giới hạn chung được duy trì trong README này. [Release notes](https://github.com/evolvestudiowork-gif/pr-track-2d/releases) tập trung vào tính năng mới, thay đổi và lỗi đã sửa của từng bản.

## Báo lỗi

Tạo [Issue](https://github.com/evolvestudiowork-gif/pr-track-2d/issues) kèm phiên bản plugin, Premiere, nội dung lỗi và thao tác trước khi lỗi xảy ra. Nếu thuận tiện, bổ sung ảnh vùng khoanh hoặc đoạn video mẫu ngắn.
