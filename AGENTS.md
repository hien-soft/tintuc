# AGENTS.md — Tin Tức Việt Nam (TTVN): cổng tin tức + CMS duyệt bài 2 cấp

> Tài liệu bàn giao dự án để tiếp tục phát triển trên **Google Antigravity** (hoặc bất kỳ AI agent / lập trình viên nào).
> Đây là **đặc tả theo hiện trạng (as-built)**, cập nhật 04/11/2026: mô tả đúng những gì mã nguồn đang làm.
> Những phần trong đặc tả gốc mà mã nguồn **không dùng** đã được bỏ và liệt kê ở mục 19 để không ai triển khai lại nhầm.
>
> Phạm vi gồm hai phần:
> 1. **Trang công khai**: cổng tin tức theo cấu trúc tintucvietnam.vn, có tiếng Việt `/vi` và tiếng Anh `/en`.
> 2. **CMS tại `/Admin`**: đăng nhập có 2FA, soạn bài, **duyệt bài qua 2 cấp** rồi mới xuất bản, quản lý quảng cáo.
>
> ⚠️ Không dùng tên, logo, nội dung hoặc ảnh của Thông tấn xã Việt Nam (TTXVN), vì đó là tài sản có bản quyền. Thương hiệu của dự án là **Tin Tức Việt Nam (TTVN)**. Mọi dữ liệu mẫu đều là dữ liệu giả do seed tự sinh.

---

## 0. Quy tắc bắt buộc khi sửa mã

1. Giao diện, thông báo lỗi và nội dung seed viết bằng **tiếng Việt**. Tên biến, hàm, bảng và commit viết bằng **tiếng Anh**.
2. Sau mỗi thay đổi phải chạy `pnpm lint`, `pnpm typecheck` và `pnpm test`. Nếu thay đổi chạm tới quy trình duyệt, chạy thêm `pnpm test:integration` và `pnpm test:e2e`.
3. **Luôn kiểm tra quyền ở server.** Mọi server action và route handler của CMS phải gọi `requireUser()` / `requireActionUser()` rồi `can()`. Ẩn nút ở UI không thay thế được bước này.
4. Trạng thái bài viết **chỉ được đổi qua** `transitionArticle()` trong `src/lib/workflow/transition.ts`. Không cập nhật cột `status` ở bất kỳ chỗ nào khác.
5. Mọi lần lưu bài và mọi lần chuyển trạng thái phải ghi **audit log** (`writeAudit`) và tạo **revision** (`createRevision`).
6. Dùng TypeScript strict, không dùng `any`. Validate mọi input bằng Zod.
7. Chỉ thay đổi DB qua Prisma migration. **Không sửa migration đã áp dụng**, kể cả 3 migration hiện có.
8. Không commit secret. Mọi biến môi trường phải khai báo trong `.env.example`.
9. Khi yêu cầu chưa rõ, chọn phương án an toàn hơn và ghi giả định vào `docs/DECISIONS.md`.
10. Route handler phải dùng `Location` **tương đối** (`relativeRedirect` trong `src/lib/http.ts`). Middleware **không được redirect**; xem lý do ở mục 15.

---

## 1. Stack thực tế

| Lớp | Công nghệ đang dùng |
|---|---|
| Framework | Next.js **15.5.28** (App Router), React 19.1, TypeScript 5.9 strict |
| UI | Tailwind CSS 3.4. Component tự viết cho cả CMS (`components/cms/ui.tsx`) và trang công khai |
| i18n | Từ điển tự viết `src/lib/i18n.ts` (vi/en), route `/vi` và `/en`. CMS chỉ có tiếng Việt |
| DB | PostgreSQL 16 + Prisma **6.19.3** (bật preview `fullTextSearchPostgres`) |
| Postgres khi dev | Gói `embedded-postgres` 16 (Postgres nhúng, không cần Docker), khởi động qua `pg_ctl` |
| Xác thực | Tự triển khai: session lưu DB, cookie `httpOnly`. Mật khẩu băm **argon2id** (`@node-rs/argon2`). 2FA TOTP bằng `otplib`, QR bằng `qrcode` |
| Trình soạn thảo | Tiptap 2.27: starter-kit, image, link, table, youtube |
| Ảnh | `sharp` (resize sang webp, xóa metadata/EXIF). File lưu trên ổ đĩa `storage/media` |
| Tìm kiếm | Postgres full-text: `tsvector` + `unaccent` + trigger |
| KV / khóa / rate limit | Redis (`ioredis`) khi có `REDIS_URL` và kết nối được; nếu không thì dùng bảng `KvEntry` |
| Job hẹn giờ | `pnpm worker`: cứ 60 giây gọi `POST /api/cron/publish`, xác thực bằng HMAC |
| Email | `nodemailer` qua `SMTP_URL`. Không có SMTP thì in nội dung email ra log |
| Diff | Gói `diff` |
| Sanitize | `sanitize-html` |
| Kiểm thử | Vitest (unit + integration), Playwright (e2e, Chromium) |
| Quản lý gói | pnpm |

---

## 2. Chạy dự án

```bash
pnpm install
```

### 2.1 Chạy production bằng một lệnh (cách đang dùng)

Nhấp đúp `start.cmd` hoặc chạy:

```bash
pnpm serve            # thêm --build để build lại sau khi sửa code
```

`scripts/serve.ts` làm lần lượt:
1. Bật Postgres nhúng (`storage/pgdata`, cổng 5432, user/pass/db `news`/`news`/`news`).
2. Chạy `prisma migrate deploy`.
3. Chạy `next build` nếu chưa có `.next/BUILD_ID` hoặc khi có cờ `--build`.
4. Chạy `next start` với host/cổng lấy từ `SITE_URL` (hiện là `http://127.0.0.1:5500`).
5. Bật worker hẹn giờ.

Ctrl+C dừng tất cả, kể cả Postgres. `scripts/lib/postgres.ts` thử lại tối đa 3 lần và chờ cổng thật sự nhận kết nối, để xử lý trường hợp Postgres cũ còn đang tắt dở.

- Trang công khai: http://127.0.0.1:5500/vi (và `/en`)
- CMS: http://127.0.0.1:5500/Admin

### 2.2 Chạy dev

```bash
pnpm db:local                  # Postgres nhúng (giữ terminal mở)
pnpm prisma migrate deploy
pnpm db:seed                   # XÓA toàn bộ dữ liệu rồi seed lại
pnpm dev                       # http://localhost:3000
pnpm worker                    # job hẹn giờ (chỉ cần khi không dùng pnpm serve)
```

Máy có Docker có thể dùng `docker compose up -d` (postgres, redis, mailpit) thay cho `pnpm db:local`. Trên máy hiện tại Docker **không chạy được**, nên dùng Postgres nhúng.

### 2.3 Lệnh kiểm tra

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm test:integration          # luồng duyệt trên DB thật (cần DB đã seed)
pnpm exec playwright install chromium && pnpm test:e2e   # cần server đang chạy theo SITE_URL, DB vừa seed
```

---

## 3. Biến môi trường (`.env.example`)

| Biến | Bắt buộc | Ý nghĩa |
|---|:-:|---|
| `DATABASE_URL` | ✅ | `postgresql://news:news@localhost:5432/news` |
| `AUTH_SECRET` | ✅ | Khóa HMAC cho captcha, khóa cron, token render nội bộ |
| `APP_ENCRYPTION_KEY` | ✅ | 32 byte base64, dùng để mã hóa AES-GCM TOTP secret |
| `SITE_URL` | ✅ | URL gốc, cũng quyết định host/cổng của `pnpm serve`. Hiện là `http://127.0.0.1:5500` |
| `SITE_NAME` | | Mặc định "Tin Tức Việt Nam" |
| `PUBLIC_MEDIA_BASE_URL` | | Mặc định `/media` |
| `REDIS_URL` | | Không có hoặc không kết nối được thì dùng bảng `KvEntry` |
| `SMTP_URL`, `MAIL_FROM` | | Không có thì email chỉ in ra log |
| `CMS_ALLOWED_IPS` | | Danh sách IP được vào `/Admin`, cách nhau dấu phẩy. Để trống là không giới hạn |
| `REVIEW_SLA_L1_MINUTES` / `REVIEW_SLA_L2_MINUTES` | | Ngưỡng quá hạn chờ duyệt, mặc định 120 / 60 phút |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` / `SEED_OWNER_NAME` | | Tài khoản chủ hệ thống do seed tạo (mục 12) |
| `INTERNAL_ORIGIN`, `INTERNAL_RENDER_TOKEN` | | Cần khi chạy nhiều instance: origin và token để route bài viết gọi trang render nội bộ (mục 4.6) |
| `SOCIAL_FACEBOOK_URL`, `SOCIAL_YOUTUBE_URL`, `SOCIAL_TIKTOK_URL`, `SOCIAL_ZALO_URL` | | Link khối "Hoạt động của TTVN" trên trang chủ. Chỉ nhận `https://`; để trống thì ẩn kênh đó |

