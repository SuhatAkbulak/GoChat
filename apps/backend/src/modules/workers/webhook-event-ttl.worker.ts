import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class WebhookEventTtlWorker {
  private readonly logger = new Logger(WebhookEventTtlWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *')
  async purgeExpiredWebhookEvents() {
    const ttlHours = Number(process.env.WEBHOOK_EVENT_TTL_HOURS || 24);
    if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
      this.logger.warn(`Skipping webhook TTL purge due to invalid WEBHOOK_EVENT_TTL_HOURS=${ttlHours}`);
      return;
    }

    const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
    const result = await this.prisma.webhookEvent.deleteMany({
      where: {
        receivedAt: {
          lt: cutoff,
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`WebhookEvent TTL purge deleted ${result.count} rows (cutoff=${cutoff.toISOString()})`);
    }
  }
}
