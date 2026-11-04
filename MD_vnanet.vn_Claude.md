# CLAUDE.md — Dự án cổng tin tức kiểu VNAnet + CMS duyệt bài 2 cấp

> File này là **đặc tả và hướng dẫn làm việc cho Claude** (Claude Code hoặc Claude chat). Đặt file ở thư mục gốc dự án; Claude Code sẽ tự đọc file `CLAUDE.md` mỗi phiên.
>
> Phạm vi dự án gồm hai phần:
> 1. **Trang công khai (Public site)**: tái hiện cấu trúc cổng tin tức https://vnanet.vn/vi/ (khảo sát 01/11/2026).
> 2. **Trang quản trị (CMS)**: đăng nhập, soạn bài, **duyệt bài qua 2 cấp** rồi mới xuất bản.
>
> ⚠️ Nội dung, ảnh, logo của TTXVN là tài sản có bản quyền. Chỉ dùng **dữ liệu giả (seed/mock)** hoặc nội dung do chính tòa soạn sở hữu.

---

## 0. Quy tắc làm việc dành cho Claude

1. Ngôn ngữ giao diện, thông báo lỗi, nội dung seed: **tiếng Việt**. Tên biến, hàm, bảng, commit: **tiếng Anh**.
2. Làm **theo từng giai đoạn ở mục 14**. Xong mỗi giai đoạn phải: chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, rồi tóm tắt việc đã làm và việc còn lại.
3. **Không bao giờ** bỏ qua kiểm tra quyền ở server. Mọi thao tác CMS phải kiểm tra quyền trong server action / route handler, không chỉ ẩn nút ở UI.
4. Mọi chuyển trạng thái bài viết **chỉ đi qua** hàm `transitionArticle()` trong `lib/workflow/` (mục 6.4). Không cập nhật trực tiếp cột `status` ở bất kỳ chỗ nào khác.
5. Mọi thay đổi bài viết và mọi chuyển trạng thái phải ghi **audit log** và **phiên bản (revision)**.
6. Dùng TypeScript strict, không dùng `any`. Validate mọi input bằng Zod.
7. Thay đổi DB chỉ qua Prisma migration. Không sửa migration đã chạy.
8. Không commit secret. Biến môi trường khai báo trong `.env.example`.
9. Khi một yêu cầu trong file này chưa rõ, chọn phương án an toàn hơn và ghi lại giả định vào `docs/DECISIONS.md`.

---

## 1. Stack kỹ thuật

| Lớp | Lựa chọn |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui (CMS), component tự viết (public) |
| i18n | `next-intl`, route `/vi`, `/en` cho public; CMS chỉ tiếng Việt |
| DB | PostgreSQL 16 + Prisma ORM |
| Xác thực | Auth.js (NextAuth v5) Credentials + session lưu DB, mật khẩu băm **argon2id**, 2FA TOTP (`otplib`) |
| Trình soạn thảo | Tiptap (rich text, chèn ảnh, video embed, bảng, trích dẫn) |
| Lưu file | S3-compatible (MinIO khi dev), resize bằng `sharp` |
| Tìm kiếm | PostgreSQL full-text + extension `unaccent` (giai đoạn đầu) |
| Cache / hàng đợi | Redis (đếm view, rate limit, khóa bài, job hẹn giờ đăng với BullMQ) |
| Email | Nodemailer (dev: Mailpit) |
| Kiểm thử | Vitest (unit), Playwright (e2e) |
| Hạ tầng dev | `docker-compose.yml`: postgres, redis, minio, mailpit |
| Quản lý gói | pnpm |

---

## 2. Cấu trúc thư mục

```
.
├─ CLAUDE.md
├─ docker-compose.yml
├─ .env.example
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ docs/DECISIONS.md
├─ src/
│  ├─ app/
│  │  ├─ [locale]/                    # PUBLIC SITE
│  │  │  ├─ page.tsx                  # Trang chủ
│  │  │  ├─ tin-tuc/[catSlug]/page.tsx
│  │  │  ├─ tin-tuc/[catSlug]/[articleSlug]/page.tsx
│  │  │  ├─ tin/[feedSlug]/page.tsx
│  │  │  ├─ tin-the-gioi/page.tsx
│  │  │  ├─ tin-anh/page.tsx
│  │  │  ├─ anh/page.tsx
│  │  │  ├─ anh/[catSlug]/page.tsx
│  │  │  ├─ anh/[catSlug]/[storySlug]/page.tsx
│  │  │  ├─ graphic/page.tsx
│  │  │  ├─ megastory/page.tsx
│  │  │  ├─ megastory/[slug]/page.tsx
│  │  │  ├─ chuyen-de/[topicSlug]/page.tsx
│  │  │  ├─ search/page.tsx
│  │  │  ├─ rss/page.tsx
│  │  │  └─ trang/[slug]/page.tsx     # trang tĩnh (điều khoản...)
│  │  ├─ r/[id]/route.ts              # đếm view + redirect bài nguồn ngoài
│  │  ├─ rss/[catSlug]/route.ts
│  │  ├─ sitemap.ts  robots.ts
│  │  ├─ cms/                         # CMS (noindex)
│  │  │  ├─ login/page.tsx
│  │  │  ├─ login/2fa/page.tsx
│  │  │  ├─ forgot-password/page.tsx
│  │  │  ├─ reset-password/[token]/page.tsx
│  │  │  └─ (protected)/
│  │  │     ├─ layout.tsx             # sidebar + kiểm tra session
│  │  │     ├─ page.tsx               # Dashboard
│  │  │     ├─ articles/page.tsx      # Danh sách + bộ lọc
│  │  │     ├─ articles/new/page.tsx
│  │  │     ├─ articles/[id]/page.tsx # Soạn/sửa
│  │  │     ├─ articles/[id]/history/page.tsx
│  │  │     ├─ articles/[id]/preview/page.tsx
│  │  │     ├─ review/level-1/page.tsx
│  │  │     ├─ review/level-2/page.tsx
│  │  │     ├─ media/page.tsx
│  │  │     ├─ categories/page.tsx
│  │  │     ├─ topics/page.tsx
│  │  │     ├─ sources/page.tsx
│  │  │     ├─ home-layout/page.tsx   # chọn bài nổi bật, tin tiêu điểm
│  │  │     ├─ users/page.tsx
│  │  │     ├─ audit-log/page.tsx
│  │  │     ├─ notifications/page.tsx
│  │  │     └─ profile/page.tsx       # đổi mật khẩu, bật 2FA
│  │  └─ api/                         # route handler cần thiết (upload, cron)
│  ├─ components/
│  │  ├─ public/  layout/ home/ article/ photo/
│  │  └─ cms/     editor/ workflow/ tables/
│  ├─ lib/
│  │  ├─ auth/          # config Auth.js, password, totp, rate-limit
│  │  ├─ rbac/          # permissions.ts, can()
│  │  ├─ workflow/      # state machine, transitionArticle()
│  │  ├─ audit/         # writeAudit()
│  │  ├─ revisions/
│  │  ├─ storage/       # S3 upload, resize
│  │  ├─ notify/        # in-app + email
│  │  ├─ search/
│  │  ├─ slug.ts  time.ts  db.ts  validators/
│  └─ middleware.ts     # i18n public + chặn /cms chưa đăng nhập
└─ tests/ unit/ e2e/
```