> `.env.example` đã khớp với mã nguồn: liệt kê đúng các biến ở bảng trên. Các biến `S3_*` đã bỏ vì mã nguồn không đọc (xem mục 19). Khi thêm biến mới, phải khai báo cả trong `.env.example`.

---

## 4. PHẦN A — Trang công khai

### 4.1 Danh mục (seed đúng bảng này)

Model `Category` có **2 khóa**: `id` là khóa nội bộ tự tăng, `publicId` là số xuất hiện trên URL. Lý do là ID công khai bị trùng giữa các nhóm, ví dụ Văn hóa = 1 và Trong nước = 1. Ràng buộc duy nhất: `@@unique([type, publicId, locale])` và `@@unique([slug, locale])`.

**Chủ đề (type `NEWS`):**

| Tên | slug | publicId | Cột footer |
|---|---|---|---|
| Chính trị | `chinh-tri` | 11 | 1 |
| Kinh tế | `kinh-te` | 4 | 1 |
| An ninh - Quốc phòng | `an-ninh-quoc-phong` | 16 | 1 |
| Xã hội | `xa-hoi` | 14 | 1 |
| Văn hóa | `nghe-thuat-van-hoa-va-giai-tri` | 1 | 2 |
| Giáo dục | `giao-duc` | 5 | 2 |
| Khoa học - Công nghệ | `khoa-hoc-cong-nghe` | 13 | 2 |
| Thể thao | `the-thao` | 15 | 2 |
| Đời sống | `moi-quan-tam-con-nguoi` | 8 | 3 |
| Môi trường | `moi-truong` | 6 | 3 |
| Sức khỏe | `suc-khoe` | 7 | 3 |
| Thời tiết | `thoi-tiet` | 17 | 4 |
| Pháp luật | `toi-pham` | 2 | 4 |

**Tin thời sự (type `FEED`, là các tab trên trang chủ):** Trong nước `trong-nuoc` (1), Thế giới `the-gioi` (3), Kinh tế Việt Nam `kinh-te-viet-nam` (10), Kinh tế Thế giới `kinh-te-the-gioi` (1000).

**Ảnh (type `PHOTO`):** Ảnh thời sự trong nước `anh-thoi-su-trong-nuoc` (1014), Ảnh thời sự quốc tế `anh-thoi-su-quoc-te` (1049), Văn hoá & Xã hội `van-hoa-xa-hoi` (1017).

**Chuyên đề (model `Topic`):** Tin vắn kinh tế châu Á `tin-van-kinh-te-chau-a` (19), Business Wire `business-wire` (20).

**Nguồn (model `Source`):** TTVN, VietnamPlus, Baotintuc.vn, Bnews, TT&VH, Vietnam News. Mỗi nguồn có `homepage`, dùng làm danh sách domain hợp lệ cho bài nguồn ngoài.

### 4.2 URL

Các URL **không** có dấu `/` ở cuối. Hàm dựng URL nằm ở `src/lib/urls.ts`.

| Trang | Mẫu URL | File |
|---|---|---|
| Trang chủ | `/vi`, `/en` (`/` chuyển về `/vi`) | `app/[locale]/page.tsx` |
| Danh mục | `/vi/tin-tuc/{slug}-{publicId}` | `tin-tuc/[catSlug]/page.tsx` |
| Bài viết | `/vi/tin-tuc/{catSlug}-{catId}/{articleSlug}-{articleId}.html` | `tin-tuc/[catSlug]/[articleSlug]/route.ts` |
| Tin thời sự | `/vi/tin/{feedSlug}-{publicId}` | `tin/[feedSlug]/page.tsx` |
| Thế giới | `/vi/tin-the-gioi` | |
| Tin - Ảnh | `/vi/tin-anh` | |
| Ảnh | `/vi/anh`, `/vi/anh/{slug}-{publicId}`, `/vi/anh/{cat}/{storySlug}-{id}.html` | bộ ảnh dùng `route.ts` |
| Đồ họa | `/vi/graphic` | |
| Mega Story | `/vi/megastory`, `/vi/megastory/{slug}-{id}.html` | chi tiết dùng `route.ts` |
| Chuyên đề | `/vi/chuyen-de/{slug}-{id}` | |
| Video | `/vi/video` | trang giữ chỗ "Đang cập nhật" |
| Tìm kiếm | `/vi/search?q=&category=&source=&from=&to=&page=` | |
| RSS | `/vi/rss` (danh sách), `/rss/{catSlug}` (XML) | |
| Trang tĩnh | `/vi/trang/{slug}`, gồm `dieu-khoan-su-dung`, `lien-he`, `gioi-thieu` | |
| Bài nguồn ngoài | `/r/{id}` → đếm view → 302 tới `externalUrl` | `app/r/[id]/route.ts` |
| Click quảng cáo | `/go/{id}` → đếm click → 302 tới link | `app/go/[id]/route.ts` |
| Ảnh | `/media/{yyyy}/{MM}/{dd}/{id}/{thumb|stand|large}.webp` | `app/media/[...path]/route.ts` |
| SEO | `/sitemap.xml`, `/news-sitemap.xml` (48 giờ, tối đa 1000 bài), `/robots.txt` | |
| Đường dẫn khác dưới `/vi`, `/en` | 404 trong khung trang công khai | `[...rest]/page.tsx` |

### 4.3 Bố cục toàn cục

```
TOP BAR    : logo nhỏ + "Tin Tức Việt Nam" | đồng hồ "dd/MM/yyyy - HH:mm’ (GMT +7)" | VI · EN · FR · ES · 中文 · RU
             (FR/ES/中文/RU chỉ là link giữ chỗ)
HEADER     : logo lớn | menu 13 chủ đề (MobileMenu trên điện thoại)
MAIN NAV   : Trang chủ · Chính trị · Xã hội · Kinh tế · Thế giới · Ảnh · Video · Đồ họa · Mega Story · Thông tin nguồn | RSS | Tìm kiếm
QUICK LINKS: Thông tin nguồn · Điều hành tác nghiệp · Xembao.vn · Tra cứu thông tin · Tin · Tin - Ảnh · Ảnh
--- nội dung (cột 1200px) ---           + banner quảng cáo 2 bên + popup (mục 8)
PARTNERS   : dải logo đối tác (quản lý trong CMS)
FOOTER     : 4 cột danh mục · logo · bản quyền · địa chỉ · Trang chủ | Điều khoản sử dụng | Liên hệ
BACK TO TOP
```

Cấu hình menu nằm trong `src/components/public/nav.ts`. Các yêu cầu đã thực hiện: không hiện tiêu đề "Footer1..4", mọi link là đường dẫn tuyệt đối từ gốc, ẩn khối khi không có dữ liệu, không khóa zoom trên mobile.

### 4.4 Trang chủ (`revalidate = 60`)

| # | Khối | Nguồn dữ liệu |
|---|---|---|
| 1 | Tin mới nhất: ticker 5 tin, dừng khi hover | bài PUBLISHED mới nhất |
| 2 | Tiêu điểm ảnh: 1 bộ ảnh lớn + 5 bộ tiếp theo | slot `HOME_PHOTO_HERO` chọn trong CMS; nếu trống thì lấy bộ ảnh mới nhất |
| 3 | Chuyên đề: banner | Topic có `isFeatured` |
| 4 | Tin thời sự: 4 tab | theo feed |
| 5 | Lưới 13 danh mục: mỗi khối 1 tin chính có ảnh + 2 tin phụ | mới nhất theo danh mục, bài ghim (`isPinned`) đứng trước |
| 6 | Tin tức khác | |
| 7 | Tin xem nhiều: top 10 trong 3 ngày | bảng `ArticleDailyView` |
| 8 | Media tabs: Tất cả · Ảnh · Đồ họa · Tin - Ảnh | |
| 9 | Mega Story | |
| 10 | Hoạt động của TTVN | các biến `SOCIAL_*` |
| 11 | Tin vắn kinh tế châu Á | topic 19 |
| 12 | Business Wire | topic 20 |

