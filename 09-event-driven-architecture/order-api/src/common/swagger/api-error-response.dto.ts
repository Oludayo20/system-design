import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 404, description: 'HTTP status code' })
  statusCode!: number;

  @ApiProperty({ example: 'Not Found', description: 'HTTP status text' })
  error!: string;

  @ApiProperty({
    description: 'Human-readable error message',
    oneOf: [
      { type: 'string', example: 'Order not found' },
      { type: 'array', items: { type: 'string' } },
    ],
  })
  message!: string | string[];
}

export class ValidationErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    type: [String],
    example: ['customerId should not be empty', 'items should not be empty'],
    description: 'Validation constraint messages from class-validator',
  })
  message!: string[];
}
