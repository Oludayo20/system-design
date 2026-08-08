import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../../../core/domain/errors';

/**
 * The core throws plain DomainError subclasses — it has never heard of HTTP status codes.
 * This filter is where the REST inbound adapter decides how to translate a domain error into a
 * response. The CLI inbound adapter (orbit-cli.ts) makes its own, different decision — it just
 * prints the error and exits non-zero. Same core error, two different presentations.
 *
 * Keyed by each error's own `code` (a plain string the core assigns, see domain/errors.ts) —
 * deliberately not by constructor/instanceof, so this file needs no knowledge of the concrete
 * error classes beyond the shared DomainError base.
 */
const STATUS_BY_CODE: Record<string, HttpStatus> = {
  SUBSCRIPTION_NOT_FOUND: HttpStatus.NOT_FOUND,
  CUSTOMER_ALREADY_SUBSCRIBED: HttpStatus.CONFLICT,
  DOWNGRADE_NOT_ALLOWED_MID_CYCLE: HttpStatus.CONFLICT,
  SAME_PLAN: HttpStatus.CONFLICT,
  SUBSCRIPTION_NOT_ACTIVE: HttpStatus.CONFLICT,
  ALREADY_CANCELED: HttpStatus.CONFLICT,
  PAYMENT_FAILED: HttpStatus.PAYMENT_REQUIRED,
  UNKNOWN_PLAN: HttpStatus.BAD_REQUEST,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;

    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }
}
