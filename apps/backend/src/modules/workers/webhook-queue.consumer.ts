import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index';
import { QUEUES } from '../../infra/queue/rabbitmq.constants';
import { RabbitMqService } from '../../infra/queue/rabbitmq.service';
import { MockMetaWebhookDto } from '../webhooks/dto/mock-meta-webhook.dto';
import { isTransientIngestError } from '../webhooks/webhook-ingest.error-map';
import { WebhookIngestJob, WebhooksService } from '../webhooks/webhooks.service';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [400, 1200, 3600];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class WebhookQueueConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitMq: RabbitMqService,
    private readonly webhooksService: WebhooksService,
  ) {}

  async onModuleInit() {
    if (!this.rabbitMq.isConnected()) {
      return;
    }

    await this.rabbitMq.consumeWebhookJson<WebhookIngestJob>(
      QUEUES.WEBHOOK_INGEST,
      async (job) => {
        await this.processJob(job);
      },
    );
  }

  private async processJob(job: WebhookIngestJob) {
    const dto = job.dto as MockMetaWebhookDto;
    let lastError: unknown = new Error('Webhook ingest exhausted retries');

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.webhooksService.ingestMockMetaWebhook(dto);
        if (result && typeof result === 'object' && 'success' in result && result.success) {
          return;
        }
        lastError = new Error('Unexpected webhook ingest result shape');
        break;
      } catch (error) {
        lastError = error;
        const transient = isTransientIngestError(error);
        this.webhooksService.logIngestFailure(
          'async',
          { eventId: dto.eventId, ingestId: job.ingestId },
          error,
        );

        if (attempt < MAX_ATTEMPTS && transient) {
          await sleep(BACKOFF_MS[attempt - 1] ?? 1000);
          continue;
        }
        break;
      }
    }

    const prismaCode =
      lastError instanceof Prisma.PrismaClientKnownRequestError
        ? lastError.code
        : undefined;
    const message =
      lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown');

    await this.webhooksService.recordIngestFailure({
      provider: 'mock-meta',
      eventId: dto.eventId,
      payload: dto as unknown as Prisma.InputJsonValue,
      errorCode: prismaCode ?? null,
      errorMessage: message,
      attempts: MAX_ATTEMPTS,
    });

    await this.rabbitMq.publishWebhookPayload(QUEUES.WEBHOOK_INGEST_DLQ, {
      ...job,
      finalError: message,
      prismaCode: prismaCode ?? null,
      failedAt: new Date().toISOString(),
    });
  }
}
