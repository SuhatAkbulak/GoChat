import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'seampeak-messaging-gateway',
      timestamp: new Date().toISOString(),
    };
  }
}
