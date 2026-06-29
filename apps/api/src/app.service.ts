import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      service: 'workly-api',
      status: 'ok',
      time: new Date().toISOString(),
    };
  }
}