### 4.5 Thẻ tin và thời gian
- Biến thể của `ArticleCard`: `lead` (ảnh 16:9 + tiêu đề lớn + meta), `list` (tiêu đề + meta), `ticker`.
- Meta có dạng `{thời gian} | {nguồn}`. Tên nguồn link tới `/vi/search?source={sourceSlug}`.
- Thời gian dưới 24 giờ hiển thị tương đối (`47 phút trước`, `3 giờ trước`); từ 24 giờ trở lên hiển thị `dd/MM/yyyy HH:mm`. Múi giờ `Asia/Ho_Chi_Minh`. Xem `src/lib/time.ts`.

### 4.6 Các trang chi tiết
- **Danh mục** (`app/_public/category.tsx`): breadcrumb, H1, 1 bài nổi bật + 4 bài lưới, danh sách 20 bài/trang (thumbnail, tiêu đề, sapo, meta), phân trang `?page=`, sidebar xem nhiều.
- **Bài viết, bộ ảnh, megastory** là **route handler** (`serveArticle()` trong `app/_public/article-route.ts`), vì App Router page không trả được status 410:
  - bài đã gỡ trả **410**;
  - bài không tồn tại hoặc chưa xuất bản trả **404**;
  - sai slug hoặc sai danh mục trả **308** về URL chuẩn;
  - còn lại, route tự fetch trang nội bộ `/{locale}/render/article/{id}`. Trang này chỉ trả lời khi request có header `x-ttvn-internal-render` mang token bí mật (`app/_public/internal-render.ts`).
- **Bài chữ** (`ArticleView`): breadcrumb, H1, meta (thời gian, tác giả, nguồn), sapo đậm, ảnh đại diện + chú thích, nội dung, ghi chú đính chính kèm thời gian (nếu có), tags, chia sẻ, bài liên quan, bài cùng danh mục.
- **Bộ ảnh** (`PhotoStoryView` + `PhotoGallery`): H1, gallery N ảnh (chú thích kết thúc bằng `Ảnh: {Tác giả} - TTVN`), các danh mục gắn kèm, sapo, danh sách từng ảnh có timestamp riêng, lightbox hỗ trợ vuốt, ảnh liên quan.
- **Đếm lượt xem**: `ViewBeacon` gọi `POST /api/public/view/{id}`. `recordView()` tăng `Article.viewCount` và `ArticleDailyView` của ngày hiện tại.
- **Tìm kiếm**: không phân biệt dấu. Trigger ghi `searchVector` với trọng số title A, sapo B, content C, qua hàm `immutable_unaccent` (có đổi `đ` thành `d`). Lọc được theo danh mục, nguồn và khoảng ngày.

### 4.7 SEO (`src/lib/seo.ts`)
- `<title>` theo mẫu `{Tiêu đề} - {Danh mục} - Tin Tức Việt Nam (TTVN)`.
- Có Open Graph (`og:type=article`, `og:image`, thời gian ISO +07:00), canonical và `hreflang` vi/en.
- JSON-LD: `NewsArticle` cho bài chữ, `ImageGallery` cho bộ ảnh.
- `robots.txt` chặn `/Admin`, `/admin`, `/cms`, `/api/`, `/r/`, `/go/`, `/vi/render/`, `/en/render/`.
- **Chỉ bài PUBLISHED được truy vấn ở public.** Mọi truy vấn đi qua `publishedWhere()` trong `src/lib/repo/public.ts`, và có test cho hàm này.
- Root layout không đọc `headers()`, để trang công khai giữ được ISR. `lang="en"` cho `/en` được đặt ở phía client (`HtmlLang`).

### 4.8 API công khai (GET, có cache)
`/api/public/articles/latest`, `/api/public/articles?category=&page=`, `/api/public/articles/most-viewed`, `/api/public/search?q=&source=&from=&to=`. Riêng `POST /api/public/view/{id}` dùng để đếm lượt xem.

### 4.9 i18n
`/en` dùng cùng dữ liệu nhưng khung giao diện bằng tiếng Anh. Seed chỉ có nội dung tiếng Việt. Từ điển nằm ở `src/lib/i18n.ts` (`dict(locale)`, `asLocale()`).

---

## 5. PHẦN B — CMS: đăng nhập và bảo mật

CMS nằm tại **`/Admin`** (thư mục `src/app/Admin`).
- `/cms/*` chuyển hướng 308 sang `/Admin/*` (khai báo trong `next.config.ts`).
- `/admin` viết khác hoa thường được middleware rewrite nội bộ sang `/Admin`.
- API nội bộ vẫn giữ đường dẫn `/api/cms/*`. Thư mục `components/cms` và `lib/cms` vẫn giữ tên cũ.

### 5.1 Luồng đăng nhập
1. `/Admin/login`: nhập email + mật khẩu. Có nút **Hiện/Ẩn mật khẩu** (`PasswordInput` trong `components/cms/AuthForms.tsx`).
2. Sau 3 lần sai (tính theo IP hoặc theo tài khoản) thì hiện **captcha phép cộng ký HMAC**, không phụ thuộc dịch vụ ngoài.
3. Nếu tài khoản có 2FA, hệ thống tạo phiên "chờ 2FA" (`Session.pending2fa`, sống 10 phút) và chuyển tới `/Admin/login/2fa` để nhập mã TOTP 6 số hoặc mã dự phòng. Qua 2FA thì **đổi token phiên** để chống session fixation.
4. Vai trò `EDITOR_L1`, `EDITOR_L2`, `ADMIN` **bắt buộc 2FA** (`User.require2fa`). Nếu chưa thiết lập thì bị chuyển tới `/Admin/setup-2fa` (QR + 8 mã dự phòng) và chưa được vào CMS.
5. Tài khoản có `mustChangePassword` (người dùng mới, hoặc vừa được admin reset) bị chuyển tới `/Admin/change-password`.
6. Quên mật khẩu tại `/Admin/forgot-password`: gửi link `/Admin/reset-password/{token}` dùng 1 lần, hết hạn 30 phút. DB chỉ lưu SHA-256 của token. Thông báo phản hồi giống nhau dù email có tồn tại hay không. Giới hạn 5 lần / 15 phút / IP.

### 5.2 Session (`src/lib/auth/session.ts`)
- Cookie `ttvn_session` (`httpOnly`, `sameSite=lax`, `secure` ở production) chứa token ngẫu nhiên. DB lưu **SHA-256** của token.
- Phiên hết hạn sau **8 giờ**, hoặc sau **30 phút không thao tác**.
- Có "Đăng xuất mọi thiết bị" (trong hồ sơ cá nhân) và "Buộc đăng xuất" (admin làm với người khác).
- `requireUser()` dùng trong trang: nếu chưa đăng nhập thì chuyển về `/Admin/login`. `requireActionUser()` dùng trong server action: nếu chưa đăng nhập thì ném lỗi `UNAUTHORIZED`.

### 5.3 Yêu cầu bảo mật đã triển khai
- Mật khẩu tối thiểu 10 ký tự, phải có chữ hoa, chữ thường và số (`passwordSchema`). Băm bằng argon2id.
- **Khóa tài khoản 15 phút sau 5 lần sai liên tiếp.** Rate limit 30 lần đăng nhập / 15 phút / IP.
- TOTP secret được mã hóa AES-GCM bằng `APP_ENCRYPTION_KEY`. Mã dự phòng được băm.
- Header bảo mật trong `next.config.ts`: CSP (chỉ cho iframe YouTube và `video.tintucvietnam.vn`), HSTS, `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy`. Có `poweredByHeader: false`.
- `/Admin/**` có header `X-Robots-Tag: noindex, nofollow` và không nằm trong sitemap.
- Có giới hạn IP truy cập CMS qua `CMS_ALLOWED_IPS` (trong middleware).
- Audit được ghi cho: đăng nhập thành công/thất bại/bị chặn, khóa tài khoản, đăng xuất, đổi mật khẩu, bật/tắt 2FA, khóa/mở khóa tài khoản và mọi thao tác quản trị.
- Server action nhận body tối đa 16 MB (để upload ảnh).

