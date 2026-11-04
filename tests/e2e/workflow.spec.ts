/**
 * E2E luồng chính (mục 13). Yêu cầu: DB vừa seed (`pnpm db:seed`), `pnpm dev` đang chạy.
 * Chạy: pnpm exec playwright install chromium && pnpm test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { authenticator } from "otplib";

const PASSWORD = "Demo@123456";
const TOTP_SECRET = "KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD"; // xem prisma/seed.ts
const TITLE = `Bài E2E chính trị ${Date.now()}`;
const BODY = "Nội dung kiểm thử tự động. ".repeat(30);

/** Giải captcha (phép cộng) nếu đang hiển thị — bật sau 3 lần sai theo IP, kể cả từ lần chạy trước. */
async function solveCaptcha(page: Page) {
  const captcha = page.getByLabel(/Mã xác nhận/);
  if (!(await captcha.isVisible().catch(() => false))) return;
  const q = (await page.locator("label[for=captchaAnswer] strong").textContent()) ?? "0 + 0";
  const [a, b] = q.match(/\d+/g)!.map(Number);
  await captcha.fill(String(a + b));
}

async function login(page: Page, email: string) {
  await page.goto("/Admin/login");
  const loggedIn = /\/Admin(\/login\/2fa)?$/;
  // Captcha chỉ xuất hiện sau khi server từ chối lần gửi đầu → gửi lại tối đa một lần.
  for (let attempt = 0; attempt < 2 && !loggedIn.test(page.url()); attempt++) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mật khẩu").fill(PASSWORD);
    await solveCaptcha(page);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await Promise.race([
      page.waitForURL(loggedIn).catch(() => {}),
      page.getByLabel(/Mã xác nhận/).waitFor().catch(() => {}),
    ]);
  }
  await page.waitForURL(loggedIn);
  if (page.url().endsWith("/Admin/login/2fa")) {
    await page.getByLabel(/Mã 6 số/).fill(authenticator.generate(TOTP_SECRET));
    await page.getByRole("button", { name: "Xác thực" }).click();
    await page.waitForURL(/\/Admin$/);
  }
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL("**/Admin/login");
}

