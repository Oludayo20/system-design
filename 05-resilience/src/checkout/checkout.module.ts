import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { FlakyPaymentGateway } from '../payment/flaky-payment.gateway';

@Module({
  controllers: [CheckoutController],
  providers: [CheckoutService, FlakyPaymentGateway],
})
export class CheckoutModule {}