---

## 3. PHẦN A — Trang công khai

### 3.1 Danh mục chủ đề (seed đúng bảng này)

| Tên hiển thị | slug | id | Cột footer |
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

Nhóm **Tin thời sự** (tab trang chủ): Trong nước (1), Thế giới (3), Kinh tế Việt Nam (10), Kinh tế Thế giới (1000).
Danh mục **Ảnh**: Ảnh thời sự trong nước (1014), Ảnh thời sự quốc tế (1049), Văn hoá & Xã hội (1017).
**Chuyên đề**: Tin vắn kinh tế châu Á (19), Business Wire (20).

URL công khai dùng mẫu `{slug}-{id}` (VD `/vi/tin-tuc/chinh-tri-11/`), bài viết `/vi/tin-tuc/{catSlug}-{catId}/{articleSlug}-{articleId}.html`. Cấu hình rewrite trong Next.js để giữ đúng mẫu này.

### 3.2 Bố cục toàn cục

```
TOP BAR    : logo nhỏ + "Thông Tấn Xã Việt Nam" | đồng hồ "dd/MM/yyyy - HH:mm’ (GMT +7)" | VI · EN · FR · ES · 中文 · RU
HEADER     : logo lớn | menu 13 chủ đề
MAIN NAV   : Trang chủ · Chính trị · Xã hội · Kinh tế · Thế giới · Ảnh · Video · Đồ họa · Mega Story · Thông tin nguồn | RSS | Tìm kiếm
QUICK LINKS: Thông tin nguồn · Điều hành tác nghiệp · Xembao.vn · Tra cứu thông tin · Tin · Tin - Ảnh · Ảnh
--- nội dung ---
PARTNERS   : dải logo đối tác (quản lý trong CMS)
FOOTER     : 4 cột danh mục · logo · bản quyền · địa chỉ · Trang chủ | Điều khoản sử dụng | Liên hệ
BACK TO TOP
```

Sửa các lỗi của bản gốc: không để lộ tiêu đề "Footer1..4"; mọi link dùng đường dẫn tuyệt đối từ gốc; ẩn khối khi không có dữ liệu; không khóa zoom trên mobile.

### 3.3 Trang chủ — thứ tự khối

| # | Khối | Nguồn dữ liệu |
|---|---|---|
| 1 | Tin mới nhất (ticker 5 tin, dừng khi hover) | bài PUBLISHED mới nhất |
| 2 | Tiêu điểm ảnh: 1 bộ ảnh lớn + 5 bộ ảnh tiếp theo | slot `HOME_PHOTO_HERO` do CMS chọn, fallback mới nhất |
| 3 | Chuyên đề (carousel banner) | Topic `isFeatured` |
| 4 | Tin thời sự: 4 tab | theo feed |
| 5 | Lưới 13 danh mục: mỗi khối 1 tin chính có ảnh + 2 tin phụ | mới nhất theo danh mục, ưu tiên bài ghim |
| 6 | Tin tức khác | |
| 7 | Tin xem nhiều (top 10 trong 3 ngày) | Redis + DB |
| 8 | Media tabs: Tất cả · Ảnh · Đồ họa · Tin - Ảnh | |
| 9 | Mega Story | |
| 10 | Hoạt động của TTXVN (embed MXH) | cấu hình |
| 11 | Tin vắn kinh tế châu Á | topic 19 |
| 12 | Business Wire | topic 20 |

Trang chủ dùng ISR, `revalidate` 60 giây, và gọi `revalidateTag` khi có bài xuất bản.