---

## 6. Vai trò và phân quyền (`src/lib/rbac/permissions.ts`)

### 6.1 Vai trò

| Mã | Tên hiển thị |
|---|---|
| `REPORTER` | Phóng viên / CTV |
| `EDITOR_L1` | Biên tập viên – Duyệt cấp 1 (chỉ trong các danh mục được phân công qua `UserCategoryScope`) |
| `EDITOR_L2` | Thư ký tòa soạn / TBT – Duyệt cấp 2 (mọi danh mục) |
| `ADMIN` | Quản trị hệ thống (**không** mặc định có quyền duyệt) |

Một người có thể giữ nhiều vai trò. `can(user, action, resource?)` cho phép khi **bất kỳ** vai trò nào của người đó có quyền, đồng thời kiểm tra phạm vi danh mục (với `EDITOR_L1`) và quyền sở hữu bài (với các quyền `*Own`).

### 6.2 Ma trận quyền (hằng số `PERMISSIONS`)

| Quyền (`Action`) | REPORTER | EDITOR_L1 | EDITOR_L2 | ADMIN |
|---|:-:|:-:|:-:|:-:|
| `article.create`, `article.editOwnDraft`, `article.submitOwn` | ✅ | ✅ | ✅ | |
| `article.withdrawOwn` | ✅ | | | |
| `review.l1.view` | | ✅ (theo phạm vi) | ✅ | |
| `review.l1.act`, `review.l1.edit` | | ✅ (theo phạm vi) | | |
| `review.l2.view`, `review.l2.act` | | | ✅ | |
| `article.unpublish`, `article.correct`, `article.pin`, `home.layout` | | | ✅ | |
| `media.manageOwn` | ✅ | ✅ | ✅ | ✅ |
| `media.manageAll` | | ✅ | ✅ | ✅ |
| `taxonomy.manage` (danh mục, chuyên đề, nguồn, đối tác) | | | ✅ | ✅ |
| `ads.manage` (quảng cáo) | | | ✅ | ✅ |
| `user.manage` | | | | ✅ |
| `audit.viewArticle` | | | ✅ | ✅ |
| `audit.viewAll` | | | | ✅ |

---

## 7. Quy trình duyệt bài 2 cấp (trọng tâm)

### 7.1 Trạng thái (`STATUS_LABELS`)
`DRAFT` Bản nháp · `PENDING_L1` Chờ duyệt cấp 1 · `IN_REVIEW_L1` Đang duyệt cấp 1 · `PENDING_L2` Chờ duyệt cấp 2 · `IN_REVIEW_L2` Đang duyệt cấp 2 · `RETURNED` Trả lại để sửa · `SCHEDULED` Hẹn giờ đăng · `PUBLISHED` Đã xuất bản · `UNPUBLISHED` Đã gỡ · `REJECTED` Từ chối · `ARCHIVED` Lưu trữ.

### 7.2 Bảng chuyển trạng thái (`TRANSITIONS` trong `src/lib/workflow/machine.ts`)

| Từ | Hành động | Đến | Ai thực hiện | Cần lý do |
|---|---|---|---|---|
| DRAFT | `SUBMIT` Gửi duyệt | PENDING_L1 | tác giả | |
| PENDING_L1 | `WITHDRAW` Rút bài | DRAFT | tác giả | |
| PENDING_L1 | `CLAIM_L1` Nhận duyệt | IN_REVIEW_L1 | BTV cấp 1 trong phạm vi | |
| IN_REVIEW_L1 | `RELEASE_L1` Nhả bài | PENDING_L1 | người đang giữ bài | |
| IN_REVIEW_L1 | `APPROVE_L1` Duyệt cấp 1 | PENDING_L2 | người đang giữ bài | |
| IN_REVIEW_L1 | `RETURN_L1` Trả lại | RETURNED | người đang giữ bài | ✅ |
| IN_REVIEW_L1 | `REJECT_L1` Từ chối | REJECTED | người đang giữ bài | ✅ |
| PENDING_L2 | `CLAIM_L2` Nhận duyệt | IN_REVIEW_L2 | người duyệt cấp 2 | |
| IN_REVIEW_L2 | `RELEASE_L2` Nhả bài | PENDING_L2 | người đang giữ bài | |
| IN_REVIEW_L2 | `PUBLISH` Duyệt & xuất bản | PUBLISHED | người đang giữ bài | |
| IN_REVIEW_L2 | `SCHEDULE` Duyệt & hẹn giờ | SCHEDULED | người đang giữ bài (giờ hẹn phải ở tương lai) | |
| IN_REVIEW_L2 | `RETURN_L2` Trả lại tác giả | RETURNED | người đang giữ bài | ✅ |
| IN_REVIEW_L2 | `SEND_BACK_L1` Trả về cấp 1 | PENDING_L1 | người đang giữ bài | ✅ |
| IN_REVIEW_L2 | `REJECT_L2` Từ chối | REJECTED | người đang giữ bài | ✅ |
| RETURNED | `RESUBMIT` Gửi lại | PENDING_L1 | tác giả | |
| SCHEDULED | `AUTO_PUBLISH` Đến giờ đăng | PUBLISHED | **chỉ hệ thống** (job) | |
| SCHEDULED | `CANCEL_SCHEDULE` Hủy hẹn giờ | PENDING_L2 | người duyệt cấp 2 | |
| PUBLISHED | `UNPUBLISH` Gỡ bài | UNPUBLISHED | `article.unpublish` | ✅ |
| PUBLISHED | `CORRECT` Đính chính | PUBLISHED | `article.correct` | ✅ (ghi chú đính chính) |
| UNPUBLISHED | `REQUEUE` Đưa lại vào duyệt | PENDING_L2 | người duyệt cấp 2 | |
| REJECTED / UNPUBLISHED | `ARCHIVE` Lưu trữ | ARCHIVED | người duyệt cấp 2 | |

`checkTransition()` là hàm thuần, không đụng DB. `availableActions()` dùng nó để UI **chỉ hiện các nút hợp lệ**.

### 7.3 Quy tắc nghiệp vụ
1. **Tách biệt người duyệt**:
   - Tác giả không được thực hiện bất kỳ hành động duyệt nào trên bài của mình.
   - Người đã duyệt cấp 1 (`l1ReviewerId`) không được duyệt cấp 2 **cùng bài**. Quy tắc này chặt hơn đặc tả gốc, vốn chỉ cấm trên cùng phiên bản.
   - Vi phạm trả lỗi `SELF_REVIEW_NOT_ALLOWED`.
2. **Phạm vi**: BTV cấp 1 chỉ thấy và nhận được bài có danh mục chính nằm trong phạm vi của mình (`l1QueueWhere`).
3. **Lý do** là bắt buộc khi trả lại, từ chối, gỡ bài, trả về cấp 1 và đính chính, tối thiểu `MIN_REASON_LENGTH = 10` ký tự. Lý do được lưu thành `ArticleComment` với kind `RETURN_REASON` / `REJECT_REASON` / `UNPUBLISH_REASON` / `CORRECTION` và hiển thị trong khung bình luận của bài.
4. **Khóa biên tập** (`src/lib/workflow/lock.ts`):
   - TTL 15 phút, client gửi heartbeat mỗi 60 giây.
   - Người khác mở bài chỉ xem được ở chế độ đọc, kèm thông báo "Đang được {tên} chỉnh sửa".
   - Khóa của người thao tác được **nhả ngay ở server** sau mỗi lần chuyển trạng thái, không trông vào client.
5. **Sửa trong khi duyệt**:
   - BTV cấp 1 (người đang giữ bài) và cấp 2 được sửa trực tiếp; mỗi lần lưu tạo một revision.
   - Tác giả chỉ sửa được bài ở `DRAFT` và `RETURNED` (`AUTHOR_EDITABLE`).
   - `editMode()` trả về `edit`, `correct` hoặc `readonly`.
