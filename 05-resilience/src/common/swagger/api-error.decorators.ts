import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto, ValidationErrorResponseDto } from './api-error-response.dto';

export function ApiValidationErrors() {
  return ApiBadRequestResponse({
    description: 'Validation failed or malformed request body.',
    type: ValidationErrorResponseDto,
  });
}

export function ApiUnauthorizedError(description = 'Missing or invalid JWT.') {
  return ApiUnauthorizedResponse({ description, type: ApiErrorResponseDto });
}

export function ApiNotFoundError(description = 'Resource not found.') {
  return ApiNotFoundResponse({ description, type: ApiErrorResponseDto });
}

export function ApiConflictError(description = 'Resource conflict.') {
  return ApiConflictResponse({ description, type: ApiErrorResponseDto });
}

export function ApiForbiddenError(description = 'Forbidden.') {
  return ApiForbiddenResponse({ description, type: ApiErrorResponseDto });
}

export function ApiServerError() {
  return ApiInternalServerErrorResponse({
    description: 'Unexpected server error.',
    type: ApiErrorResponseDto,
  });
}

export function ApiMutationErrors(options?: { auth?: boolean; conflict?: boolean; forbidden?: boolean }) {
  const decorators = [ApiValidationErrors(), ApiServerError()];
  if (options?.auth) decorators.push(ApiUnauthorizedError());
  if (options?.conflict) decorators.push(ApiConflictError());
  if (options?.forbidden) decorators.push(ApiForbiddenError());
  return applyDecorators(...decorators);
}

export function ApiReadErrors(options?: { auth?: boolean }) {
  const decorators = [ApiNotFoundError(), ApiServerError()];
  if (options?.auth) decorators.push(ApiUnauthorizedError());
  return applyDecorators(...decorators);
}
