# Các quyết định & giả định

Ghi lại những chỗ đặc tả chưa rõ hoặc phải điều chỉnh khi triển khai (quy tắc 0.9 trong CLAUDE.md).

## Thương hiệu
- Theo yêu cầu: mọi tham chiếu tới `vnanet.vn` / `vnanet` đổi thành **tintucvietnam** (`tintucvietnam.vn`).
- Không dùng tên, logo "Thông Tấn Xã Việt Nam / TTXVN" (tài sản có bản quyền, tránh mạo danh). Trang dùng tên **Tin Tức Việt Nam** (viết tắt **TTVN**), cấu hình qua `SITE_NAME` và `src/lib/config.ts`. Mẫu tiêu đề: `{Tiêu đề} - {Danh mục} - Tin Tức Việt Nam (TTVN)`; chú thích ảnh kết thúc bằng `Ảnh: {Tác giả} - TTVN`.

## Dữ liệu
- **Category có 2 khóa**: `id` (nội bộ, tự tăng) và `publicId` (số trên URL theo bảng 3.1). Lý do: ID công khai bị trùng giữa các nhóm (Văn hóa = 1, Trong nước = 1). Ràng buộc `@@unique([type, publicId, locale])`.
- Bổ sung cột: `User.require2fa`, `Session.pending2fa`, `Article.holderId` (người đang nhận duyệt), `Article.correctedAt`, `ArticleStatusLog.version`; bảng `ArticleTopic`, `ArticleDailyView` (đếm lượt xem theo ngày cho "xem nhiều 3 ngày"), `KvEntry`.
- Mỗi lần tăng `version` (lưu nội dung hoặc chuyển trạng thái) đều tạo một `ArticleRevision` cùng số version.
- Seed: 76 bài (63 tin/nguồn ngoài ở đủ 11 trạng thái, 6 bộ ảnh, 3 đồ họa, 2 megastory, 2 chuyên đề), ảnh placeholder sinh bằng sharp.

## Hạ tầng
- **Redis tùy chọn**: `src/lib/kv.ts` dùng Redis nếu kết nối được, ngược lại dùng bảng `KvEntry` (khóa biên tập TTL 15 phút, rate-limit, chống nhắc trùng). Đếm lượt xem ghi thẳng Postgres.
- **Không dùng BullMQ**: job hẹn giờ là route `POST /api/cron/publish` (xác thực HMAC), gọi mỗi phút bởi `pnpm worker` hoặc cron hạ tầng. Gọi qua HTTP để Next.js revalidate cache. Job idempotent (cập nhật có điều kiện theo version).
- **Lưu file**: driver ổ đĩa cục bộ `storage/media`, phục vụ qua `/media/[...path]`. Thay `putObject/readObject` trong `src/lib/storage` để chuyển sang S3/MinIO.
- **Postgres không cần Docker**: `pnpm db:local` chạy Postgres 16 nhúng (gói `embedded-postgres`, khởi động qua `pg_ctl` để chạy được cả dưới quyền Administrator trên Windows). `docker-compose.yml` vẫn giữ cho môi trường có Docker.

## Xác thực
- **Không dùng Auth.js**: Credentials provider của Auth.js không hỗ trợ session lưu DB. Tự triển khai: cookie `httpOnly` chứa token ngẫu nhiên, DB lưu SHA-256 của token; hết hạn 8 giờ / 30 phút không thao tác; phiên "chờ 2FA" riêng (10 phút) và đổi token khi qua 2FA (chống session fixation).
- Middleware chỉ áp giới hạn IP (`CMS_ALLOWED_IPS`) và `X-Robots-Tag`; kiểm tra phiên + quyền nằm ở `requireUser()` / `requireActionUser()` trong mọi trang và server action (xem mục "Redirect & truy cập qua IP").
- Captcha: phép cộng ký HMAC (không phụ thuộc dịch vụ ngoài), bật sau 3 lần sai (theo IP hoặc theo tài khoản).
- Tài khoản demo duyệt/admin được bật sẵn TOTP với secret dùng chung (chỉ dev) để test nhanh; xem README.

## Quy trình
- "Người đã duyệt cấp 1 không được duyệt cấp 2 cùng phiên bản" được áp dụng chặt hơn: không được duyệt cấp 2 **cùng bài** khi `l1ReviewerId` là mình.
- Đính chính: cấp 2 sửa trực tiếp bài PUBLISHED; lưu nội dung + chuyển `CORRECT` trong cùng transaction, ghi chú hiển thị cuối bài.
- Hủy hẹn giờ / đưa lại vào duyệt cấp 2 đặt lại `l1ApprovedAt` làm mốc tính thời gian chờ.
- Khóa biên tập của người thao tác được nhả **ở server** ngay sau mỗi lần chuyển trạng thái, không chỉ dựa vào client (người dùng có thể đăng xuất/đóng tab ngay sau khi gửi duyệt, khiến BTV phải chờ hết TTL 15 phút). Phát hiện khi chạy E2E.
- Bài nguồn ngoài: `externalUrl` phải `https://` và thuộc domain của một `Source.homepage`.