6. **Kiểm tra trước khi gửi duyệt** (`checkBeforeSubmit`):
   - Tiêu đề ≤ 150 ký tự; sapo ≤ 300 ký tự.
   - Có danh mục chính, có nguồn.
   - Có ảnh đại diện, và ảnh đó có chú thích.
   - Có tác giả hiển thị.
   - Bài NEWS và MEGASTORY cần ≥ 100 từ. PHOTO_STORY cần ≥ 1 ảnh. EXTERNAL cần `externalUrl` bắt đầu bằng `https://`.
7. **Kiểm tra trước khi xuất bản** (`checkBeforePublish`): gồm toàn bộ kiểm tra trên, cộng thêm: mọi ảnh trong nội dung có alt và chú thích, mọi ảnh trong bộ ảnh có chú thích, slug không trùng.
8. **Đính chính**: chỉ người duyệt cấp 2. Lưu nội dung và chuyển `CORRECT` trong **cùng một transaction**. Ghi chú đính chính (`correctionNote`, `correctedAt`) hiển thị ở cuối bài.
9. **Gỡ bài**: bài biến mất khỏi public ngay (revalidate cache), URL trả **410 Gone**.
10. **Cảnh báo quá hạn**:
    - Bài ở `PENDING_L1` quá `REVIEW_SLA_L1_MINUTES` (tính từ `submittedAt`) hoặc ở `PENDING_L2` quá `REVIEW_SLA_L2_MINUTES` (tính từ `l1ApprovedAt`) được tô đỏ trong hàng đợi.
    - Job gửi nhắc **một lần cho mỗi lượt chờ**, chống trùng bằng khóa KV.
    - Hủy hẹn giờ và đưa lại vào duyệt sẽ đặt lại `l1ApprovedAt` làm mốc tính thời gian chờ.
11. **Tin khẩn** (`isUrgent`): đứng đầu hàng đợi, vẫn phải qua đủ 2 cấp.

### 7.4 `transitionArticle()` (`src/lib/workflow/transition.ts`)
```ts
transitionArticle({ articleId, action, actor /* null = hệ thống */, reason?, scheduledAt?, expectedVersion, meta? })
```
1. Mở transaction, đọc bài kèm `version`. Nếu `version` khác `expectedVersion` thì báo lỗi `CONFLICT` (optimistic locking).
2. Kiểm tra: `checkTransition` (quyền, phạm vi, tách biệt người duyệt, lý do, giờ hẹn), rồi `checkBeforeSubmit` / `checkBeforePublish` tùy hành động.
3. Cập nhật `status`, các cột người duyệt và thời điểm (`submittedAt`, `l1ReviewerId/l1ApprovedAt`, `l2ReviewerId/l2ApprovedAt`, `holderId`, `scheduledAt`, `publishedAt`, `unpublishedAt`), rồi tăng `version`.
4. Ghi `ArticleStatusLog` (kèm `version`), `AuditLog`, `ArticleRevision` và comment chứa lý do. Tạo `Notification`.
5. Sau khi commit: revalidate cache public (khi có liên quan tới PUBLISHED), nhả khóa biên tập, gửi email.

`publishScheduled()` chuyển các bài `SCHEDULED` đã đến giờ sang `PUBLISHED`. Hàm này **idempotent**, vì chỉ cập nhật khi version vẫn khớp.

### 7.5 Job định kỳ
`pnpm worker` (hoặc `pnpm serve`) cứ 60 giây gọi `POST /api/cron/publish` với header `x-cron-key = HMAC_SHA256(AUTH_SECRET, "cron")` (dạng base64url). Route này chạy `runScheduledJobs()`, gồm `publishScheduled()` và `remindOverdue()`. Job được gọi qua HTTP để Next.js revalidate được cache. Có thể thay worker bằng cron của hạ tầng.

### 7.6 Thông báo (`src/lib/notify`)

| Sự kiện | Người nhận |
|---|---|
| Bài gửi duyệt cấp 1 | BTV cấp 1 có phạm vi danh mục đó |
| Bài được duyệt cấp 1 | Tác giả + toàn bộ người duyệt cấp 2 |
| Bài bị trả lại / từ chối | Tác giả (kèm lý do) |
| Bài đã xuất bản / hẹn giờ | Tác giả + người duyệt cấp 1 |
| Bài bị gỡ / đính chính | Tác giả + người duyệt cấp 1 |
| Bình luận mới | Những người đã tham gia bài |
| Bài quá hạn chờ duyệt | Người duyệt cấp tương ứng |

Kênh thông báo:
- Chuông trong CMS (`NotificationBell`), cập nhật mỗi 30 giây qua `/api/cms/notifications`.
- Email, chỉ gửi nếu `User.emailNotify` bật; người dùng tự bật/tắt trong hồ sơ.

### 7.7 Mã lỗi (`src/lib/errors.ts`)
`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `LOCKED`, `INVALID_TRANSITION`, `SELF_REVIEW_NOT_ALLOWED`. Mỗi mã có thông báo tiếng Việt. Server action bọc trong `runAction()`, trả về `ActionResult<T>` = `{ ok: true, data } | { ok: false, code, message, details? }`.

---

## 8. Quảng cáo: banner 2 bên và popup (bổ sung ngoài đặc tả gốc)

- Model `Ad` có các trường:
  - `position`: `LEFT` / `RIGHT` / `POPUP`.
  - Ảnh: `mediaId`, lấy từ thư viện media.
  - Liên kết: `linkUrl`, `openNewTab`.
  - `homeOnly`: chỉ hiện ở trang chủ.
  - `frequency`: `SESSION` / `DAILY` / `EVERY_PAGE`, chỉ áp dụng cho popup.
  - Lịch chạy: `startAt` / `endAt`.
  - Trạng thái và thống kê: `isActive`, `order`, `clicks`.
- Quản lý tại **`/Admin/ads`**, cần quyền `ads.manage`:
  - Form thêm/sửa (`components/cms/AdForm.tsx`; sửa qua `?edit={id}`).
  - 3 danh sách theo vị trí, có kéo-thả sắp xếp, nhãn trạng thái (Đang chạy / Hẹn giờ / Hết hạn / Đang tắt), bật/tắt, xóa và số lượt bấm.
  - Server action trong `app/Admin/_actions/ads.ts`. Audit ghi `AD_CREATE`, `AD_UPDATE`, `AD_ENABLE`, `AD_DISABLE`, `AD_DELETE`.
- Logic dùng chung cho server và client nằm ở `src/lib/ads.ts`: `adInputSchema` (Zod, ngày kết thúc phải sau ngày bắt đầu), `isSafeAdLink()` (chỉ nhận `https://`, `http://` hoặc `/...`, không nhận `//`), `adStatus()`, `shouldShowPopup()` (tần suất DAILY so theo ngày lịch Việt Nam), chuyển đổi giờ `+07:00`.
- Phía public:
  - `getActiveAds()` cung cấp dữ liệu; component client `components/public/Promos.tsx` hiển thị.
  - **Banner 2 bên** rộng 160px (ví dụ 160×600), cố định ở ngoài cột 1200px, **chỉ hiện khi màn hình ≥ 1560px**.
  - **Popup** (khoảng 600×500) hiện sau 1 giây; mỗi lần chỉ hiện 1 popup, là popup đứng đầu danh sách và hợp tần suất. Đóng bằng ×, phím Esc hoặc bấm ra nền.
  - Tần suất lưu trong `sessionStorage` / `localStorage` với khóa `ttvn_promo_s_{id}` / `ttvn_promo_d_{id}`.
  - Client kiểm tra lịch chạy mỗi phút, nên quảng cáo bật/tắt đúng giờ dù trang được cache ISR 60 giây.
  - Link có `rel="sponsored"` và đi qua `/go/{id}` để đếm lượt bấm. Đích lấy từ DB nên không thành open redirect.
  - Phía public **tránh chữ "ad"/"banner"** trong URL, class và nhãn ARIA (dùng `/go/`, `Promos`) để trình chặn quảng cáo không ẩn đi.
- Chưa đếm lượt hiển thị.

---

## 9. Màn hình CMS (`src/app/Admin/(protected)/`)

Layout có sidebar; menu chỉ hiện mục người dùng có quyền. Thứ tự: Tổng quan · Bài viết · Viết bài mới · Duyệt cấp 1 (kèm số bài) · Duyệt cấp 2 (kèm số bài) · Thư viện media · Bố cục trang chủ · Danh mục · Chuyên đề · Nguồn & đối tác · Quảng cáo · Người dùng · Nhật ký hệ thống. Ngoài ra có chuông thông báo và hồ sơ cá nhân.

