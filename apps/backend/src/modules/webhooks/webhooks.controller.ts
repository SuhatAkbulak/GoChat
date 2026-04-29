import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MockMetaWebhookDto } from './dto/mock-meta-webhook.dto';
import { mapWebhookIngestErrorToHttp } from './webhook-ingest.error-map';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
  ) {}

  @Post('mock-meta')
  async ingestMockMetaWebhook(
    @Body() dto: MockMetaWebhookDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const mode = (this.configService.get<string>('WEBHOOK_INGEST_MODE') || 'sync').toLowerCase();
    const requestId = (req as Request & { requestId?: string }).requestId ?? null;

    if (mode === 'async') {
      const published = await this.webhooksService.enqueueAsyncIngest(dto);
      if (!published) {
        throw new ServiceUnavailableException({
          message: 'Message broker unavailable for webhook ingest',
          eventId: dto.eventId,
          requestId,
        });
      }
      res.status(202);
      return {
        accepted: true,
        mode: 'async',
        eventId: dto.eventId,
        requestId,
      };
    }

    try {
      const body = await this.webhooksService.ingestMockMetaWebhook(dto);
      res.status(200);
      return body;
    } catch (error) {
      this.webhooksService.logIngestFailure('sync', { eventId: dto.eventId, requestId }, error);
      throw mapWebhookIngestErrorToHttp(error, { eventId: dto.eventId, requestId });
    }
  }
}
