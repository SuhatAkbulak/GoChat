import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class MockMetaWebhookDto {
  @ApiProperty({ example: 'evt_123' })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({ example: 'whatsapp' })
  @IsString()
  @IsNotEmpty()
  channel!: string;

  @ApiProperty({ example: 'user-123' })
  @IsString()
  @IsNotEmpty()
  from!: string;

  @ApiProperty({ example: 'Hello' })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ example: '2025-01-01T10:00:00Z' })
  @IsISO8601()
  timestamp!: string;
}
