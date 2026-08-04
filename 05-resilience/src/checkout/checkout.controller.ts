import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';

class CheckoutDto {
  amount!: number;
}

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  pay(@Body() body: CheckoutDto) {
    return this.checkout.checkout(body.amount);
  }

  @Get('circuit')
  circuitState() {
    return { paystackCircuit: this.checkout.getCircuitState() };
  }
}
