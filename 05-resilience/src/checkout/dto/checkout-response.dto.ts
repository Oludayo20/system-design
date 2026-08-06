import { ApiProperty } from '@nestjs/swagger';

export class PaymentResultDto {
  @ApiProperty({ enum: ['paystack', 'flutterwave', 'cached-fallback'], example: 'paystack' })
  provider!: 'paystack' | 'flutterwave' | 'cached-fallback';

  @ApiProperty({ example: 'paystack-1-5000' })
  reference!: string;

  @ApiProperty({
    enum: ['success', 'queued'],
    example: 'success',
    description: '`queued` when all providers failed and payment is deferred.',
  })
  status!: 'success' | 'queued';
}

export class CircuitStateResponseDto {
  @ApiProperty({
    enum: ['CLOSED', 'OPEN', 'HALF_OPEN'],
    example: 'CLOSED',
    description: 'Current Paystack circuit breaker state.',
  })
  paystackCircuit!: string;
}