## i18n
- Không dùng `next-intl`: từ điển nhỏ cho phần khung giao diện vi/en (`src/lib/i18n.ts`). `/en` hiển thị khung tiếng Anh trên cùng dữ liệu (seed chỉ có nội dung tiếng Việt). FR/ES/中文/RU là liên kết giữ chỗ.

## Trả 410 cho bài đã gỡ
- App Router page không đặt được status 410, nên URL bài viết/bộ ảnh/megastory là route handler (`serveArticle()` trong `src/app/_public/article-route.ts`): bài đã gỡ → 410, không tồn tại/chưa xuất bản → 404, sai slug → 308 về URL chuẩn, còn lại tự fetch trang nội bộ `/{locale}/render/article/{id}` (chỉ trả lời khi có header bí mật). Production cần đặt `INTERNAL_ORIGIN` và `INTERNAL_RENDER_TOKEN` (khi chạy nhiều instance).
- Root layout không đọc `headers()` để trang công khai giữ ISR 60 giây; `lang="en"` được đặt phía client cho `/en`.

## Đường dẫn CMS: /Admin (theo yêu cầu, thay cho /cms của đặc tả)
- Route nằm ở `src/app/Admin/`. `/cms/...` chuyển hướng vĩnh viễn sang `/Admin/...` (`next.config.ts`) để link cũ và thông báo đã lưu vẫn dùng được; `/admin` (khác hoa thường) được middleware rewrite nội bộ sang `/Admin`. API nội bộ giữ `/api/cms/*`; thư mục mã nguồn `components/cms`, `lib/cms` giữ tên.

## Quảng cáo (banner 2 bên, popup) — bổ sung ngoài đặc tả
- Bảng `Ad` (vị trí `LEFT` / `RIGHT` / `POPUP`, ảnh lấy từ thư viện media, liên kết, lịch bắt đầu/kết thúc, chỉ trang chủ, tần suất popup, thứ tự, lượt bấm). Quản lý tại `/Admin/ads`, quyền `ads.manage` (Duyệt cấp 2 + Quản trị, như quản lý đối tác); mọi thay đổi ghi audit log.
- Banner 2 bên rộng 160px, cố định bên ngoài cột nội dung 1200px nên chỉ hiện khi màn hình ≥ 1560px (không che nội dung, không hiện trên mobile/tablet). Popup: mỗi lần hiện tối đa 1 (cái đứng đầu danh sách hợp tần suất), sau 1 giây; đóng bằng ×, Esc hoặc bấm nền. Tần suất lưu ở `sessionStorage`/`localStorage` của người xem (bị chặn thì popup có thể hiện lại — chấp nhận được).
- Lịch chạy được client kiểm tra mỗi phút, nên quảng cáo bật/tắt đúng giờ dù trang công khai được cache ISR 60 giây; thêm/sửa quảng cáo hiện ra trong ≤ 1 phút.
- Bấm quảng cáo đi qua `/go/{id}` (đếm lượt bấm, chuyển 302 tới liên kết đã lưu; đích chỉ lấy từ DB nên không thành open redirect). Liên kết chỉ nhận `https://`, `http://` hoặc đường dẫn nội bộ `/...`. Chưa đếm lượt hiển thị (tránh ghi DB mỗi lượt xem).
- Phía công khai tránh chữ "ad"/"banner" trong URL, tên class, nhãn ARIA (`/go/`, `Promos`) vì trình chặn quảng cáo sẽ ẩn chúng. Link có `rel="sponsored"`.

## Tài khoản chủ hệ thống
- Theo yêu cầu, `pv1@demo.vn` được thay bằng tài khoản chủ (email/mật khẩu/tên lấy từ `SEED_OWNER_*` trong `.env`, không ghi vào mã nguồn) có đủ 4 vai trò và phạm vi mọi danh mục, để sửa được mọi bài (bài đã đăng sửa ở chế độ đính chính). Quy tắc tách biệt người duyệt vẫn áp dụng: không tự duyệt bài do chính mình viết.
- Vì có vai trò duyệt/admin nên bắt buộc 2FA (mục 4.1); tài khoản được tạo với 2FA **chưa thiết lập** để chủ tài khoản tự quét QR bằng ứng dụng của mình, không dùng khóa demo dùng chung.
- Test dùng `pv2@demo.vn` làm phóng viên.

## Redirect & truy cập qua IP
- Next.js đổi host `127.0.0.1` thành `localhost` trong mọi `Location` phát ra từ middleware → người dùng bị chuyển sang host khác và mất cookie phiên. Vì vậy middleware **không redirect**: `/` → `/vi` khai báo trong `next.config.ts` (`redirects()`), `/cms` chưa đăng nhập do `requireUser()` chuyển về `/cms/login`; route handler dùng `Location` tương đối (`src/lib/http.ts`).
- Cookie phiên có cờ `secure` ở production; trình duyệt chấp nhận trên `http://127.0.0.1`/`localhost`, nhưng truy cập qua IP LAN bằng HTTP sẽ không đăng nhập được — cần HTTPS.

## URL
- Không dùng dấu `/` cuối (`/vi/tin-tuc/chinh-tri-11`) để thống nhất với Next.js; bài viết vẫn theo mẫu `.../{slug}-{id}.html`.
