import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Channel,
  MessageDirection,
  MessageStatus,
  Prisma,
} from '../../generated/prisma/index';
import { PrismaService } from '../../infra/database/prisma.service';
import { MockProviderClient } from '../../infra/provider/mock-provider.client';
import { QUEUES } from '../../infra/queue/rabbitmq.constants';
import { RabbitMqService } from '../../infra/queue/rabbitmq.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  private readonly maxRetryCount = Number(process.env.MAX_RETRY_COUNT || 3);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerClient: MockProviderClient,
    private readonly rabbitMq: RabbitMqService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendMessage(dto: SendMessageDto) {
    const normalizedChannel = this.toChannelEnum(dto.channel);
    const message = await this.createOrGetMessage(dto, normalizedChannel);

    if (message.status === MessageStatus.SENT) {
      return this.toMessageResponse(message);
    }

    const published = await this.rabbitMq.publish(QUEUES.MESSAGE_SEND, {
      messageId: message.id,
      attempt: message.retryCount,
      triggeredBy: 'initial',
    });

    if (published) {
      return this.toMessageResponse(message);
    }

    const updated = await this.processProviderSendByRecord(message.id);
    return this.toMessageResponse(updated);
  }

  async getMessageById(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.toMessageResponse(message);
  }

  async retryMessage(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: { conversation: true },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.direction !== MessageDirection.OUTBOUND) return this.toMessageResponse(message);
    if (message.status === MessageStatus.SENT || message.status === MessageStatus.PERM_FAILED) {
      return this.toMessageResponse(message);
    }

    const published = await this.rabbitMq.publish(QUEUES.MESSAGE_RETRY, {
      messageId: message.id,
      attempt: message.retryCount + 1,
      triggeredBy: 'retry',
    });
    if (published) return this.toMessageResponse(message);

    const updated = await this.processProviderSendByRecord(message.id);
    return this.toMessageResponse(updated);
  }

  private async createOrGetMessage(dto: SendMessageDto, channel: Channel) {
    if (!dto.clientMessageId) {
      return this.prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.upsert({
          where: {
            channel_participantId: {
              channel,
              participantId: dto.to,
            },
          },
          create: {
            channel,
            participantId: dto.to,
          },
          update: {},
        });

        return tx.message.create({
          data: {
            conversationId: conversation.id,
            channel,
            direction: MessageDirection.OUTBOUND,
            text: dto.text,
            status: MessageStatus.PENDING,
          },
        });
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.upsert({
          where: {
            channel_participantId: {
              channel,
              participantId: dto.to,
            },
          },
          create: {
            channel,
            participantId: dto.to,
          },
          update: {},
        });

        return tx.message.upsert({
          where: {
            channel_clientMessageId: {
              channel,
              clientMessageId: dto.clientMessageId!,
            },
          },
          create: {
            conversationId: conversation.id,
            channel,
            direction: MessageDirection.OUTBOUND,
            text: dto.text,
            status: MessageStatus.PENDING,
            clientMessageId: dto.clientMessageId,
          },
          update: {},
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.message.findFirst({
          where: {
            channel,
            clientMessageId: dto.clientMessageId,
          },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  private toChannelEnum(channel: string): Channel {
    const value = channel.toUpperCase();
    if (value === Channel.WHATSAPP) return Channel.WHATSAPP;
    if (value === Channel.INSTAGRAM) return Channel.INSTAGRAM;
    throw new BadRequestException('Invalid channel. Use whatsapp or instagram.');
  }

  async processProviderSendByRecord(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) throw new NotFoundException('Message not found');

    const providerResult = await this.providerClient.sendMessage({
      channel: message.channel.toLowerCase() as 'whatsapp' | 'instagram',
      to: message.conversation.participantId,
      text: message.text,
      clientMessageId: message.clientMessageId ?? undefined,
    });

    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: (() => {
        if (providerResult.success) {
          return {
            status: MessageStatus.SENT,
            providerMessageId: providerResult.providerMessageId,
            lastError: null,
            nextRetryAt: null,
          };
        }

        const nextRetryCount = message.retryCount + 1;
        const shouldPermFail = !providerResult.retryable || nextRetryCount >= this.maxRetryCount;

        return {
          status: shouldPermFail ? MessageStatus.PERM_FAILED : MessageStatus.FAILED,
          retryCount: { increment: 1 },
          lastError: providerResult.error,
          nextRetryAt: shouldPermFail ? null : this.computeNextRetryAt(nextRetryCount),
        };
      })(),
    });

    this.notificationsService.publishConversationMessage({
      conversationId: updated.conversationId,
      messageId: updated.id,
      text: updated.text,
      direction: 'OUTBOUND',
      status: this.toClientStatus(updated.status),
      createdAt: updated.createdAt.toISOString(),
    });

    return updated;
  }

  private computeNextRetryAt(nextRetryCount: number) {
    const seconds = Math.min(10 * 2 ** Math.max(0, nextRetryCount - 1), 300);
    return new Date(Date.now() + seconds * 1000);
  }

  private toMessageResponse(message: {
    id: string;
    conversationId: string;
    direction: MessageDirection;
    text: string;
    status: MessageStatus;
    providerMessageId: string | null;
    createdAt: Date;
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      text: message.text,
      status:
        message.status === MessageStatus.PERM_FAILED ? MessageStatus.FAILED : message.status,
      providerMessageId: message.providerMessageId,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toClientStatus(status: MessageStatus) {
    return status === MessageStatus.PERM_FAILED ? MessageStatus.FAILED : status;
  }
}
