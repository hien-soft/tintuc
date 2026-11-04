/**
 * Postgres 16 nhúng cho môi trường dev không có Docker: `pnpm db:local` (giữ terminal mở, Ctrl+C để dừng).
 */
import { PG_PORT, startPostgres, stopPostgres } from "./lib/postgres";

startPostgres()
  .then(() => {
    console.log(`Postgres đang chạy tại postgresql://news:news@localhost:${PG_PORT}/news (Ctrl+C để dừng)`);
    const stop = () => {
      stopPostgres();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    setInterval(() => undefined, 1 << 30);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
