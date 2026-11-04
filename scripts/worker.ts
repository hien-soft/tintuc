/**
 * Worker hẹn giờ đăng + nhắc bài quá hạn, chạy riêng: pnpm worker (`pnpm serve` đã tự chạy worker).
 */
import { startWorker } from "./lib/worker";

try {
  process.loadEnvFile(".env");
} catch {
  // không có .env — dùng biến môi trường sẵn có
}
startWorker((process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""));
