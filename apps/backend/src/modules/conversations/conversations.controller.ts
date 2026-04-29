import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { GetConversationDto } from './dto/get-conversation.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(@Query() query: ListConversationsDto) {
    return this.conversationsService.listConversations(query);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Query() query: GetConversationDto) {
    return this.conversationsService.getConversationById(id, query);
  }

  @Post(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.conversationsService.markAsRead(id);
  }

  @Post('clear-all')
  clearAll() {
    return this.conversationsService.clearAllConversations();
  }

  @Post('hard-reset')
  hardReset() {
    return this.conversationsService.hardResetConversations();
  }

  @Post(':id/clear')
  clearMessages(@Param('id') id: string) {
    return this.conversationsService.clearConversationMessages(id);
  }
}
