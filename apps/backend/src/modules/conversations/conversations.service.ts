import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Channel,
  ConversationStatus,
  MessageStatus,
} from '../../generated/prisma/index';
import { PrismaService } from '../../infra/database/prisma.service';
import { GetConversationDto } from './dto/get-conversation.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(query: ListConversationsDto) {
    const where = {
      ...(query.channel ? { channel: this.toChannel(query.channel) } : {}),
      ...(query.status ? { status: this.toStatus(query.status) } : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const conversations = await this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: query.limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { text: true },
        },
      },
    });

    return {
      data: conversations.map((c) => ({
        id: c.id,
        channel: c.channel.toLowerCase(),
        participantId: c.participantId,
        lastMessagePreview: c.messages[0]?.text ?? '',
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        unreadCount: c.unreadCount,
      })),
      meta: { page: query.page, limit: query.limit },
    };
  }

  async getConversationById(id: string, query: GetConversationDto) {
    const skip = (query.page - 1) * query.limit;
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const messages = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    });

    return {
      id: conversation.id,
      channel: conversation.channel.toLowerCase(),
      participantId: conversation.participantId,
      status: conversation.status.toLowerCase(),
      unreadCount: conversation.unreadCount,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        text: m.text,
        status: m.status === MessageStatus.PERM_FAILED ? MessageStatus.FAILED : m.status,
        createdAt: m.createdAt.toISOString(),
      })),
      meta: { page: query.page, limit: query.limit },
    };
  }

  async markAsRead(id: string) {
    const existing = await this.prisma.conversation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Conversation not found');

    await this.prisma.conversation.update({
      where: { id },
      data: {
        unreadCount: 0,
        lastReadAt: new Date(),
      },
    });

    return { success: true };
  }

  async clearAllConversations() {
    const result = await this.prisma.$transaction(async (tx) => {
      const deletedMessages = await tx.message.deleteMany({});
      const deletedConversations = await tx.conversation.deleteMany({});

      return {
        deletedMessages: deletedMessages.count,
        deletedConversations: deletedConversations.count,
      };
    });

    return { success: true, ...result };
  }

  async hardResetConversations() {
    const hardResetEnabled = (process.env.ENABLE_HARD_RESET || 'false').toLowerCase() === 'true';
    if (!hardResetEnabled) {
      throw new ForbiddenException(
        'Hard reset is disabled. Set ENABLE_HARD_RESET=true to allow this action.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const deletedMessages = await tx.message.deleteMany({});
      const deletedConversations = await tx.conversation.deleteMany({});
      const deletedWebhookEvents = await tx.webhookEvent.deleteMany({});

      return {
        deletedMessages: deletedMessages.count,
        deletedConversations: deletedConversations.count,
        deletedWebhookEvents: deletedWebhookEvents.count,
      };
    });

    return { success: true, ...result };
  }

  async clearConversationMessages(id: string) {
    const existing = await this.prisma.conversation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Conversation not found');

    const deleted = await this.prisma.$transaction(async (tx) => {
      const deletedMessages = await tx.message.deleteMany({
        where: { conversationId: id },
      });

      await tx.conversation.update({
        where: { id },
        data: {
          unreadCount: 0,
          lastMessageAt: null,
        },
      });

      return deletedMessages.count;
    });

    return { success: true, deletedCount: deleted };
  }

  private toChannel(channel: 'whatsapp' | 'instagram'): Channel {
    return channel === 'whatsapp' ? Channel.WHATSAPP : Channel.INSTAGRAM;
  }

  private toStatus(status: 'open' | 'closed'): ConversationStatus {
    return status === 'open' ? ConversationStatus.OPEN : ConversationStatus.CLOSED;
  }
}