| Trang | Nội dung |
|---|---|
| `/Admin` (Tổng quan) | Thẻ số liệu theo vai trò (bài nháp của tôi, bài bị trả lại, chờ cấp 1, chờ cấp 2, đã đăng hôm nay, hẹn giờ); "Việc cần làm"; biểu đồ số bài xuất bản 7 ngày; top bài xem nhiều |
| `/Admin/articles` | Lọc theo trạng thái, danh mục, loại, tác giả, người duyệt, khoảng ngày, từ khóa, tin khẩn. Cột: tiêu đề, loại, danh mục, tác giả, trạng thái (badge màu), người đang giữ, cập nhật lúc, thao tác. Phóng viên chỉ thấy bài của mình (`visibleArticlesWhere`) |
| `/Admin/articles/new` | Chọn loại bài rồi tạo bản nháp |
| `/Admin/articles/[id]` | Trình soạn thảo, xem chi tiết bên dưới bảng |
| `/Admin/articles/[id]/history` | Danh sách revision; so sánh 2 phiên bản bất kỳ; khôi phục (chỉ khi bài đang ở trạng thái được sửa, tạo revision mới); dòng thời gian trạng thái kèm lý do |
| `/Admin/articles/[id]/preview` | Xem trước bằng đúng giao diện public |
| `/Admin/review/level-1`, `level-2` | Hàng đợi: tin khẩn trước, sau đó theo thời gian gửi tăng dần. Mỗi dòng: tiêu đề, danh mục, tác giả, thời gian chờ (đỏ nếu quá hạn), người đang giữ. Nút **Nhận duyệt** |
| `/Admin/media` | Upload jpg/png/webp tối đa 15 MB, kiểm tra MIME bằng magic bytes. Sinh webp `thumb` 320 / `stand` 960 / `large` 1920, xóa EXIF. Lưu chú thích, tác giả ảnh, alt; có tìm kiếm |
| `/Admin/home-layout` | Chọn bài cho slot `HOME_PHOTO_HERO`, ghim bài đầu danh mục, chọn chuyên đề nổi bật |
| `/Admin/categories`, `topics`, `sources` | CRUD, kéo-thả sắp xếp (`SortableList`), bật/tắt hiển thị. Trang `sources` gồm cả **đối tác** |
| `/Admin/ads` | Quảng cáo (mục 8) |
| `/Admin/users` | Tạo người dùng, khóa/mở khóa, gán vai trò, gán phạm vi danh mục cho BTV cấp 1, reset mật khẩu, bắt buộc 2FA, buộc đăng xuất |
| `/Admin/audit-log` | Lọc theo người, hành động, đối tượng, thời gian. Xuất CSV qua `/api/cms/audit-log/export`. Chỉ đọc. ADMIN xem toàn bộ; cấp 2 chỉ xem log về bài viết |
| `/Admin/notifications` | Danh sách thông báo |
| `/Admin/profile` | Đổi mật khẩu, bật/tắt 2FA, bật/tắt email thông báo, đăng xuất mọi thiết bị |

**Trình soạn thảo** (`components/cms/editor/ArticleEditor.tsx` + `RichEditor.tsx`), bố cục 2 cột:
- **Cột trái**: tiêu đề, sapo, nội dung Tiptap (đoạn, H2/H3, ảnh có chú thích, video YouTube, bảng, trích dẫn, link, box tin liên quan).
- **Cột phải**:
  - trạng thái và các nút hành động hợp lệ;
  - danh mục chính và phụ;
  - loại bài (`NEWS`, `PHOTO_STORY`, `GRAPHIC`, `MEGASTORY`, `EXTERNAL`);
  - nguồn, tác giả hiển thị, ảnh đại diện (`MediaPicker`), tags, chuyên đề;
  - slug (tự sinh, sửa được), SEO title/description;
  - cờ tin khẩn, giờ hẹn đăng (chỉ cấp 2).
- Tự lưu mỗi **30 giây**; cảnh báo khi rời trang mà chưa lưu; heartbeat khóa mỗi 60 giây.
- Khung **bình luận nội bộ** (`workflow/Comments.tsx`) hiển thị cả lý do trả lại/từ chối.
- Khi duyệt bài gửi lại, có **diff** với lần gửi trước (`workflow/DiffView.tsx`, `lib/cms/diff.ts`) và dòng thời gian trạng thái.
- Loại `PHOTO_STORY` có trình quản lý gallery kéo-thả; mỗi ảnh có chú thích và tác giả ảnh.
- Loại `EXTERNAL` chỉ cần tiêu đề, sapo, ảnh, `externalUrl` và nguồn.
- Lưu bằng `saveArticleAction(id, input, expectedVersion)`. Nếu version lệch thì báo lỗi `CONFLICT`.

---

## 10. Mô hình dữ liệu (`prisma/schema.prisma`, theo hiện trạng)

**Enum:**
- `Role` {REPORTER, EDITOR_L1, EDITOR_L2, ADMIN}
- `ArticleStatus`: 11 trạng thái ở mục 7.1
- `ArticleType` {NEWS, PHOTO_STORY, GRAPHIC, MEGASTORY, EXTERNAL}
- `CategoryType` {NEWS, PHOTO, FEED}
- `Locale` {vi, en}
- `AdPosition` {LEFT, RIGHT, POPUP}
- `AdFrequency` {EVERY_PAGE, SESSION, DAILY}

**Model:**

| Model | Trường chính / ghi chú |
|---|---|
| `User` | email (unique), fullName, passwordHash, roles[], isActive, mustChangePassword, **require2fa**, totpSecret (mã hóa), totpEnabled, backupCodes[] (đã băm), failedLoginCount, lockedUntil, lastLoginAt, emailNotify |
| `Session` | sessionToken (sha256, unique), userId, expires, lastActiveAt, **pending2fa**, ip, userAgent |
| `PasswordResetToken` | tokenHash (unique), expiresAt, usedAt |
| `Category` | id (tự tăng), **publicId**, slug, name, type, locale, parentId, order, showInMenu, footerCol, isActive |
| `UserCategoryScope` | khóa chính (userId, categoryId) |
| `Source` | name, slug, homepage, logoUrl |
| `Article` | type, status, **version**, locale, title, slug, sapo, contentJson (Tiptap), contentHtml (đã sanitize), externalUrl, coverMediaId, primaryCatId, sourceId, authorId, authorName, isUrgent, isPinned, seoTitle, seoDescription, correctionNote, **correctedAt**, submittedAt, l1ReviewerId, l1ApprovedAt, l2ReviewerId, l2ApprovedAt, **holderId**, scheduledAt, publishedAt, unpublishedAt, viewCount, searchVector (tsvector). Unique (slug, locale); index (status, publishedAt), (primaryCatId, status, publishedAt) |
| `ArticleCategory`, `ArticleTag`, `ArticleTopic` | Bảng nối danh mục phụ / tag / chuyên đề |
| `Tag` | name, slug |
| `Media` | key `yyyy/MM/dd/{id}`, mime, width, height, sizeBytes, caption, alt, photographer, uploadedById |
| `ArticlePhoto` | articleId, mediaId, caption, order, takenAt |
| `ArticleRevision` | (articleId, version) unique, snapshot JSON, editorId, statusAtSave, note |
| `ArticleStatusLog` | fromStatus, toStatus, action, actorId, reason, **version** |
| `ArticleComment` | kind: COMMENT, RETURN_REASON, REJECT_REASON, UNPUBLISH_REASON, CORRECTION |
| `ArticleDailyView` | (articleId, day) → count, dùng cho "xem nhiều 3 ngày" |
| `Notification` | userId, type, title, link, readAt |
| `AuditLog` | actorId, action, entityType, entityId, metadata, ip, userAgent |
| `Topic` | id (19, 20), slug, name, bannerUrl, isFeatured, order, isActive |
| `Partner` | name, logoUrl, url, order, isActive |
| `Ad` | mục 8 |
| `HomeSlot` | key (ví dụ `HOME_PHOTO_HERO`), articleIds[] |
| `StaticPage` | slug, title, contentHtml |
| `KvEntry` | key, value, expiresAt; thay Redis khi không có Redis |

