import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(private readonly gateway: NotificationsGateway) {}

  publishConversationMessage(payload: {
    conversationId: string;
    messageId: string;
    text: string;
    direction: 'INBOUND' | 'OUTBOUND';
    status?: 'PENDING' | 'SENT' | 'FAILED' | 'RECEIVED';
    createdAt: string;
  }) {
    this.gateway.emitConversationMessage(payload);
  }
}
