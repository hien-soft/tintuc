/**
 * Postgres 16 nhúng (gói `embedded-postgres`) cho máy không có Docker.
 * Khởi động qua pg_ctl vì trên Windows pg_ctl tự hạ quyền, chạy được cả khi terminal là Administrator.
 */
import EmbeddedPostgres from "embedded-postgres";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import net from "net";

/** Cổng lấy từ DATABASE_URL (đọc .env nếu cần), mặc định 5432 — đổi cổng khi 5432 đã bị Postgres khác chiếm. */
export function pgPort(): number {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // không có .env
    }
  }
  try {
    return Number(new URL(process.env.DATABASE_URL ?? "").port) || 5432;
  } catch {
    return 5432;
  }
}
const dataDir = path.resolve("storage/pgdata");

function pgCtlPath(): string {
  const pkg = process.platform === "win32" ? "@embedded-postgres/windows-x64" : `@embedded-postgres/${process.platform}-${process.arch}`;
  // gói nhị phân nằm cạnh embedded-postgres trong store của pnpm
  const entry = createRequire(require.resolve("embedded-postgres")).resolve(pkg);
  return path.resolve(path.dirname(entry), "..", "native", "bin", process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");
}

/** Khởi tạo (lần đầu), bật Postgres nếu chưa chạy và tạo database `news`. Postgres chạy nền, sống tiếp sau khi hàm trả về. */
export async function startPostgres(): Promise<void> {
  const PG_PORT = pgPort();
  const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
  const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "news", password: "news", port: PG_PORT, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
  if (fresh) await pg.initialise();

  const pgCtl = pgCtlPath();
  // Postgres cũ có thể đang tắt dở (vừa đóng cửa sổ trước): "status" báo đang chạy nhưng lát nữa mới tắt hẳn.
  // Vì vậy lặp lại cho tới khi cổng thật sự nhận kết nối.
  for (let attempt = 0; attempt < 3; attempt++) {
    let running = true;
    try {
      execFileSync(pgCtl, ["-D", dataDir, "status"], { stdio: "ignore" });
    } catch {
      running = false;
    }
    if (!running) execFileSync(pgCtl, ["-D", dataDir, "-o", `-p ${PG_PORT}`, "-l", path.resolve("storage/postgres.log"), "-w", "start"], { stdio: "inherit" });
    if (await waitForPort(PG_PORT, 10_000)) break;
  }

  await pg.createDatabase("news").catch(() => undefined); // đã tồn tại thì bỏ qua
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (ok) {
      // đợi 1 giây rồi hỏi lại pg_ctl, để chắc đây không phải Postgres đang tắt dở
      await new Promise((r) => setTimeout(r, 1000));
      try {
        execFileSync(pgCtlPath(), ["-D", dataDir, "status"], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export function stopPostgres(): void {
  try {
    execFileSync(pgCtlPath(), ["-D", dataDir, "-m", "fast", "stop"], { stdio: "inherit" });
  } catch {
    // đã dừng
  }
}