### 3.4 Thẻ tin & thời gian
- Biến thể `ArticleCard`: `lead` (ảnh 16:9 + tiêu đề lớn + meta), `list` (tiêu đề + meta), `ticker`.
- Meta: `{thời gian} | {nguồn}`; tên nguồn link tới `/vi/search?source={sourceSlug}`.
- Thời gian: dưới 24 giờ hiển thị tương đối (`47 phút trước`, `3 giờ trước`), từ 24 giờ trở lên hiển thị `dd/MM/yyyy HH:mm`. Múi giờ `Asia/Ho_Chi_Minh`.

### 3.5 Các trang khác
- **Danh mục**: breadcrumb, H1, 1 bài nổi bật + 4 bài lưới, danh sách 20 bài/trang (thumbnail, tiêu đề, sapo, meta), phân trang `?page=`, sidebar xem nhiều.
- **Chi tiết bài (internal)**: breadcrumb, H1, meta (thời gian, tác giả, nguồn), sapo đậm, ảnh đại diện + chú thích, nội dung, tags, chia sẻ, bài liên quan, bài cùng danh mục.
- **Bài nguồn ngoài (external)**: link `/r/{id}` → tăng view → redirect 302 sang `externalUrl`.
- **Chi tiết bộ ảnh**: H1, gallery N ảnh (mỗi ảnh có chú thích kết thúc bằng `Ảnh: {Tác giả} - TTXVN`), các danh mục gắn kèm, sapo, danh sách từng ảnh có timestamp riêng, lightbox hỗ trợ vuốt, ảnh liên quan.
- **Đồ họa, Mega Story, Chuyên đề, Tìm kiếm, RSS, trang tĩnh.**
- Tìm kiếm không phân biệt dấu (`unaccent`), lọc theo danh mục, nguồn, khoảng ngày.

### 3.6 SEO
`<title>`: `{Tiêu đề} - {Danh mục} - Thông tấn xã Việt Nam (TTXVN)`. Có đủ Open Graph (`og:type=article`, `og:image`, thời gian ISO +07:00), JSON-LD `NewsArticle` / `ImageGallery`, `sitemap.xml`, `news-sitemap.xml` (48 giờ), canonical, `hreflang`. Chỉ bài PUBLISHED mới được render và index; mọi trạng thái khác trả về 404 ở public.

---

## 4. PHẦN B — CMS: Đăng nhập & bảo mật

### 4.1 Luồng đăng nhập
1. `/cms/login`: email + mật khẩu (+ captcha sau 3 lần sai).
2. Nếu tài khoản bật 2FA (**bắt buộc** với vai trò duyệt cấp 1, cấp 2, admin) → `/cms/login/2fa` nhập mã TOTP 6 số, hoặc mã dự phòng (backup code).
3. Thành công → tạo session trong DB, cookie `httpOnly`, `secure`, `sameSite=lax`, chuyển về `/cms`.
4. Tài khoản bắt buộc 2FA nhưng chưa thiết lập → chuyển thẳng tới trang thiết lập 2FA, chưa cho vào CMS.
5. Người dùng mới hoặc vừa được admin reset mật khẩu → bắt đổi mật khẩu ở lần đăng nhập đầu.

### 4.2 Yêu cầu bảo mật
- Mật khẩu: tối thiểu 10 ký tự, có chữ hoa, chữ thường, số; băm argon2id.
- Khóa tài khoản 15 phút sau **5 lần sai liên tiếp**; rate limit theo IP (Redis).
- Session hết hạn sau **8 giờ**, hoặc **30 phút không thao tác**; có nút "Đăng xuất mọi thiết bị".
- Quên mật khẩu: gửi link token dùng 1 lần, hết hạn 30 phút; thông báo phản hồi giống nhau dù email có tồn tại hay không.
- CSRF: dùng cơ chế của Auth.js/server actions; header bảo mật (CSP, HSTS, X-Frame-Options).
- `/cms/**` có `X-Robots-Tag: noindex`, không xuất hiện trong sitemap.
- Ghi audit cho: đăng nhập thành công/thất bại, đăng xuất, đổi mật khẩu, bật/tắt 2FA, khóa/mở khóa tài khoản.
- (Tùy chọn) Giới hạn IP truy cập CMS qua biến `CMS_ALLOWED_IPS`.

---

## 5. Vai trò & phân quyền (RBAC)

### 5.1 Vai trò

| Mã | Tên | Mô tả |
|---|---|---|
| `REPORTER` | Phóng viên / Cộng tác viên | Soạn bài, gửi duyệt, sửa bài bị trả lại |
| `EDITOR_L1` | Biên tập viên – Duyệt cấp 1 | Duyệt nội dung, chính tả, ảnh trong **các danh mục được phân công** |
| `EDITOR_L2` | Thư ký tòa soạn / Tổng biên tập – Duyệt cấp 2 | Duyệt cuối, xuất bản / hẹn giờ, gỡ bài |
| `ADMIN` | Quản trị hệ thống | Quản lý người dùng, danh mục, cấu hình; **không mặc định có quyền duyệt** |

Một người có thể giữ nhiều vai trò. `EDITOR_L1` gắn với danh sách danh mục qua bảng `UserCategoryScope`; `EDITOR_L2` duyệt được mọi danh mục (hoặc theo phạm vi nếu được cấu hình).

### 5.2 Ma trận quyền

