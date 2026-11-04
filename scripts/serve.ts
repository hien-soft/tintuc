/**
 * Chạy toàn bộ hệ thống bằng một lệnh: `pnpm serve` (hoặc nhấp đúp start.cmd).
 *   1. Bật Postgres nhúng   2. Áp migration   3. Build nếu chưa có (hoặc khi có cờ --build)
 *   4. Chạy web + CMS (next start) trên host/cổng lấy từ SITE_URL   5. Chạy worker hẹn giờ đăng
 * Ctrl+C dừng tất cả, kể cả Postgres.
 */
import { spawn, spawnSync, type ChildProcess } from "child_process";
import fs from "fs";
import { startPostgres, stopPostgres } from "./lib/postgres";
import { startWorker } from "./lib/worker";

try {
  process.loadEnvFile(".env");
} catch {
  // không có .env — dùng biến môi trường sẵn có
}

const SITE_URL = (process.env.SITE_URL ?? "http://127.0.0.1:5500").replace(/\/$/, "");
const { hostname, port } = new URL(SITE_URL);
const PORT = port || "80";
const nextBin = require.resolve("next/dist/bin/next");
const prismaBin = require.resolve("prisma/build/index.js");

function run(step: string, bin: string, args: string[]) {
  console.log(`\n▶ ${step}`);
  const r = spawnSync(process.execPath, [bin, ...args], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`✖ ${step} thất bại.`);
    stopPostgres();
    process.exit(r.status ?? 1);
  }
}

async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${SITE_URL}/Admin/login`);
      if (res.ok) return true;
    } catch {
      // chưa sẵn sàng
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log("▶ Bật Postgres");
  await startPostgres();
  run("Áp migration", prismaBin, ["migrate", "deploy"]);
  if (process.argv.includes("--build") || !fs.existsSync(".next/BUILD_ID")) run("Build production", nextBin, ["build"]);

  console.log(`\n▶ Chạy web + CMS tại ${SITE_URL}`);
  const web: ChildProcess = spawn(process.execPath, [nextBin, "start", "-H", hostname, "-p", PORT], {
    stdio: "inherit",
    env: { ...process.env, PORT },
  });

  let worker: NodeJS.Timeout | undefined;
  const shutdown = (code = 0) => {
    if (worker) clearInterval(worker);
    if (web.exitCode === null) web.kill();
    stopPostgres();
    process.exit(code);
  };
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  web.on("exit", (code) => {
    console.error(`✖ Web server đã dừng (mã ${code}). Cổng ${PORT} có thể đang bị chiếm.`);
    shutdown(code ?? 1);
  });

  if (!(await waitForServer())) {
    console.error("✖ Web server không phản hồi sau 60 giây.");
    shutdown(1);
  }
  worker = startWorker(SITE_URL);
  console.log(`\n✔ Sẵn sàng\n  Trang công khai: ${SITE_URL}/vi\n  CMS:            ${SITE_URL}/Admin\n  Ctrl+C để dừng tất cả.\n`);
}

main().catch((e) => {
  console.error(e);
  stopPostgres();
  process.exit(1);
});
