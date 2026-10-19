// Shared idempotency helper for entitlements consume and refund.
// See docs/data-model.md §3 and docs/architecture.md §3.3.

import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

const log = new Logger('idempotency');

export type ConsumeArgs = { accountId: string; idempotencyKey: string };

export async function recordConsume(prisma: PrismaService, args: ConsumeArgs): Promise<'ok' | 'duplicate'> {
  try {
    await prisma.formCheckEvent.create({
      data: { accountId: args.accountId, kind: 'consume', idempotencyKey: args.idempotencyKey },
    });
    return 'ok';
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'P2002') return 'duplicate';
    log.error('recordConsume failed', e as Error);
    throw e;
  }
}
