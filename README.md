# Tin Tức Việt Nam — cổng tin tức + CMS duyệt bài 2 cấp

Next.js 15 (App Router, TypeScript strict) · Tailwind · Prisma + PostgreSQL 16 · Tiptap · sharp.
Đặc tả đầy đủ: [`CLAUDE.md`](CLAUDE.md). Các điều chỉnh so với đặc tả: [`docs/DECISIONS.md`](docs/DECISIONS.md).

- Trang công khai: http://127.0.0.1:5500/vi (và `/en`) — bản production; `pnpm dev` chạy ở http://localhost:3000
- CMS: http://127.0.0.1:5500/Admin

## Chạy dự án

```bash
pnpm install
```

Cơ sở dữ liệu — chọn **một** trong hai cách:

```bash
docker compose up -d          # có Docker: postgres, redis, minio, mailpit
```

```bash
pnpm db:local                 # không có Docker: Postgres 16 nhúng (giữ terminal này mở)
```

Sau đó:

```bash
pnpm prisma migrate deploy
pnpm db:seed
pnpm dev
```

### Chạy bản production bằng một lệnh

Nhấp đúp `start.cmd`, hoặc:

```bash
pnpm serve
```

Lệnh này bật Postgres nhúng → áp migration → build (nếu chưa có) → chạy web + CMS tại địa chỉ trong `SITE_URL` (mặc định `http://127.0.0.1:5500`) → chạy worker hẹn giờ đăng. Ctrl+C dừng tất cả. Sau khi sửa code, build lại bằng:

```bash
pnpm serve --build
```

Worker chạy riêng (chỉ cần khi dùng `pnpm dev` / `pnpm start` thay vì `pnpm serve`):

```bash
pnpm worker
```

Redis, SMTP là tùy chọn: không có Redis thì khóa biên tập / rate-limit dùng bảng `KvEntry`; không có SMTP thì email được in ra log.

## Tài khoản demo

Mật khẩu chung: `Demo@123456` (chỉ dùng cho môi trường dev).

| Email | Vai trò | Phạm vi duyệt |
|---|---|---|
| `admin@demo.vn` | Quản trị hệ thống | — |
| `tbt@demo.vn` | Duyệt cấp 2 (TBT) | toàn bộ |
| `btv.chinhtri@demo.vn` | Duyệt cấp 1 | Chính trị, Xã hội, Pháp luật |
| `btv.kinhte@demo.vn` | Duyệt cấp 1 | Kinh tế, KH-CN, Môi trường |
| `pv2@demo.vn` | Phóng viên | — |
| `SEED_OWNER_EMAIL` trong `.env` (mặc định `pv1@demo.vn`) | Chủ hệ thống: Phóng viên + Duyệt cấp 1, 2 + Quản trị | toàn bộ |

Tài khoản chủ hệ thống dùng mật khẩu `SEED_OWNER_PASSWORD` trong `.env` (để trống thì dùng mật khẩu demo) và **chưa bật 2FA**: lần đăng nhập đầu sẽ chuyển tới trang thiết lập 2FA để quét mã QR bằng ứng dụng xác thực của chính bạn.

Các tài khoản duyệt và admin bắt buộc 2FA và đã được bật sẵn với khóa TOTP dev `KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD` (thêm vào Google/Microsoft Authenticator), hoặc dùng mã dự phòng `DEMO000001`…`DEMO000004` (mỗi mã dùng một lần). Các giá trị này nằm trong `prisma/seed.ts`.

## Quảng cáo (banner 2 bên, popup)

Vào **CMS → Quảng cáo** (`/Admin/ads`, tài khoản Duyệt cấp 2 hoặc Quản trị):

1. Bấm ô ảnh để chọn ảnh có sẵn hoặc tải ảnh mới (banner 2 bên rộng 160px, ví dụ 160×600; popup khoảng 600×500).
2. Chọn vị trí **Banner bên trái / bên phải / Popup**, nhập liên kết khi bấm (tùy chọn), lịch bắt đầu – kết thúc (tùy chọn), "Chỉ hiện ở trang chủ", và tần suất popup (mỗi phiên / mỗi ngày / mỗi lần mở trang).
3. Bấm **Thêm quảng cáo**. Trang công khai cập nhật trong vòng 1 phút.

Danh sách bên dưới cho phép kéo-thả sắp xếp, bật/tắt, sửa, xóa và xem số lượt bấm. Banner 2 bên chỉ hiện trên màn hình rộng từ 1560px (không che nội dung, không hiện trên điện thoại).

## Kiểm thử

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
pnpm test:integration         # luồng duyệt 2 cấp trên DB thật (cần DB đã seed)
```

```bash
pnpm exec playwright install chromium && pnpm test:e2e   # cần server đang chạy (đọc SITE_URL), DB vừa seed
```

## Cấu trúc chính

```
prisma/                 schema, migrations (kèm trigger tsvector + unaccent), seed
scripts/                dev-db.ts (Postgres nhúng), worker.ts (job hẹn giờ)
src/app/[locale]/       trang công khai
src/app/Admin/          CMS tại /Admin (đăng nhập, 2FA, soạn bài, hàng đợi duyệt, quản trị)
src/app/api/            cron, notifications, media, xuất CSV audit log
src/lib/workflow/       state machine + transitionArticle() — nơi duy nhất đổi trạng thái bài
src/lib/rbac/           ma trận quyền + can()
src/lib/auth/           mật khẩu argon2id, TOTP, session DB, captcha, rate limit
src/lib/repo/public.ts  truy vấn public (chỉ bài PUBLISHED)
tests/                  unit (Vitest), integration, e2e (Playwright)
```
