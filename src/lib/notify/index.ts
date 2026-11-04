import type { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/config";

type Tx = Prisma.TransactionClient;

export interface NotificationInput {
  type: string;
  title: string;
  link?: string;
}

export async function notifyUsers(tx: Tx, userIds: string[], input: NotificationInput): Promise<string[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];
  await tx.notification.createMany({ data: unique.map((userId) => ({ userId, ...input })) });
  return unique;
}

let transporter: nodemailer.Transporter | null = null;

function mailer(): nodemailer.Transporter | null {
  if (!process.env.SMTP_URL) return null;
  transporter ??= nodemailer.createTransport(process.env.SMTP_URL);
  return transporter;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const t = mailer();
  if (!t) {
    console.info(`[mail] (SMTP chưa cấu hình) Tới ${to}: ${subject}\n${text}`);
    return;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
  } catch (e) {
    console.warn(`[mail] Gửi email tới ${to} thất bại:`, (e as Error).message);
  }
}

/** Gửi email cho những người đã bật nhận email — gọi sau khi transaction commit. */
export async function emailUsers(userIds: string[], input: NotificationInput): Promise<void> {
  if (userIds.length === 0) return;
  const users = await db.user.findMany({ where: { id: { in: userIds }, emailNotify: true, isActive: true }, select: { email: true } });
  const link = input.link ? `${SITE_URL}${input.link}` : SITE_URL;
  await Promise.all(users.map((u) => sendMail(u.email, input.title, `${input.title}\n\nXem chi tiết: ${link}`)));
}