test.describe.serial("Quy trình duyệt bài 2 cấp", () => {
  let articleUrl = "";

  test("1. pv2 tạo bài Chính trị và gửi duyệt", async ({ page }) => {
    await login(page, "pv2@demo.vn");
    await page.goto("/Admin/articles/new");
    await page.getByRole("button", { name: "Tạo tin bài" }).click();
    await page.waitForURL(/\/Admin\/articles\/\d+$/);
    articleUrl = page.url();
    await page.getByLabel("Tiêu đề", { exact: true }).fill(TITLE);
    await page.getByLabel("Sapo").fill("Sapo bài kiểm thử E2E.");
    await page.locator(".ProseMirror").fill(BODY);
    await page.getByLabel("Danh mục chính").selectOption({ label: "Chính trị" });
    await page.getByRole("button", { name: "Chọn ảnh" }).click();
    await page.locator("[role=dialog] button.overflow-hidden").first().click();
    await page.getByRole("button", { name: /^Chọn/ }).last().click();
    await page.getByRole("button", { name: "Gửi duyệt" }).click();
    await expect(page.getByText("Đã thực hiện: Gửi duyệt.")).toBeVisible();
    await logout(page);
  });

  test("2. btv.kinhte không thấy bài; btv.chinhtri nhận duyệt và trả lại", async ({ page }) => {
    await login(page, "btv.kinhte@demo.vn");
    await page.goto("/Admin/review/level-1");
    await expect(page.getByText(TITLE)).toHaveCount(0);
    await logout(page);

    await login(page, "btv.chinhtri@demo.vn");
    await page.goto("/Admin/review/level-1");
    const row = page.locator("tr", { hasText: TITLE });
    await row.getByRole("button", { name: "Nhận duyệt" }).click();
    await page.waitForURL(articleUrl);
    await page.getByRole("button", { name: "Trả lại" }).click();
    await page.getByLabel(/Lý do/).fill("Cần bổ sung nguồn trích dẫn cho đoạn hai.");
    await page.getByRole("button", { name: "Xác nhận" }).click();
    await expect(page.getByText("Đã thực hiện: Trả lại.")).toBeVisible();
    await logout(page);
  });

  test("3. pv2 thấy lý do, sửa và gửi lại", async ({ page }) => {
    await login(page, "pv2@demo.vn");
    await page.goto(articleUrl);
    await expect(page.getByText("Cần bổ sung nguồn trích dẫn cho đoạn hai.").first()).toBeVisible();
    await page.getByLabel("Sapo").fill("Sapo đã bổ sung nguồn trích dẫn.");
    await page.getByRole("button", { name: "Gửi lại" }).click();
    await expect(page.getByText("Đã thực hiện: Gửi lại.")).toBeVisible();
    await logout(page);
  });

  test("4. btv.chinhtri xem diff và duyệt cấp 1", async ({ page }) => {
    await login(page, "btv.chinhtri@demo.vn");
    await page.goto("/Admin/review/level-1");
    await page.locator("tr", { hasText: TITLE }).getByRole("button", { name: "Nhận duyệt" }).click();
    await page.waitForURL(articleUrl);
    await expect(page.getByText("Khác biệt so với lần gửi duyệt trước")).toBeVisible();
    await page.getByRole("button", { name: "Duyệt cấp 1" }).click();
    await expect(page.getByText("Đã thực hiện: Duyệt cấp 1.")).toBeVisible();
    await logout(page);
  });

  test("5. tbt (2FA) nhận duyệt và xuất bản → bài hiện trên trang chủ và danh mục", async ({ page }) => {
    await login(page, "tbt@demo.vn");
    await page.goto("/Admin/review/level-2");
    await page.locator("tr", { hasText: TITLE }).getByRole("button", { name: "Nhận duyệt" }).click();
    await page.waitForURL(articleUrl);
    await page.getByRole("button", { name: "Duyệt & xuất bản" }).click();
    await expect(page.getByText("Đã thực hiện: Duyệt & xuất bản.")).toBeVisible();
    await page.goto("/vi");
    await expect(page.getByText(TITLE).first()).toBeVisible();
    await page.goto("/vi/tin-tuc/chinh-tri-11");
    await expect(page.getByText(TITLE).first()).toBeVisible();
  });

  test("6. tbt gỡ bài → URL public trả 410", async ({ page, request }) => {
    await login(page, "tbt@demo.vn");
    await page.goto(articleUrl);
    const publicHref = await page.getByRole("link", { name: /Xem bài trên trang công khai/ }).getAttribute("href");
    await page.getByRole("button", { name: "Gỡ bài" }).click();
    await page.getByLabel(/Lý do/).fill("Thông tin cần được kiểm chứng lại.");
    await page.getByRole("button", { name: "Xác nhận" }).click();
    await expect(page.getByText("Đã thực hiện: Gỡ bài.")).toBeVisible();
    const res = await request.get(publicHref as string);
    expect(res.status()).toBe(410);
  });
});

test("7. Đăng nhập sai 5 lần → tài khoản bị khóa", async ({ page }) => {
  await page.goto("/Admin/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Email").fill("pv2@demo.vn");
    await page.getByLabel("Mật khẩu").fill("SaiMatKhau123");
    await solveCaptcha(page);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.waitForTimeout(500);
  }
  await expect(page.getByText(/khóa/)).toBeVisible();
});

test("8. Truy cập /Admin/articles khi chưa đăng nhập → chuyển về /Admin/login", async ({ page, baseURL }) => {
  await page.goto("/Admin/articles");
  // Đúng host đang dùng (127.0.0.1 không bị đổi thành localhost, nếu không cookie phiên sẽ mất).
  await expect(page).toHaveURL(new URL("/Admin/login", baseURL).toString());
});