| Quyền | REPORTER | EDITOR_L1 | EDITOR_L2 | ADMIN |
|---|:-:|:-:|:-:|:-:|
| Tạo bài, sửa bài nháp của mình | ✅ | ✅ | ✅ | ❌ |
| Gửi duyệt bài của mình | ✅ | ✅ | ✅ | ❌ |
| Rút bài đang chờ duyệt cấp 1 | ✅ (bài mình) | | | |
| Xem hàng đợi duyệt cấp 1 | | ✅ (theo phạm vi) | ✅ | |
| Duyệt cấp 1 / trả lại / từ chối | | ✅ | | |
| Sửa nội dung khi đang duyệt cấp 1 | | ✅ (tạo revision) | | |
| Xem hàng đợi duyệt cấp 2 | | | ✅ | |
| Duyệt cấp 2, xuất bản, hẹn giờ | | | ✅ | |
| Trả lại / từ chối ở cấp 2 | | | ✅ | |
| Gỡ bài đã xuất bản (bắt buộc ghi lý do) | | | ✅ | |
| Đính chính bài đã xuất bản | | | ✅ | |
| Ghim bài, chọn bài trang chủ | | | ✅ | |
| Quản lý thư viện media | ✅ (của mình) | ✅ | ✅ | ✅ |
| Quản lý danh mục, chuyên đề, nguồn, đối tác | | | ✅ | ✅ |
| Quản lý người dùng & phân quyền | | | | ✅ |
| Xem audit log | | | ✅ (bài viết) | ✅ (toàn bộ) |

Triển khai trong `lib/rbac/permissions.ts` dưới dạng hằng số, và hàm `can(user, action, resource?)` kiểm tra cả vai trò lẫn phạm vi danh mục.

---

## 6. Quy trình duyệt bài 2 cấp (trọng tâm)

### 6.1 Trạng thái

| Mã | Tên hiển thị | Ai đang giữ bài |
|---|---|---|
| `DRAFT` | Bản nháp | Tác giả |
| `PENDING_L1` | Chờ duyệt cấp 1 | Biên tập viên cấp 1 |
| `IN_REVIEW_L1` | Đang duyệt cấp 1 | BTV cấp 1 đã nhận bài |
| `PENDING_L2` | Chờ duyệt cấp 2 | Thư ký tòa soạn / TBT |
| `IN_REVIEW_L2` | Đang duyệt cấp 2 | Người duyệt cấp 2 đã nhận bài |
| `RETURNED` | Trả lại để sửa | Tác giả |
| `SCHEDULED` | Đã duyệt, hẹn giờ đăng | Hệ thống |
| `PUBLISHED` | Đã xuất bản | — |
| `UNPUBLISHED` | Đã gỡ | Cấp 2 |
| `REJECTED` | Từ chối (không đăng) | — |
| `ARCHIVED` | Lưu trữ | — |

### 6.2 Sơ đồ chuyển trạng thái

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Tạo bài
    DRAFT --> PENDING_L1: Gửi duyệt (tác giả)
    PENDING_L1 --> DRAFT: Rút bài (tác giả)
    PENDING_L1 --> IN_REVIEW_L1: Nhận duyệt (BTV cấp 1)
    IN_REVIEW_L1 --> PENDING_L1: Nhả bài
    IN_REVIEW_L1 --> PENDING_L2: Duyệt cấp 1
    IN_REVIEW_L1 --> RETURNED: Trả lại (bắt buộc lý do)
    IN_REVIEW_L1 --> REJECTED: Từ chối (bắt buộc lý do)
    PENDING_L2 --> IN_REVIEW_L2: Nhận duyệt (cấp 2)
    IN_REVIEW_L2 --> PENDING_L2: Nhả bài
    IN_REVIEW_L2 --> PUBLISHED: Duyệt & xuất bản ngay
    IN_REVIEW_L2 --> SCHEDULED: Duyệt & hẹn giờ
    IN_REVIEW_L2 --> RETURNED: Trả lại tác giả (bắt buộc lý do)
    IN_REVIEW_L2 --> PENDING_L1: Trả về cấp 1 (bắt buộc lý do)
    IN_REVIEW_L2 --> REJECTED: Từ chối (bắt buộc lý do)
    RETURNED --> PENDING_L1: Sửa xong, gửi lại
    SCHEDULED --> PUBLISHED: Đến giờ (job)
    SCHEDULED --> PENDING_L2: Hủy hẹn giờ
    PUBLISHED --> UNPUBLISHED: Gỡ bài (bắt buộc lý do)
    PUBLISHED --> PUBLISHED: Đính chính (cấp 2, ghi chú đính chính)
    UNPUBLISHED --> PENDING_L2: Đưa lại vào duyệt
    REJECTED --> ARCHIVED
    UNPUBLISHED --> ARCHIVED
