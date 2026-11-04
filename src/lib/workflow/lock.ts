import { kv } from "@/lib/kv";

/** Khóa biên tập: TTL 15 phút, gia hạn bằng heartbeat mỗi 60 giây. */
export const LOCK_TTL_SEC = 15 * 60;

export interface EditLock {
  userId: string;
  name: string;
}

const key = (articleId: number) => `lock:article:${articleId}`;

export async function getLock(articleId: number): Promise<EditLock | null> {
  const raw = await (await kv()).get(key(articleId));
  return raw ? (JSON.parse(raw) as EditLock) : null;
}

/** Trả về khóa hiện tại sau khi thử chiếm; nếu người khác đang giữ thì trả về khóa của họ. */
export async function acquireLock(articleId: number, user: EditLock): Promise<EditLock> {
  const store = await kv();
  const ok = await store.set(key(articleId), JSON.stringify(user), LOCK_TTL_SEC, { nx: true });
  if (ok) return user;
  const current = await getLock(articleId);
  if (!current || current.userId === user.userId) {
    await store.set(key(articleId), JSON.stringify(user), LOCK_TTL_SEC);
    return user;
  }
  return current;
}

export async function heartbeatLock(articleId: number, user: EditLock): Promise<boolean> {
  const current = await getLock(articleId);
  if (current && current.userId !== user.userId) return false;
  await (await kv()).set(key(articleId), JSON.stringify(user), LOCK_TTL_SEC);
  return true;
}

export async function releaseLock(articleId: number, userId?: string): Promise<void> {
  const current = await getLock(articleId);
  if (!current || (userId && current.userId !== userId)) return;
  await (await kv()).del(key(articleId));
}
