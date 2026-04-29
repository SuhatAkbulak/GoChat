export const QUEUES = {
  MESSAGE_SEND: 'message.send',
  MESSAGE_RETRY: 'message.retry',
  MESSAGE_DLQ: 'message.dlq',
  WEBHOOK_INGEST: 'webhook.ingest',
  WEBHOOK_INGEST_DLQ: 'webhook.ingest.dlq',
} as const;

export type MessageQueueName =
  | (typeof QUEUES)['MESSAGE_SEND']
  | (typeof QUEUES)['MESSAGE_RETRY']
  | (typeof QUEUES)['MESSAGE_DLQ'];

export type WebhookQueueName =
  | (typeof QUEUES)['WEBHOOK_INGEST']
  | (typeof QUEUES)['WEBHOOK_INGEST_DLQ'];

export type QueueName = MessageQueueName | WebhookQueueName;
