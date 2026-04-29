import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test-message')
  @HttpCode(202)
  publishTestMessage(@Body() body: { text?: string }) {
    const now = new Date().toISOString();

    this.notificationsService.publishConversationMessage({
      conversationId: 'conv_demo',
      messageId: `msg_${Date.now()}`,
      text: body.text || 'Test message from backend socket gateway',
      direction: 'INBOUND',
      createdAt: now,
    });

    return { accepted: true, emittedAt: now };
  }
}
