# Phát hành PR Track 2D

Mỗi bản phát hành gồm ba ZIP standalone (Windows, macOS arm64, macOS x86_64) trong cùng một GitHub Release.

## Trong lúc phát triển

- Ghi mọi thay đổi người dùng thấy được vào mục **Chưa phát hành** trong [CHANGELOG.md](CHANGELOG.md).
- Kiểm tra cục bộ: `npm ci`, rồi `npm run check`, `npm run lint`, `npm test`, `npm run test:engine`. `npm run format` định dạng lại code.

## Phát hành một phiên bản

1. Thử bản hiện tại trong Premiere trên Windows và Mac.
2. Kiểm tra mục **Chưa phát hành** trong CHANGELOG.md đã đủ và đúng.
3. Trên `main`, với working tree sạch:

   ```sh
   npm version 0.x.y
   git push --follow-tags
   ```

   `npm version` cập nhật package.json, đồng bộ số phiên bản vào manifest, host.jsx, bridge.js, updates.js, tracker.py và mục Updates; đổi **Chưa phát hành** trong CHANGELOG.md thành `0.x.y` kèm ngày; rồi tạo commit và tag `v0.x.y`. Lệnh dừng lại nếu CHANGELOG chưa có nội dung.

4. **ZIP macOS:** trên GitHub, **Actions → Build macOS standalone → Run workflow**. Khi xong, tải hai Artifact và giải nén để lấy `PR-Track-2D-0.x.y-macOS-arm64-Standalone.zip` và `...-macOS-x86_64-Standalone.zip`.
5. **ZIP Windows:** trên máy Windows x64, trong checkout của tag:

   ```sh
   python -m pip install -r scripts/requirements-build.txt
   python scripts/build_runtime.py
   python scripts/verify_runtime.py
   python scripts/package.py
   ```

   ZIP nằm trong `dist/`.

6. GitHub → **Releases → Draft a new release**, chọn tag `v0.x.y`, tiêu đề `PR Track 2D v0.x.y`. Ghi chú phát hành lấy bằng:

   ```sh
   node scripts/changelog.cjs notes
   ```

   Upload ba ZIP, rồi **Publish release** (không chọn Pre-release).

Chỉ sau khi Publish, panel mới báo có bản mới.

## Cách panel kiểm tra cập nhật

Panel gọi [GitHub Latest Release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) khi mở và khi bấm **Check for Updates**. Panel chỉ báo khi có phiên bản mới hơn và Release có ZIP đúng tên theo hệ điều hành:

- `PR-Track-2D-<version>-Windows-Standalone.zip`
- `PR-Track-2D-<version>-macOS-arm64-Standalone.zip`
- `PR-Track-2D-<version>-macOS-x86_64-Standalone.zip`

Nút tải mở trang Release trong trình duyệt; người dùng tải ZIP, đóng Premiere và chạy bộ cài. Panel không tự tải hay tự cài. Mất mạng hoặc bị GitHub giới hạn lượt gọi chỉ ảnh hưởng mục Updates; Tracking vẫn chạy offline.

Repo mặc định là `evolvestudiowork-gif/pr-track-2d` (hằng số `DEFAULT_REPO` trong `extension/js/updates.js`).

## Không đưa vào Git

`.build-env`, `build/`, `dist/`, `extension/runtime/`, `extension/config.json`, `node_modules/`. ZIP "Source code" mà GitHub tự tạo cho mỗi tag không có runtime, không dùng để cài.
