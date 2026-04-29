import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { MessageQueueConsumer } from './message-queue.consumer';
import { RetryWorker } from './retry.worker';
import { WebhookEventTtlWorker } from './webhook-event-ttl.worker';
import { WebhookQueueConsumer } from './webhook-queue.consumer';

@Module({
  imports: [MessagesModule, WebhooksModule],
  providers: [RetryWorker, MessageQueueConsumer, WebhookQueueConsumer, WebhookEventTtlWorker],
})
export class WorkersModule {}