Mỗi lần `version` tăng (khi lưu nội dung hoặc chuyển trạng thái) đều tạo một `ArticleRevision` có cùng số version.

**Migrations (không được sửa):**
1. `20261101034514_init`
2. `20261101034600_search_vector`: extension `unaccent`, hàm `immutable_unaccent`, trigger cập nhật `searchVector`, index GIN `Article_searchVector_idx`.
3. `20261103100000_ads`

⚠️ Khi tạo migration mới bằng `prisma migrate diff` / `migrate dev`, Prisma sẽ tự thêm lệnh `DROP INDEX "Article_searchVector_idx"` vì index này không khai báo trong schema. **Phải xóa dòng đó** khỏi file migration trước khi áp dụng.

---

## 11. Bảo mật nội dung
- Nội dung bài được sanitize bằng `sanitizeContent()` (`src/lib/content/sanitize.ts`) với whitelist thẻ và thuộc tính. Iframe chỉ được phép từ `www.youtube.com`, `www.youtube-nocookie.com` và `video.tintucvietnam.vn` (`IFRAME_HOSTS` trong `src/lib/config.ts`). Link ngoài được thêm `target=_blank rel="noopener noreferrer nofollow"`.
- `externalUrl` phải là `https://` và thuộc domain `homepage` của một `Source`. `/r/{id}` kiểm tra lại điều này khi redirect, để chặn open redirect.
- Upload ảnh: kiểm tra magic bytes, giới hạn 15 MB, `sharp` bỏ toàn bộ metadata (gồm EXIF GPS), file đặt tên theo id. `readObject()` chặn path traversal.
- Route public chỉ truy vấn bài PUBLISHED, thông qua `publishedWhere()`.

---

## 12. Dữ liệu seed (`prisma/seed.ts`)

⚠️ `pnpm db:seed` **xóa toàn bộ dữ liệu** rồi tạo lại.

- Seed tạo:
  - đủ danh mục, feed, danh mục ảnh ở mục 4.1;
  - 6 nguồn, 2 chuyên đề, 10 đối tác (logo placeholder);
  - 3 trang tĩnh, 6 tag;
  - 3 quảng cáo mẫu: trái, phải, và popup chỉ ở trang chủ.
- Bài viết: khoảng 76 bài, gồm 63 tin chữ hoặc nguồn ngoài phủ đủ 11 trạng thái, 6 bộ ảnh, 3 đồ họa, 2 megastory, và tin cho 2 chuyên đề. Ảnh placeholder được sinh bằng `sharp`. Mọi nội dung đều tự viết, không lấy từ báo thật.
- Tài khoản (mật khẩu demo `Demo@123456`, chỉ dùng cho dev; khi `NODE_ENV=production` thì bắt đổi mật khẩu ở lần đầu):

| Email | Vai trò | Phạm vi |
|---|---|---|
| `admin@demo.vn` | ADMIN | — |
| `tbt@demo.vn` | EDITOR_L2 | toàn bộ |
| `btv.chinhtri@demo.vn` | EDITOR_L1 | Chính trị, Xã hội, Pháp luật |
| `btv.kinhte@demo.vn` | EDITOR_L1 | Kinh tế, KH-CN, Môi trường |
| `pv2@demo.vn` | REPORTER | — |
| `SEED_OWNER_EMAIL` (hiện là `hienhv@vppos.vn`; để trống thì dùng `pv1@demo.vn`) | **Chủ hệ thống**: cả 4 vai trò | mọi danh mục |

- Tài khoản demo có vai trò duyệt hoặc admin đã bật sẵn 2FA với secret dev dùng chung `KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD`, mã dự phòng `DEMO000001`…`DEMO000004`.
- Tài khoản chủ hệ thống:
  - Mật khẩu lấy từ `SEED_OWNER_PASSWORD` trong `.env` và **không được ghi vào mã nguồn**.
  - 2FA **chưa thiết lập**: lần đăng nhập đầu sẽ phải quét QR bằng ứng dụng của chính chủ.
  - Sửa được mọi bài; bài đã đăng thì sửa ở chế độ đính chính.
  - Vẫn không được tự duyệt bài do chính mình viết.
- Test dùng `pv2@demo.vn` làm phóng viên.

---

## 13. Kiểm thử

| Bộ | File | Nội dung |
|---|---|---|
| Unit | `tests/unit/machine.test.ts` | Mọi cặp (trạng thái, hành động) hợp lệ/không hợp lệ; tự duyệt; lý do; giờ hẹn |
| Unit | `tests/unit/rbac.test.ts` | `can()` cho từng vai trò × quyền × phạm vi |
| Unit | `tests/unit/utils.test.ts` | Slug tiếng Việt, thời gian tương đối, sanitize, kiểm tra trước khi gửi, magic bytes ảnh |
| Unit | `tests/unit/ads.test.ts` | An toàn link, schema, múi giờ, trạng thái, tần suất popup |
| Integration | `tests/integration/workflow.test.ts` | Luồng duyệt trên DB thật, optimistic locking (`CONFLICT`), job hẹn giờ |
| E2E | `tests/e2e/workflow.spec.ts` | 8 bước, xem dưới đây |

Kết quả gần nhất: **370 unit + 8 integration đạt**, lint và typecheck sạch, e2e đạt.

Các bước E2E:
1. pv2 tạo bài Chính trị và gửi duyệt.
2. btv.kinhte không thấy bài; btv.chinhtri nhận duyệt và trả lại kèm lý do.
3. pv2 thấy lý do, sửa và gửi lại.
4. btv.chinhtri xem diff và duyệt cấp 1.
5. tbt (có 2FA) nhận duyệt và xuất bản; bài hiện trên trang chủ và trang danh mục.
6. tbt gỡ bài; URL public trả 410.
7. Đăng nhập sai 5 lần thì tài khoản bị khóa.
8. Vào `/Admin/articles` khi chưa đăng nhập thì bị chuyển về `/Admin/login`.

---

## 14. Cấu trúc thư mục (hiện trạng)

```
.
├─ AGENTS.md                 # tài liệu này
├─ CLAUDE.md                 # đặc tả gốc (có phần đã lỗi thời, xem mục 19)
├─ README.md                 # cách chạy, tài khoản demo
├─ docs/DECISIONS.md         # các quyết định, điều chỉnh so với đặc tả
├─ start.cmd                 # nhấp đúp để chạy pnpm serve (Windows)
├─ docker-compose.yml        # tùy chọn: postgres, redis, mailpit (minio không dùng)
├─ next.config.ts            # redirects, security headers
├─ prisma/  schema.prisma · migrations/ (3) · seed.ts
├─ scripts/
│  ├─ serve.ts               # chạy production một lệnh
│  ├─ dev-db.ts              # pnpm db:local
│  ├─ worker.ts              # pnpm worker
│  └─ lib/ postgres.ts · worker.ts
├─ storage/                  # (gitignore) pgdata/, media/, postgres.log
├─ src/
│  ├─ middleware.ts          # /admin → /Admin, CMS_ALLOWED_IPS, X-Robots-Tag, x-locale
│  ├─ app/
│  │  ├─ [locale]/           # trang công khai (mục 4.2) + render/ (trang nội bộ cho route bài viết)
│  │  ├─ _public/            # article-route, category, internal-render, listing-data, xml
│  │  ├─ Admin/              # CMS: login, login/2fa, setup-2fa, change-password, forgot/reset-password,
│  │  │  ├─ (protected)/     #      các trang ở mục 9
│  │  │  └─ _actions/        #      server actions: auth, articles, media, admin, ads
│  │  ├─ api/ cms/ (audit-log/export, media, notifications) · cron/publish · public/
│  │  ├─ go/[id] · r/[id] · media/[...path] · rss/[catSlug]
│  │  └─ sitemap.ts · news-sitemap.xml/ · robots.ts · layout.tsx · not-found.tsx
│  ├─ components/
│  │  ├─ public/             # layout, ArticleCard, Promos, home/, article/, photo/, listing/
│  │  └─ cms/                # ui, forms, Sidebar, SortableList, MediaLibrary, AdForm, editor/, workflow/
│  └─ lib/
│     ├─ auth/ (crypto, password, session, totp, misc: captcha/rate-limit/IP)
│     ├─ rbac/permissions.ts · workflow/ (machine, transition, checks, lock, jobs)
│     ├─ audit/ · revisions/ · notify/ · storage/ · content/sanitize.ts
│     ├─ repo/public.ts      # mọi truy vấn public (chỉ PUBLISHED)
│     ├─ cms/                # queries (hàng đợi, quyền xem/sửa), review, diff, editor-data, audit-query
│     └─ ads.ts · config.ts · db.ts · errors.ts · http.ts · i18n.ts · kv.ts · seo.ts · slug.ts · time.ts · urls.ts
└─ tests/ unit/ · integration/ · e2e/
```

