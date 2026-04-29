import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MessageStatus } from '../../generated/prisma/index';
import { PrismaService } from '../../infra/database/prisma.service';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class RetryWorker {
  private readonly logger = new Logger(RetryWorker.name);
  private readonly maxRetryCount = Number(process.env.MAX_RETRY_COUNT || 3);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  @Cron('*/15 * * * * *')
  async processFailedMessages() {
    const claimedRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH claimed AS (
        SELECT id
        FROM "Message"
        WHERE status = ${MessageStatus.FAILED}::"MessageStatus"
          AND "retryCount" < ${this.maxRetryCount}
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW())
        ORDER BY "updatedAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 20
      )
      UPDATE "Message" m
      SET "nextRetryAt" = NOW() + INTERVAL '30 seconds'
      FROM claimed
      WHERE m.id = claimed.id
      RETURNING m.id
    `;

    const candidateIds = claimedRows.map((row) => row.id);
    if (candidateIds.length === 0) return;

    for (const messageId of candidateIds) {
      try {
        await this.messagesService.retryMessage(messageId);
      } catch (error: any) {
        this.logger.warn(`Retry failed for ${messageId}: ${error?.message || 'unknown'}`);
      }
    }
  }
}
