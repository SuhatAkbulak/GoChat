import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ConsumeMessage } from 'amqplib';
import { MessageQueueName, QUEUES, WebhookQueueName } from './rabbitmq.constants';

type MessageJob = {
  messageId: string;
  attempt: number;
  triggeredBy: 'initial' | 'retry';
};

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: any = null;
  private channel: any = null;
  private readonly url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  async onModuleInit() {
    try {
      const connection = await amqp.connect(this.url);
      const channel = await connection.createChannel();
      this.bindConnectionLifecycle(connection, channel);
      await channel.assertQueue(QUEUES.MESSAGE_SEND, { durable: true });
      await channel.assertQueue(QUEUES.MESSAGE_RETRY, { durable: true });
      await channel.assertQueue(QUEUES.MESSAGE_DLQ, { durable: true });
      await channel.assertQueue(QUEUES.WEBHOOK_INGEST, { durable: true });
      await channel.assertQueue(QUEUES.WEBHOOK_INGEST_DLQ, { durable: true });
      this.connection = connection;
      this.channel = channel;
      this.logger.log(`RabbitMQ connected: ${this.url}`);
    } catch (error: any) {
      this.logger.warn(`RabbitMQ unavailable, fallback mode active: ${error?.message || 'unknown'}`);
      this.connection = null;
      this.channel = null;
    }
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => null);
    await this.connection?.close().catch(() => null);
  }

  isConnected() {
    return Boolean(this.channel);
  }

  async publish(queue: MessageQueueName, payload: MessageJob) {
    if (!this.channel) return false;
    return this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });
  }

  async publishWebhookPayload(queue: WebhookQueueName, payload: unknown) {
    if (!this.channel) return false;
    return this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });
  }

  async consume(
    queue: MessageQueueName,
    handler: (payload: MessageJob) => Promise<void>,
  ) {
    if (!this.channel) return;

    await this.channel.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as MessageJob;
        await handler(payload);
        this.channel?.ack(msg);
      } catch (error: any) {
        this.logger.warn(`Queue handler failed (${queue}): ${error?.message || 'unknown'}`);
        this.channel?.nack(msg, false, false);
      }
    });
  }

  async consumeWebhookJson<T>(
    queue: WebhookQueueName,
    handler: (payload: T) => Promise<void>,
  ) {
    if (!this.channel) return;

    await this.channel.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString()) as T;
        await handler(payload);
        this.channel?.ack(msg);
      } catch (error: any) {
        this.logger.warn(`Webhook queue handler failed (${queue}): ${error?.message || 'unknown'}`);
        this.channel?.nack(msg, false, false);
      }
    });
  }

  private bindConnectionLifecycle(connection: any, channel: any) {
    connection.on('error', (error: any) => {
      this.logger.warn(`RabbitMQ connection error: ${error?.message || 'unknown'}`);
    });

    connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed, switching to fallback mode');
      this.connection = null;
      this.channel = null;
    });

    channel.on('error', (error: any) => {
      this.logger.warn(`RabbitMQ channel error: ${error?.message || 'unknown'}`);
    });

    channel.on('close', () => {
      this.logger.warn('RabbitMQ channel closed, switching to fallback mode');
      this.channel = null;
    });
  }
}
