# Phát triển PR Track 2D

PR Track 2D là một panel CEP 12 cho Premiere Pro. Panel (HTML/JS) điều khiển Premiere qua ExtendScript và gọi một engine Python/OpenCV để Track. Bản phát hành đóng gói engine thành file chạy độc lập (PyInstaller), nên người dùng không cần cài Python.

## Cấu trúc

| Đường dẫn                    | Vai trò                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `extension/CSXS/manifest.xml` | Khai báo extension, phiên bản Premiere hỗ trợ.                                                   |
| `extension/index.html`, `style.css` | Giao diện panel ba bước Source → Track → Apply.                                            |
| `extension/js/panel.js`      | Điều phối: trạng thái, các thao tác, gọi host và engine.                                         |
| `extension/js/controls.js`   | Logic thuần: bước nào xong, nút nào bật, vì sao chưa Apply được.                                 |
| `extension/js/mapping.js`    | Đổi kết quả Track (pixel nguồn) thành Keyframe của Graphic.                                      |
| `extension/js/preview.js`    | Vẽ Preview, vùng chọn và quỹ đạo.                                                                |
| `extension/js/bridge.js`     | Gọi ExtendScript và chạy engine.                                                                 |
| `extension/js/messages.js`   | Toàn bộ chữ hiển thị trong panel.                                                                |
| `extension/js/theme.js`      | Lấy màu và cỡ chữ theo giao diện Premiere.                                                       |
| `extension/js/updates.js`    | Kiểm tra bản mới qua GitHub Releases.                                                            |
| `extension/jsx/host.jsx`     | ExtendScript (ES3): đọc clip, render Nested Sequence, ghi và gỡ Keyframe.                        |
| `extension/engine/tracker.py` | Engine: Lucas–Kanade, RANSAC, ECC/template, khôi phục bằng ORB.                                 |
| `scripts/`                   | Build engine, đóng gói ZIP, bộ cài, đồng bộ phiên bản, changelog.                                |
| `tests/`                     | Test Node cho panel/host/mapping và test Python cho engine.                                      |

## Chạy kiểm tra

Cần Node 22 và Python 3.11 có `opencv-python-headless` và `numpy` (xem `scripts/requirements-build.txt`).

```sh
npm ci
npm run check      # cú pháp JS và số phiên bản đồng bộ
npm run lint       # Prettier và Black
npm test           # test Node
npm run test:engine
```

`npm run format` định dạng lại toàn bộ code.

## Chạy thử trong Premiere

1. Bật extension chưa ký số (xem mục Cài đặt trong [README](../README.md)).
2. Tạo symlink hoặc chép thư mục `extension` vào thư mục extension CEP của người dùng với tên `vn.prtrack.panel`:
   - macOS: `~/Library/Application Support/Adobe/CEP/extensions/`
   - Windows: `%APPDATA%\Adobe\CEP\extensions\`
3. Khi chạy từ mã nguồn (không có `extension/runtime`), panel dùng Python trên máy. Chọn đường dẫn Python trong mục **Advanced** nếu cần.

Để mở DevTools cho panel, đặt file `.debug` cạnh `CSXS/` với cổng tùy chọn, rồi mở `http://localhost:<cổng>`.

## Phát hành

Xem [GITHUB-RELEASES.md](../GITHUB-RELEASES.md). Tóm tắt: ghi thay đổi vào CHANGELOG, `npm version 0.x.y`, push kèm tag, tạo Release nháp, chạy workflow **Build release assets**, rồi Publish.

## Đóng góp

Pull request và Issue đều được chào đón. Trước khi gửi PR, chạy đủ các lệnh kiểm tra ở trên và ghi thay đổi người dùng thấy được vào mục **Chưa phát hành** trong [CHANGELOG.md](../CHANGELOG.md).

Mã nguồn phát hành theo giấy phép [MIT](../LICENSE).
