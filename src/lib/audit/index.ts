import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

export async function writeAudit(input: AuditInput, tx: Tx = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId != null ? String(input.entityId) : null,
      metadata: input.metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  });
}
