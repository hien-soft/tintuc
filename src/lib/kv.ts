/**
 * Kho key-value ngắn hạn: dùng Redis khi REDIS_URL kết nối được, ngược lại dùng bảng KvEntry trong Postgres.
 * Dùng cho khóa biên tập và rate limit.
 */
import Redis from "ioredis";
import { db } from "./db";

interface Kv {
  get(key: string): Promise<string | null>;
  /** Trả về false nếu `nx` và khóa đã tồn tại. */
  set(key: string, value: string, ttlSec: number, opts?: { nx?: boolean }): Promise<boolean>;
  incr(key: string, ttlSec: number): Promise<number>;
  del(key: string): Promise<void>;
}

const dbKv: Kv = {
  async get(key) {
    const row = await db.kvEntry.findUnique({ where: { key } });
    if (!row || row.expiresAt < new Date()) return null;
    return row.value;
  },
  async set(key, value, ttlSec, opts) {
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    if (opts?.nx) {
      // chỉ ghi đè khi khóa cũ đã hết hạn
      const n = await db.$executeRaw`
        INSERT INTO "KvEntry" ("key", "value", "expiresAt") VALUES (${key}, ${value}, ${expiresAt})
        ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "expiresAt" = EXCLUDED."expiresAt"
        WHERE "KvEntry"."expiresAt" < now()`;
      return n > 0;
    }
    await db.kvEntry.upsert({ where: { key }, create: { key, value, expiresAt }, update: { value, expiresAt } });
    return true;
  },
  async incr(key, ttlSec) {
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    const rows = await db.$queryRaw<{ value: string }[]>`
      INSERT INTO "KvEntry" ("key", "value", "expiresAt") VALUES (${key}, '1', ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        "value" = CASE WHEN "KvEntry"."expiresAt" < now() THEN '1' ELSE ("KvEntry"."value"::int + 1)::text END,
        "expiresAt" = CASE WHEN "KvEntry"."expiresAt" < now() THEN EXCLUDED."expiresAt" ELSE "KvEntry"."expiresAt" END
      RETURNING "value"`;
    return Number(rows[0]?.value ?? 1);
  },
  async del(key) {
    await db.kvEntry.deleteMany({ where: { key } });
  },
};

function redisKv(client: Redis): Kv {
  return {
    get: (key) => client.get(key),
    async set(key, value, ttlSec, opts) {
      const res = opts?.nx ? await client.set(key, value, "EX", ttlSec, "NX") : await client.set(key, value, "EX", ttlSec);
      return res === "OK";
    },
    async incr(key, ttlSec) {
      const n = await client.incr(key);
      if (n === 1) await client.expire(key, ttlSec);
      return n;
    },
    async del(key) {
      await client.del(key);
    },
  };
}

const globalForKv = globalThis as unknown as { kvPromise?: Promise<Kv> };

async function init(): Promise<Kv> {
  const url = process.env.REDIS_URL;
  if (!url) return dbKv;
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500, enableOfflineQueue: false, retryStrategy: () => null });
  client.on("error", () => undefined);
  try {
    await client.connect();
    return redisKv(client);
  } catch {
    client.disconnect();
    console.warn("[kv] Không kết nối được Redis, dùng bảng KvEntry trong Postgres.");
    return dbKv;
  }
}

export function kv(): Promise<Kv> {
  globalForKv.kvPromise ??= init();
  return globalForKv.kvPromise;
}