```

### 6.3 Quy tắc nghiệp vụ bắt buộc
1. **Tách biệt người duyệt**: tác giả không được duyệt bài của chính mình ở bất kỳ cấp nào; người đã duyệt cấp 1 **không được** duyệt cấp 2 cùng phiên bản bài đó. Mỗi cấp phải do một người khác nhau.
2. **Phạm vi**: BTV cấp 1 chỉ nhận được bài thuộc danh mục chính nằm trong phạm vi được phân công.
3. **Bắt buộc lý do** khi trả lại, từ chối, gỡ bài, trả về cấp 1 (tối thiểu 10 ký tự). Lý do hiển thị cho tác giả trong khung bình luận của bài.
4. **Khóa biên tập**: khi một người nhận duyệt (`IN_REVIEW_*`) hoặc đang mở trình soạn thảo, bài bị khóa với người khác (khóa trong Redis, TTL 15 phút, gia hạn bằng heartbeat mỗi 60 giây). Người khác chỉ xem được ở chế độ đọc, kèm thông báo "Đang được {tên} chỉnh sửa".
5. **Sửa khi duyệt**: BTV cấp 1 và cấp 2 được sửa trực tiếp; mỗi lần lưu tạo một revision ghi rõ người sửa. Tác giả **không** được sửa khi bài đang ở `PENDING_*`, `IN_REVIEW_*`, `SCHEDULED`.
6. **Kiểm tra trước khi gửi duyệt**: có tiêu đề (≤ 150 ký tự), sapo (≤ 300 ký tự), danh mục chính, ảnh đại diện có chú thích, nội dung ≥ 100 từ (bài chữ) hoặc ≥ 1 ảnh (bộ ảnh), nguồn, tác giả hiển thị.
7. **Kiểm tra trước khi xuất bản**: slug không trùng; mọi ảnh trong bài đã có alt và chú thích; giờ hẹn đăng phải ở tương lai.
8. **Đính chính bài đã đăng**: chỉ cấp 2; bắt buộc nhập ghi chú đính chính, ghi chú hiển thị cuối bài kèm thời gian; tạo revision mới.
9. **Gỡ bài**: bài biến mất khỏi public ngay (revalidate cache), URL trả về 410 Gone.
10. **Cảnh báo quá hạn**: bài ở `PENDING_L1` quá 2 giờ hoặc `PENDING_L2` quá 1 giờ được tô đỏ trên hàng đợi và gửi nhắc cho người duyệt (ngưỡng cấu hình được).
11. **Tin khẩn**: cờ `isUrgent` đưa bài lên đầu hàng đợi và gửi thông báo ngay; vẫn phải qua đủ 2 cấp.

### 6.4 Triển khai
- `lib/workflow/machine.ts`: bảng chuyển trạng thái `{ from, to, action, requiredPermission, requiresReason, guard }`.
- `lib/workflow/transition.ts`: `transitionArticle({ articleId, action, actorId, reason?, scheduledAt?, expectedVersion })`:
  1. Mở transaction, đọc bài kèm `version` (optimistic locking); sai `expectedVersion` → lỗi `CONFLICT`.
  2. Kiểm tra quyền, phạm vi, quy tắc tách biệt người duyệt, guard.
  3. Cập nhật `status`, các cột người/thời điểm duyệt, tăng `version`.
  4. Ghi `ArticleStatusLog`, `AuditLog`, tạo `Notification`.
  5. Sau commit: revalidate cache public (nếu liên quan PUBLISHED) và gửi email.
- Job BullMQ `publish-scheduled` chạy mỗi phút để chuyển `SCHEDULED` → `PUBLISHED`; job phải idempotent.

### 6.5 Thông báo

| Sự kiện | Người nhận |
|---|---|
| Bài gửi duyệt cấp 1 | BTV cấp 1 có phạm vi danh mục đó |
| Bài được duyệt cấp 1 | Tác giả + toàn bộ người duyệt cấp 2 |
| Bài bị trả lại / từ chối | Tác giả (kèm lý do) |
| Bài đã xuất bản / hẹn giờ | Tác giả + người duyệt cấp 1 |
| Bài bị gỡ / đính chính | Tác giả + người duyệt cấp 1 |
| Bình luận mới trong bài | Những người đã tham gia bài |
| Bài quá hạn chờ duyệt | Người duyệt cấp tương ứng |

Kênh: chuông thông báo trong CMS (cập nhật mỗi 30 giây hoặc SSE) + email (người dùng tự bật/tắt trong hồ sơ).

---

## 7. Màn hình CMS

### 7.1 Dashboard (`/cms`)
- Thẻ số liệu theo vai trò: bài nháp của tôi, bài bị trả lại, chờ duyệt cấp 1, chờ duyệt cấp 2, đã đăng hôm nay, hẹn giờ.
- Danh sách "Việc cần làm" của tôi.
- Biểu đồ số bài xuất bản 7 ngày, top bài xem nhiều.

### 7.2 Danh sách bài (`/cms/articles`)
- Bộ lọc: trạng thái, danh mục, loại bài, tác giả, người duyệt, khoảng ngày, từ khóa, tin khẩn.
- Cột: tiêu đề, loại, danh mục, tác giả, trạng thái (badge màu), người đang giữ, cập nhật lúc, thao tác.
- Phóng viên mặc định chỉ thấy bài của mình.

### 7.3 Trình soạn thảo (`/cms/articles/[id]`)
Bố cục 2 cột:
- **Trái**: tiêu đề, sapo, nội dung Tiptap (đoạn, H2/H3, ảnh có chú thích, gallery, video embed, bảng, trích dẫn, link, box tin liên quan).
- **Phải**: trạng thái + các nút hành động **chỉ hiện những hành động hợp lệ** theo state machine và quyền; danh mục chính + danh mục phụ; loại bài (`NEWS`, `PHOTO_STORY`, `GRAPHIC`, `MEGASTORY`, `EXTERNAL`); nguồn; tác giả hiển thị; ảnh đại diện; tags; chuyên đề; slug (tự sinh, sửa được); SEO title/description; cờ tin khẩn; giờ hẹn đăng (chỉ cấp 2).
- Tự lưu nháp mỗi 30 giây; cảnh báo khi rời trang chưa lưu.
- Khung **bình luận nội bộ** dưới bài, hiển thị cả lý do trả lại/từ chối.
- Nút **Xem trước** mở `/cms/articles/[id]/preview` dùng đúng giao diện public.
- Với loại `PHOTO_STORY`: trình quản lý gallery kéo-thả sắp xếp, mỗi ảnh có chú thích + tác giả ảnh.
- Với loại `EXTERNAL`: chỉ cần tiêu đề, sapo, ảnh, `externalUrl`, nguồn.

### 7.4 Hàng đợi duyệt (`/cms/review/level-1`, `/cms/review/level-2`)
- Sắp xếp: tin khẩn trước, sau đó theo thời gian gửi tăng dần.
- Mỗi dòng: tiêu đề, danh mục, tác giả, thời gian chờ (đỏ nếu quá hạn), người đang giữ.
- Nút **Nhận duyệt**, mở màn hình duyệt có: nội dung, **so sánh khác biệt (diff)** với phiên bản lần gửi trước (nếu là bài gửi lại), lịch sử trạng thái, bình luận, các nút Duyệt / Trả lại / Từ chối (/ Hẹn giờ ở cấp 2).

### 7.5 Lịch sử (`/cms/articles/[id]/history`)
- Danh sách revision: phiên bản, người sửa, thời điểm, trạng thái lúc đó.
- So sánh hai phiên bản bất kỳ; khôi phục phiên bản cũ (chỉ khi bài ở trạng thái cho phép sửa, tạo revision mới).
- Dòng thời gian trạng thái với lý do.

### 7.6 Các trang quản lý khác
- **Media**: upload ảnh (jpg/png/webp, tối đa 15 MB), tự sinh các cỡ `thumb` 320, `stand` 960, `large` 1920 ở định dạng webp; lưu chú thích, tác giả ảnh, alt; tìm kiếm; kiểm tra MIME thật bằng magic bytes.
- **Danh mục / Chuyên đề / Nguồn / Đối tác**: CRUD, sắp xếp kéo-thả, bật/tắt hiển thị.
- **Bố cục trang chủ**: chọn bài cho slot tiêu điểm ảnh, ghim bài đầu danh mục, chọn chuyên đề nổi bật.
- **Người dùng**: tạo, khóa/mở khóa, gán vai trò, gán phạm vi danh mục cho BTV cấp 1, reset mật khẩu, bắt buộc 2FA, buộc đăng xuất.
- **Audit log**: lọc theo người, hành động, đối tượng, thời gian; xuất CSV; chỉ đọc.

---

## 8. Mô hình dữ liệu (Prisma)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { REPORTER EDITOR_L1 EDITOR_L2 ADMIN }

enum ArticleStatus {
  DRAFT PENDING_L1 IN_REVIEW_L1 PENDING_L2 IN_REVIEW_L2
  RETURNED SCHEDULED PUBLISHED UNPUBLISHED REJECTED ARCHIVED
}

enum ArticleType { NEWS PHOTO_STORY GRAPHIC MEGASTORY EXTERNAL }
enum CategoryType { NEWS PHOTO FEED }
enum Locale { vi en }

model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  fullName           String
  passwordHash       String
  roles              Role[]
  isActive           Boolean   @default(true)
  mustChangePassword Boolean   @default(true)
  totpSecret         String?   // mã hóa AES-GCM bằng APP_ENCRYPTION_KEY
  totpEnabled        Boolean   @default(false)
  backupCodes        String[]  // đã băm
  failedLoginCount   Int       @default(0)
  lockedUntil        DateTime?
  lastLoginAt        DateTime?
  emailNotify        Boolean   @default(true)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  sessions           Session[]
  categoryScopes     UserCategoryScope[]
  articles           Article[] @relation("ArticleAuthor")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expires      DateTime
  lastActiveAt DateTime @default(now())
  ip           String?
  userAgent    String?
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
}

model Category {
  id          Int          @id            // giữ ID như bảng mục 3.1
  slug        String
  name        String
  type        CategoryType
  locale      Locale       @default(vi)
  parentId    Int?
  order       Int          @default(0)
  showInMenu  Boolean      @default(true)
  footerCol   Int?
  isActive    Boolean      @default(true)
  @@unique([slug, locale])
}

model UserCategoryScope {
  userId     String
  categoryId Int
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id])
  @@id([userId, categoryId])
}

model Source {
  id       Int     @id @default(autoincrement())
  name     String  @unique   // TTXVN, VietnamPlus, Baotintuc.vn...
  slug     String  @unique
  homepage String?
  logoUrl  String?
}

model Article {
  id              Int           @id @default(autoincrement())
  type            ArticleType
  status          ArticleStatus @default(DRAFT)
  version         Int           @default(1)   // optimistic locking
  locale          Locale        @default(vi)
  title           String
  slug            String
  sapo            String?
  contentJson     Json?         // Tiptap JSON
  contentHtml     String?       // HTML đã sanitize để render
  externalUrl     String?
  coverMediaId    String?
  primaryCatId    Int
  sourceId        Int
  authorId        String
  authorName      String?       // tên hiển thị (bút danh)
  isUrgent        Boolean       @default(false)
  isPinned        Boolean       @default(false)
  seoTitle        String?
  seoDescription  String?
  correctionNote  String?
  submittedAt     DateTime?
  l1ReviewerId    String?
  l1ApprovedAt    DateTime?
  l2ReviewerId    String?
  l2ApprovedAt    DateTime?
  scheduledAt     DateTime?
  publishedAt     DateTime?
  unpublishedAt   DateTime?
  viewCount       Int           @default(0)
  searchVector    Unsupported("tsvector")?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  author          User          @relation("ArticleAuthor", fields: [authorId], references: [id])
  categories      ArticleCategory[]
  tags            ArticleTag[]
  photos          ArticlePhoto[]
  revisions       ArticleRevision[]
  statusLogs      ArticleStatusLog[]
  comments        ArticleComment[]
  @@unique([slug, locale])
  @@index([status, publishedAt])
  @@index([primaryCatId, status, publishedAt])
}

model ArticleCategory { articleId Int; categoryId Int; @@id([articleId, categoryId]) }
model Tag { id Int @id @default(autoincrement()); name String @unique; slug String @unique }
model ArticleTag { articleId Int; tagId Int; @@id([articleId, tagId]) }

model Media {
  id           String   @id @default(cuid())
  key          String   @unique   // đường dẫn S3: yyyy/MM/dd/{id}/
  mime         String
  width        Int
  height       Int
  sizeBytes    Int
  caption      String?
  alt          String?
  photographer String?
  uploadedById String
  createdAt    DateTime @default(now())
}

model ArticlePhoto {
  id        String  @id @default(cuid())
  articleId Int
  mediaId   String
  caption   String
  order     Int
  takenAt   DateTime?
}

model ArticleRevision {
  id          String   @id @default(cuid())
  articleId   Int
  version     Int
  snapshot    Json     // toàn bộ trường nội dung tại thời điểm lưu
  editorId    String
  statusAtSave ArticleStatus
  note        String?
  createdAt   DateTime @default(now())
  @@unique([articleId, version])
}

model ArticleStatusLog {
  id         String        @id @default(cuid())
  articleId  Int
  fromStatus ArticleStatus
  toStatus   ArticleStatus
  action     String
  actorId    String
  reason     String?
  createdAt  DateTime      @default(now())
  @@index([articleId, createdAt])
}

model ArticleComment {
  id        String   @id @default(cuid())
  articleId Int
  authorId  String
  body      String
  kind      String   @default("COMMENT") // COMMENT | RETURN_REASON | REJECT_REASON
  createdAt DateTime @default(now())
}

model Notification {
  id        String    @id @default(cuid())
  userId    String
  type      String
  title     String
  link      String?
  readAt    DateTime?
  createdAt DateTime  @default(now())
  @@index([userId, readAt])
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String   // LOGIN_SUCCESS, ARTICLE_APPROVE_L1, USER_ROLE_CHANGE...
  entityType String
  entityId   String?
  metadata   Json?
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())
  @@index([entityType, entityId])
  @@index([actorId, createdAt])
}

model Topic   { id Int @id; slug String @unique; name String; bannerUrl String?; isFeatured Boolean @default(false); order Int @default(0) }
model Partner { id Int @id @default(autoincrement()); name String; logoUrl String; url String; order Int @default(0); isActive Boolean @default(true) }
model HomeSlot { key String @id; articleIds Int[]; updatedById String; updatedAt DateTime @updatedAt }
model StaticPage { id Int @id @default(autoincrement()); slug String @unique; title String; contentHtml String; updatedAt DateTime @updatedAt }
```

