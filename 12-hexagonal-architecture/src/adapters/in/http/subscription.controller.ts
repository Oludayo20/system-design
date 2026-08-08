import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CancelUseCase } from '../../../core/application/cancel.use-case';
import { ChangePlanUseCase } from '../../../core/application/change-plan.use-case';
import { GetSubscriptionUseCase } from '../../../core/application/get-subscription.use-case';
import { SubscribeUseCase } from '../../../core/application/subscribe.use-case';
import { ChangePlanDto } from './dto/change-plan.dto';
import { SubscribeDto } from './dto/subscribe.dto';
import { ChangePlanResponseDto, SubscriptionResponseDto } from './dto/subscription-response.dto';

/**
 * Inbound/driving adapter #1. This controller calls INTO the core through its input ports
 * (the four use-case classes below) and does nothing else — no business rules live here, only
 * HTTP concerns: request parsing, DTO validation, and response shaping. The CLI adapter
 * (src/adapters/in/cli/orbit-cli.ts) drives the exact same use-case classes.
 */
@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscribeUseCase: SubscribeUseCase,
    private readonly changePlanUseCase: ChangePlanUseCase,
    private readonly cancelUseCase: CancelUseCase,
    private readonly getSubscriptionUseCase: GetSubscriptionUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Subscribe a customer to a plan (charges the plan price immediately)' })
  async subscribe(@Body() dto: SubscribeDto): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscribeUseCase.execute({
      customerId: dto.customerId,
      planId: dto.planId,
    });
    return SubscriptionResponseDto.fromDomain(subscription);
  }

  @Post(':id/change-plan')
  @ApiOperation({
    summary: 'Upgrade (prorated charge, mid-cycle OK) or attempt a downgrade (rejected mid-cycle)',
  })
  async changePlan(
    @Param('id') id: string,
    @Body() dto: ChangePlanDto,
  ): Promise<ChangePlanResponseDto> {
    const { subscription, proratedAmount } = await this.changePlanUseCase.execute({
      subscriptionId: id,
      newPlanId: dto.planId,
    });
    return ChangePlanResponseDto.fromResult(subscription, proratedAmount);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule cancellation at period end (does not delete anything now)' })
  async cancel(@Param('id') id: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.cancelUseCase.execute({ subscriptionId: id });
    return SubscriptionResponseDto.fromDomain(subscription);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a subscription by id' })
  async getById(@Param('id') id: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.getSubscriptionUseCase.execute({ subscriptionId: id });
    return SubscriptionResponseDto.fromDomain(subscription);
  }
}
