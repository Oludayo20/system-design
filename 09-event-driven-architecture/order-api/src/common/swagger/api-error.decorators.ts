import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto, ValidationErrorResponseDto } from './api-error-response.dto';

export function ApiValidationErrors() {
  return ApiBadRequestResponse({
    description: 'Validation failed or malformed request body.',
    type: ValidationErrorResponseDto,
  });
}

export function ApiNotFoundError(description = 'Resource not found.') {
  return ApiNotFoundResponse({ description, type: ApiErrorResponseDto });
}

export function ApiServerError() {
  return ApiInternalServerErrorResponse({
    description: 'Unexpected server error.',
    type: ApiErrorResponseDto,
  });
}

export function ApiReadErrors() {
  return applyDecorators(ApiNotFoundError(), ApiServerError());
}
