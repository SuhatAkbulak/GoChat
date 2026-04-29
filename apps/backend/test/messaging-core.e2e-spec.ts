import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/database/prisma.service';
import { RabbitMqService } from '../src/infra/queue/rabbitmq.service';
import { MockProviderClient } from '../src/infra/provider/mock-provider.client';
import { MessagesService } from '../src/modules/messages/messages.service';

describe('Messaging Core (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let messagesService: MessagesService;

  const providerMock = {
    sendMessage: jest.fn(),
  };

  beforeAll(async () => {
    process.env.WEBHOOK_INGEST_MODE = 'sync';

    const rabbitStub = {
      onModuleInit: async () => {},
      onModuleDestroy: async () => {},
      isConnected: () => false,
      publish: jest.fn().mockResolvedValue(false),
      publishWebhookPayload: jest.fn().mockResolvedValue(false),
      consume: jest.fn().mockResolvedValue(undefined),
      consumeWebhookJson: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MockProviderClient)
      .useValue(providerMock)
      .overrideProvider(RabbitMqService)
      .useValue(rabbitStub)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    messagesService = app.get(MessagesService);
  });

  beforeEach(async () => {
    providerMock.sendMessage.mockReset();
    await prisma.message.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.webhookIngestFailure.deleteMany().catch(() => null);
    await prisma.conversation.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deduplicates repeated webhook events by eventId', async () => {
    const payload = {
      eventId: 'evt_duplicate_test_1',
      channel: 'whatsapp',
      from: 'user-123',
      text: 'Hello duplicate',
      timestamp: new Date().toISOString(),
    };

    await request(app.getHttpServer()).post('/webhooks/mock-meta').send(payload).expect(200);
    await request(app.getHttpServer()).post('/webhooks/mock-meta').send(payload).expect(200);
    await request(app.getHttpServer()).post('/webhooks/mock-meta').send(payload).expect(200);

    const webhookCount = await prisma.webhookEvent.count({
      where: { provider: 'mock-meta', eventId: payload.eventId },
    });
    const messageCount = await prisma.message.count({
      where: { text: payload.text },
    });
    const conversation = await prisma.conversation.findUnique({
      where: {
        channel_participantId: {
          channel: 'WHATSAPP',
          participantId: payload.from,
        },
      },
    });

    expect(webhookCount).toBe(1);
    expect(messageCount).toBe(1);
    expect(conversation?.unreadCount).toBe(1);
  });

  it('returns same outbound message for same clientMessageId', async () => {
    providerMock.sendMessage.mockResolvedValue({
      success: true,
      providerMessageId: 'msg_provider_1',
    });

    const payload = {
      channel: 'whatsapp',
      to: 'user-456',
      text: 'Idempotent send',
      clientMessageId: '8fd09ec6-6e68-4638-ad0e-8594de44c001',
    };

    const first = await request(app.getHttpServer())
      .post('/messages/send')
      .send(payload)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/messages/send')
      .send(payload)
      .expect(201);

    const count = await prisma.message.count({
      where: {
        channel: 'WHATSAPP',
        clientMessageId: payload.clientMessageId,
      },
    });

    expect(first.body.id).toBe(second.body.id);
    expect(count).toBe(1);
  });

  it('retries transient failures and eventually marks SENT', async () => {
    providerMock.sendMessage
      .mockResolvedValueOnce({
        success: false,
        retryable: true,
        error: 'Temporary provider outage',
      })
      .mockResolvedValueOnce({
        success: true,
        providerMessageId: 'msg_provider_2',
      });

    const payload = {
      channel: 'whatsapp',
      to: 'user-789',
      text: 'Retry flow test',
      clientMessageId: '4d3df4b7-c34e-4fd4-a8fc-30af73d3b222',
    };

    const sendResponse = await request(app.getHttpServer())
      .post('/messages/send')
      .send(payload)
      .expect(201);

    expect(sendResponse.body.status).toBe('FAILED');

    await messagesService.retryMessage(sendResponse.body.id);

    const updated = await prisma.message.findUnique({
      where: { id: sendResponse.body.id },
    });

    expect(updated?.status).toBe('SENT');
    expect(updated?.retryCount).toBe(1);
    expect(updated?.providerMessageId).toBe('msg_provider_2');
  });
});
