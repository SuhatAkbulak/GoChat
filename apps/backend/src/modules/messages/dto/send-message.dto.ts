import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'whatsapp' })
  @IsString()
  channel!: string;

  @ApiProperty({ example: 'user-123' })
  @IsString()
  to!: string;

  @ApiProperty({ example: 'Merhaba!' })
  @IsString()
  text!: string;

  @ApiProperty({ required: false, example: '3c6af15f-33bc-4793-95d1-f88a1f01b11a' })
  @IsOptional()
  @IsUUID()
  clientMessageId?: string;
}
