import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMqService } from '../../infra/queue/rabbitmq.service';
import { QUEUES } from '../../infra/queue/rabbitmq.constants';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class MessageQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(MessageQueueConsumer.name);

  constructor(
    private readonly rabbitMq: RabbitMqService,
    private readonly messagesService: MessagesService,
  ) {}

  async onModuleInit() {
    if (!this.rabbitMq.isConnected()) {
      this.logger.warn('RabbitMQ consumer skipped (not connected)');
      return;
    }

    await this.rabbitMq.consume(QUEUES.MESSAGE_SEND, async (job) => {
      await this.messagesService.processProviderSendByRecord(job.messageId);
    });

    await this.rabbitMq.consume(QUEUES.MESSAGE_RETRY, async (job) => {
      await this.messagesService.processProviderSendByRecord(job.messageId);
    });
  }
}