Bổ sung các relation còn thiếu khi viết schema thật. Cột `searchVector` cập nhật bằng trigger SQL dùng `unaccent`, viết trong migration thủ công.

---

## 9. API / Server actions

**Public (GET, có cache):**
`/api/public/articles/latest`, `/api/public/articles?category=&page=`, `/api/public/articles/most-viewed`, `/api/public/search?q=&source=&from=&to=`, `/r/{id}`, `/rss/{catSlug}`.

**CMS (server actions, đều qua `requireUser()` + `can()`):**

| Action | Mô tả |
|---|---|
| `createArticle(input)` | Tạo nháp |
| `updateArticle(id, input, expectedVersion)` | Lưu nội dung, tạo revision |
| `transitionArticle(...)` | Mọi chuyển trạng thái (mục 6.4) |
| `acquireLock(id)` / `heartbeatLock(id)` / `releaseLock(id)` | Khóa biên tập |
| `addComment(id, body)` | Bình luận nội bộ |
| `restoreRevision(id, version)` | Khôi phục phiên bản |
| `uploadMedia(file)` | Upload + resize |
| `setHomeSlot(key, articleIds)` | Bố cục trang chủ |
| `createUser / updateUserRoles / setCategoryScopes / lockUser / resetPassword / forceLogout` | Quản lý người dùng |

