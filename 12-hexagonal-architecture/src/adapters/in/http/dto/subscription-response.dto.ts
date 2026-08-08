import { ApiProperty } from '@nestjs/swagger';
import { Subscription } from '../../../../core/domain/subscription';

export class SubscriptionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() customerId: string;
  @ApiProperty({ enum: ['basic', 'pro', 'enterprise'] }) planId: string;
  @ApiProperty() currentPeriodStart: string;
  @ApiProperty() currentPeriodEnd: string;
  @ApiProperty() cancelAtPeriodEnd: boolean;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;

  static fromDomain(subscription: Subscription): SubscriptionResponseDto {
    const dto = new SubscriptionResponseDto();
    dto.id = subscription.id;
    dto.customerId = subscription.customerId;
    dto.planId = subscription.planId;
    dto.currentPeriodStart = subscription.currentPeriodStart.toISOString();
    dto.currentPeriodEnd = subscription.currentPeriodEnd.toISOString();
    dto.cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
    dto.createdAt = subscription.createdAt.toISOString();
    dto.updatedAt = subscription.updatedAt.toISOString();
    return dto;
  }
}

export class ChangePlanResponseDto extends SubscriptionResponseDto {
  @ApiProperty({ description: 'Amount charged immediately for the prorated upgrade.' })
  proratedAmount: number;

  static fromResult(subscription: Subscription, proratedAmount: number): ChangePlanResponseDto {
    const dto = Object.assign(
      new ChangePlanResponseDto(),
      SubscriptionResponseDto.fromDomain(subscription),
    );
    dto.proratedAmount = proratedAmount;
    return dto;
  }
}
