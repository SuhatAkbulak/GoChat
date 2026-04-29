import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server;

  emitConversationMessage(payload: {
    conversationId: string;
    messageId: string;
    text: string;
    direction: 'INBOUND' | 'OUTBOUND';
    status?: 'PENDING' | 'SENT' | 'FAILED' | 'RECEIVED';
    createdAt: string;
  }) {
    this.server.emit('conversation.message.received', payload);
  }
}
