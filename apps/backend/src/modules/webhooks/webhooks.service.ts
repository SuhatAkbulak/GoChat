import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Channel, MessageDirection, MessageStatus, Prisma } from '../../generated/prisma/index';
import { PrismaService } from '../../infra/database/prisma.service';
import { QUEUES } from '../../infra/queue/rabbitmq.constants';
import { RabbitMqService } from '../../infra/queue/rabbitmq.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MockMetaWebhookDto } from './dto/mock-meta-webhook.dto';

export type WebhookIngestJob = {
  ingestId: string;
  dto: MockMetaWebhookDto;
  enqueuedAt: string;
};

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  async enqueueAsyncIngest(dto: MockMetaWebhookDto): Promise<boolean> {
    const job: WebhookIngestJob = {
      ingestId: randomUUID(),
      dto,
      enqueuedAt: new Date().toISOString(),
    };
    return this.rabbitMq.publishWebhookPayload(QUEUES.WEBHOOK_INGEST, job);
  }

  async recordIngestFailure(params: {
    provider: string;
    eventId: string;
    payload: Prisma.InputJsonValue;
    errorCode?: string | null;
    errorMessage: string;
    attempts: number;
  }) {
    await this.prisma.webhookIngestFailure.create({
      data: {
        provider: params.provider,
        eventId: params.eventId,
        payload: params.payload,
        errorCode: params.errorCode ?? null,
        errorMessage: params.errorMessage,
        attempts: params.attempts,
      },
    });
  }

  async ingestMockMetaWebhook(dto: MockMetaWebhookDto) {
    const normalizedChannel = this.toChannelEnum(dto.channel);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.webhookEvent.create({
          data: {
            provider: 'mock-meta',
            eventId: dto.eventId,
            payload: dto as unknown as Prisma.InputJsonValue,
          },
        });

        const conversation = await tx.conversation.upsert({
          where: {
            channel_participantId: {
              channel: normalizedChannel,
              participantId: dto.from,
            },
          },
          create: {
            channel: normalizedChannel,
            participantId: dto.from,
            unreadCount: 1,
            lastMessageAt: new Date(dto.timestamp),
          },
          update: {
            unreadCount: { increment: 1 },
            lastMessageAt: new Date(dto.timestamp),
          },
        });

        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            channel: normalizedChannel,
            direction: MessageDirection.INBOUND,
            text: dto.text,
            status: MessageStatus.RECEIVED,
          },
        });

        await tx.webhookEvent.update({
          where: {
            provider_eventId: {
              provider: 'mock-meta',
              eventId: dto.eventId,
            },
          },
          data: {
            processedAt: new Date(),
          },
        });

        return { conversation, message };
      });

      this.notificationsService.publishConversationMessage({
        conversationId: result.conversation.id,
        messageId: result.message.id,
        text: result.message.text,
        direction: 'INBOUND',
        status: 'RECEIVED',
        createdAt: result.message.createdAt.toISOString(),
      });

      return {
        success: true,
        duplicate: false,
        conversationId: result.conversation.id,
        messageId: result.message.id,
      };
    } catch (error) {
      if (this.isDuplicateWebhook(error)) {
        return {
          success: true,
          duplicate: true,
          eventId: dto.eventId,
        };
      }
      throw error;
    }
  }

  logIngestFailure(
    phase: 'sync' | 'async',
    ctx: { eventId?: string; requestId?: string | null; ingestId?: string },
    error: unknown,
  ) {
    const prismaCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `Webhook ingest failed [${phase}] eventId=${ctx.eventId ?? 'n/a'} ingestId=${ctx.ingestId ?? 'n/a'} requestId=${ctx.requestId ?? 'n/a'} prismaCode=${prismaCode ?? 'n/a'} message=${message}`,
    );
  }

  private toChannelEnum(channel: string): Channel {
    const value = channel.toUpperCase();
    if (value === Channel.WHATSAPP) return Channel.WHATSAPP;
    if (value === Channel.INSTAGRAM) return Channel.INSTAGRAM;
    throw new BadRequestException('Invalid channel. Use whatsapp or instagram.');
  }

  private isDuplicateWebhook(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
