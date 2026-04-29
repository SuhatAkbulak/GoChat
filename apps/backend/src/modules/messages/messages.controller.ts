import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  send(@Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.messagesService.getMessageById(id);
  }
}
