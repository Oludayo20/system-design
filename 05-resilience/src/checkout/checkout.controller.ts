import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiServerError, ApiValidationErrors } from '../common/swagger/api-error.decorators';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CircuitStateResponseDto, PaymentResultDto } from './dto/checkout-response.dto';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  @ApiOperation({
    summary: 'Process a checkout payment',
    description:
      '**Flow:**\n' +
      '1. Retry Paystack up to `MAX_RETRIES` times (with `RETRY_DELAY_MS` between attempts).\n' +
      '2. Circuit breaker wraps Paystack — opens after `CIRCUIT_FAILURE_THRESHOLD` failures.\n' +
      '3. On exhaustion → fallback to Flutterwave.\n' +
      '4. If both fail → return `cached-fallback` with `status: queued`.\n\n' +
      'Tune `PAYMENT_FAILURE_RATE` in `.env` to simulate flaky Paystack.',
  })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({ status: 201, description: 'Payment result from the winning provider.', type: PaymentResultDto })
  @ApiValidationErrors()
  @ApiServerError()
  pay(@Body() body: CheckoutDto) {
    return this.checkout.checkout(body.amount);
  }

  @Get('circuit')
  @ApiOperation({
    summary: 'Inspect Paystack circuit breaker state',
    description: 'Returns `CLOSED` (normal), `OPEN` (rejecting calls), or `HALF_OPEN` (probe).',
  })
  @ApiResponse({ status: 200, type: CircuitStateResponseDto })
  @ApiServerError()
  circuitState(): CircuitStateResponseDto {
    return { paystackCircuit: this.checkout.getCircuitState() };
  }
}
