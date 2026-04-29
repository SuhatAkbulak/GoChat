import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { APP_CONSTANTS } from '../constants/app.constants';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const incomingRequestId = request.headers?.[APP_CONSTANTS.REQUEST_ID_HEADER];
    const requestId = Array.isArray(incomingRequestId)
      ? incomingRequestId[0]
      : incomingRequestId || randomUUID();

    request.requestId = requestId;
    response.setHeader(APP_CONSTANTS.REQUEST_ID_HEADER, requestId);

    return next.handle();
  }
}