Mã lỗi thống nhất: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `LOCKED`, `INVALID_TRANSITION`, `SELF_REVIEW_NOT_ALLOWED`. Thông báo hiển thị bằng tiếng Việt.

---

## 10. Bảo mật nội dung
- Sanitize HTML đầu ra của Tiptap bằng `sanitize-html` với whitelist thẻ/thuộc tính; chỉ cho phép iframe từ YouTube và video.vnanet.vn (cấu hình được).
- `externalUrl` phải là `https://` và nằm trong danh sách domain của bảng `Source`, để tránh open redirect ở `/r/{id}`.
- Upload: kiểm tra magic bytes, giới hạn dung lượng, xóa EXIF GPS, đổi tên file theo id.
- Chỉ bài `PUBLISHED` được truy vấn ở các route public (đặt điều kiện trong một hàm repository chung, có test).

---

## 11. Biến môi trường (`.env.example`)

```
DATABASE_URL=postgresql://news:news@localhost:5432/news
REDIS_URL=redis://localhost:6379
AUTH_SECRET=
APP_ENCRYPTION_KEY=          # 32 byte base64, mã hóa TOTP secret
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=media
S3_ACCESS_KEY=
S3_SECRET_KEY=
PUBLIC_MEDIA_BASE_URL=http://localhost:9000/media
SMTP_URL=smtp://localhost:1025
MAIL_FROM="CMS Tòa soạn <no-reply@example.vn>"
SITE_URL=http://localhost:3000
CMS_ALLOWED_IPS=
REVIEW_SLA_L1_MINUTES=120
REVIEW_SLA_L2_MINUTES=60
```

