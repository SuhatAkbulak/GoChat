import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index';

const TRANSIENT_PRISMA_CODES = new Set<string>([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'P2034',
]);

export function isTransientIngestError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_PRISMA_CODES.has(error.code);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }
  return false;
}

export function mapWebhookIngestErrorToHttp(
  error: unknown,
  context: { eventId?: string; requestId?: string | null },
): HttpException {
  if (error instanceof HttpException) {
    return error;
  }
  if (error instanceof BadRequestException) {
    return error;
  }

  const meta = {
    eventId: context.eventId ?? null,
    requestId: context.requestId ?? null,
  };

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const body = {
      message: 'Webhook ingest failed',
      prismaCode: error.code,
      ...meta,
    };
    if (TRANSIENT_PRISMA_CODES.has(error.code)) {
      return new ServiceUnavailableException(body);
    }
    return new InternalServerErrorException(body);
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return new ServiceUnavailableException({
      message: 'Database unavailable',
      ...meta,
    });
  }

  return new InternalServerErrorException({
    message: error instanceof Error ? error.message : 'Webhook ingest failed',
    ...meta,
  });
}