---

## 15. Những điểm dễ sai (phải đọc trước khi sửa)

1. **Không redirect trong middleware.** Next.js đổi host `127.0.0.1` thành `localhost` trong `Location` phát ra từ middleware, làm người dùng mất cookie phiên. Các redirect cố định đặt trong `next.config.ts` (`redirects()`); route handler dùng `relativeRedirect()`.
2. **Truy cập qua IP LAN bằng HTTP sẽ không đăng nhập được** vì cookie có cờ `secure` ở production (trình duyệt chỉ ngoại lệ cho `127.0.0.1` / `localhost`). Muốn truy cập qua LAN thì cần HTTPS.
3. **Trang chủ và trang danh mục dùng ISR 60 giây.** Không gọi `headers()` / `cookies()` trong root layout hoặc layout `[locale]`, vì sẽ biến trang thành dynamic.
4. **Route bài viết là route handler gọi trang nội bộ** `/{locale}/render/article/{id}`. Khi chạy nhiều instance phải đặt `INTERNAL_ORIGIN` và `INTERNAL_RENDER_TOKEN`.
5. **`thumbUrl()` là hàm của client.** Ở server component phải dùng `mediaUrl(key, size)` từ `@/lib/storage`.
6. **`SortableList` phải đồng bộ lại `items` sau `router.refresh()`** (đã có `useEffect`). Không xóa đoạn này.
7. **Windows**:
   - `prisma generate` báo EPERM khi server đang chạy, vì DLL bị khóa. Dừng server trước khi generate.
   - Docker Desktop không chạy được trên máy này; dùng Postgres nhúng.
8. **Migration mới**: xóa dòng `DROP INDEX "Article_searchVector_idx"` mà Prisma tự sinh (mục 10).
9. `pnpm db:seed` xóa sạch dữ liệu thật. Không chạy seed trên môi trường có dữ liệu cần giữ.

---

## 16. Server actions CMS (tất cả đều qua `requireActionUser()` + `can()`)

| File | Action |
|---|---|
| `_actions/auth.ts` | `loginAction`, `verify2faAction`, `logoutAction`, `logoutAllAction`, `forgotPasswordAction`, `resetPasswordAction`, `changePasswordAction`, `begin2faSetup`, `confirm2faAction`, `disable2faAction`, `updateEmailNotifyAction` |
| `_actions/articles.ts` | `createArticleAction`, `saveArticleAction(id, input, expectedVersion)`, `transitionAction`, `claimFromQueueAction`, `acquireLockAction` / `heartbeatLockAction` / `releaseLockAction`, `addCommentAction`, `restoreRevisionAction`, `togglePinAction` |
| `_actions/media.ts` | `uploadMediaAction`, `updateMediaAction` |
| `_actions/admin.ts` | `saveCategoryAction`, `saveTopicAction`, `toggleTopicFeaturedAction`, `saveSourceAction`, `savePartnerAction`, `reorderAction(kind: category/topic/partner/ad, ids)`, `setHomeSlotAction`, `createUserAction`, `updateUserAction` (vai trò, phạm vi, bắt buộc 2FA), `toggleUserLockAction`, `resetUserPasswordAction`, `forceLogoutAction` |
| `_actions/ads.ts` | `saveAdAction`, `setAdActiveAction`, `deleteAdAction` |

---

## 17. Việc còn mở / gợi ý phát triển tiếp
- Trang **Video** mới là trang giữ chỗ; chưa có loại bài video.
- Các ngôn ngữ FR / ES / 中文 / RU mới là link giữ chỗ. `/en` chưa có nội dung tiếng Anh riêng.
- Quảng cáo: chưa đếm lượt hiển thị. Banner 2 bên không hiện trên màn hình < 1560px; nếu cần hiện trên laptop thì phải đổi bố cục (ví dụ đặt vào sidebar).
- Lưu file mới có driver ổ đĩa cục bộ. Muốn dùng S3/MinIO thì thay `putObject` / `readObject` trong `src/lib/storage/index.ts`, rồi thêm các biến S3 cần thiết vào `.env.example`.
- Thông báo dùng polling 30 giây, chưa có SSE.
- Chưa đo Lighthouse (mục tiêu của đặc tả là ≥ 90).
- Dự án **chưa là git repository**. Nên `git init` và commit trước khi phát triển tiếp.

---

## 18. Kế hoạch giai đoạn (trạng thái)

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 1 | Khởi tạo dự án, Prisma schema, migration, seed | ✅ |
| 2 | Xác thực CMS: đăng nhập, 2FA, quên mật khẩu, khóa tài khoản, session | ✅ |
| 3 | RBAC, quản lý người dùng và phạm vi danh mục | ✅ |
| 4 | Trình soạn thảo, media, revision, tự lưu, khóa biên tập | ✅ |
| 5 | State machine duyệt 2 cấp, hàng đợi, bình luận, diff, thông báo, job hẹn giờ, audit | ✅ |
| 6 | Public site: layout, trang chủ 12 khối, danh mục, chi tiết bài, bộ ảnh | ✅ |
| 7 | Đồ họa, megastory, chuyên đề, tìm kiếm, RSS, sitemap, SEO, `/en` | ✅ |
| 8 | Dashboard, bố cục trang chủ, audit log UI, xuất CSV | ✅ |
| 9 | Bảo mật header, README; hiệu năng / Lighthouse | ✅ một phần (chưa đo Lighthouse) |
| + | CMS chuyển sang `/Admin`, tài khoản chủ hệ thống, hiện/ẩn mật khẩu | ✅ |
| + | Quảng cáo: banner 2 bên, popup | ✅ |

---

## 19. Phần trong đặc tả gốc (`CLAUDE.md`) KHÔNG dùng: đừng triển khai lại

| Đặc tả gốc | Thực tế | Lý do |
|---|---|---|
| Auth.js (NextAuth v5) | Session tự viết (mục 5.2) | Credentials provider của Auth.js không hỗ trợ session lưu DB |
| BullMQ + Redis cho job | Worker HTTP + `/api/cron/publish` | Redis không bắt buộc; cần gọi qua HTTP để Next revalidate cache |
| Redis bắt buộc | Redis tùy chọn, dự phòng bằng bảng `KvEntry` | Máy dev không có Redis |
| S3 / MinIO, biến `S3_*` | Ổ đĩa `storage/media` + route `/media/[...path]` | Đơn giản hơn khi dev; MinIO trong docker-compose không dùng |
| `next-intl` | Từ điển `src/lib/i18n.ts` | Chỉ cần dịch phần khung giao diện |
| shadcn/ui | Component Tailwind tự viết | |
| Docker là hạ tầng dev chính | `embedded-postgres` (`pnpm db:local`, `pnpm serve`) | Docker Desktop không chạy được trên máy này |
| Đường dẫn CMS `/cms` | `/Admin` (`/cms` chuyển hướng sang) | Theo yêu cầu chủ dự án |
| `Category.id` = ID công khai | Tách `id` nội bộ và `publicId` | ID công khai bị trùng giữa các nhóm |
| URL có dấu `/` cuối | Không có dấu `/` cuối | Thống nhất với Next.js |
| `revalidateTag` | `revalidatePath` | |
| Tài khoản `pv1@demo.vn` | Tài khoản chủ hệ thống từ `SEED_OWNER_*` | Theo yêu cầu chủ dự án |
| E2E bước 5 "hẹn giờ 2 phút" | Xuất bản ngay; job hẹn giờ được kiểm tra trong integration test | Để e2e không phải chờ |
| Tên/logo TTXVN, vnanet | Tin Tức Việt Nam (TTVN), tintucvietnam.vn | Bản quyền |
| File `MD_vnanet.vn_Claude.md` | Không dùng (bản yêu cầu ban đầu) | Có thể xóa |
