import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { APP_CONSTANTS } from '../constants/app.constants';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const normalized =
        typeof exceptionResponse === 'string'
          ? { message: exceptionResponse }
          : (exceptionResponse as Record<string, unknown>);

      response.status(status).json({
        statusCode: status,
        path: request.url,
        timestamp: new Date().toISOString(),
        requestId: request.requestId || null,
        errorCode: this.resolveErrorCode(status),
        ...normalized,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId || null,
      errorCode: APP_CONSTANTS.DEFAULT_ERROR_CODE,
    });
  }

  private resolveErrorCode(statusCode: number) {
    if (statusCode >= 500) return APP_CONSTANTS.DEFAULT_ERROR_CODE;
    return `HTTP_${statusCode}`;
  }
}