---

## 12. Dữ liệu seed
- Đủ danh mục ở mục 3.1, 6 nguồn (TTXVN, VietnamPlus, Baotintuc.vn, Bnews, TT&VH, Vietnam News), 2 chuyên đề, 10 đối tác (logo placeholder).
- Tài khoản demo (mật khẩu `Demo@123456`, bắt đổi ở lần đầu khi chạy ngoài môi trường dev):

| Email | Vai trò | Phạm vi |
|---|---|---|
| `admin@demo.vn` | ADMIN | — |
| `tbt@demo.vn` | EDITOR_L2 | toàn bộ |
| `btv.chinhtri@demo.vn` | EDITOR_L1 | Chính trị, Xã hội, Pháp luật |
| `btv.kinhte@demo.vn` | EDITOR_L1 | Kinh tế, KH-CN, Môi trường |
| `pv1@demo.vn`, `pv2@demo.vn` | REPORTER | — |

- 60 bài giả ở đủ các trạng thái, 6 bộ ảnh (ảnh placeholder tự sinh), 3 đồ họa, 2 megastory. Nội dung seed do Claude tự viết, không lấy từ báo thật.

---

## 13. Kiểm thử bắt buộc

**Unit (Vitest):**
- Mọi cặp `(trạng thái, hành động)` hợp lệ/không hợp lệ của state machine.
- `can()` cho từng vai trò × hành động × phạm vi danh mục.
- Tác giả không tự duyệt được; người duyệt cấp 1 không duyệt cấp 2 cùng bài.
- Thiếu lý do khi trả lại/từ chối/gỡ → lỗi.
- Optimistic locking: hai người lưu cùng lúc → người sau nhận `CONFLICT`.
- Hàm slug tiếng Việt, định dạng thời gian tương đối.

**E2E (Playwright) — luồng chính:**
1. `pv1` đăng nhập → tạo bài Chính trị → gửi duyệt.
2. `btv.kinhte` **không** thấy bài trong hàng đợi; `btv.chinhtri` thấy → nhận duyệt → trả lại kèm lý do.
3. `pv1` thấy lý do → sửa → gửi lại.
4. `btv.chinhtri` xem diff → duyệt cấp 1.
5. `tbt` (đăng nhập có 2FA) → nhận duyệt → hẹn giờ 2 phút → job xuất bản → bài hiện trên trang chủ và trang danh mục.
6. `tbt` gỡ bài → URL public trả 410.
7. Đăng nhập sai 5 lần → tài khoản bị khóa.
8. Truy cập `/cms/articles` khi chưa đăng nhập → chuyển về `/cms/login`.

---

## 14. Kế hoạch triển khai theo giai đoạn

| GĐ | Nội dung | Tiêu chí hoàn thành |
|---|---|---|
| 1 | Khởi tạo dự án, docker-compose, Prisma schema, migration, seed | `pnpm db:seed` chạy được, có dữ liệu |
| 2 | Xác thực CMS: đăng nhập, 2FA, quên mật khẩu, khóa tài khoản, session, middleware | E2E bước 7, 8 qua |
| 3 | RBAC + quản lý người dùng & phạm vi danh mục | Unit test `can()` qua |
| 4 | Trình soạn thảo, media upload, revision, tự lưu, khóa biên tập | Tạo/sửa bài, upload ảnh được |
| 5 | **State machine duyệt 2 cấp**, hàng đợi, bình luận, diff, thông báo, job hẹn giờ, audit log | E2E bước 1–6 qua |
| 6 | Public site: layout toàn cục, trang chủ 12 khối, danh mục, chi tiết bài, bộ ảnh | Hiển thị đúng chỉ bài PUBLISHED |
| 7 | Đồ họa, megastory, chuyên đề, tìm kiếm, RSS, sitemap, SEO, i18n `/en` | Sitemap hợp lệ, tìm kiếm không dấu chạy |
| 8 | Dashboard, bố cục trang chủ trong CMS, audit log UI, xuất CSV | |
| 9 | Hiệu năng, accessibility, bảo mật header, Lighthouse ≥ 90, tài liệu `README.md` | Toàn bộ test xanh |

---

## 15. Lệnh thường dùng

```bash
docker compose up -d
pnpm install
pnpm prisma migrate dev
pnpm db:seed
pnpm dev                 # http://localhost:3000/vi  và  http://localhost:3000/cms
pnpm worker              # chạy BullMQ worker (hẹn giờ đăng, gửi email)
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

---

## 16. Prompt khởi động gợi ý

```
Đọc kỹ CLAUDE.md. Thực hiện Giai đoạn 1 ở mục 14: khởi tạo Next.js 15 + TypeScript
strict + Tailwind + pnpm, viết docker-compose.yml, Prisma schema theo mục 8, migration
(kèm trigger tsvector unaccent) và seed theo mục 12. Ghi các giả định vào
docs/DECISIONS.md. Xong thì chạy lint, typecheck, seed và báo cáo kết quả.
```

Các giai đoạn sau: "Tiếp tục Giai đoạn N theo CLAUDE.md".
