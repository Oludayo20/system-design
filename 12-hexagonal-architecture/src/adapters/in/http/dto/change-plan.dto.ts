import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { PlanId } from '../../../../core/domain/plan';

export class ChangePlanDto {
  @ApiProperty({ example: 'enterprise', enum: ['basic', 'pro', 'enterprise'] })
  @IsIn(['basic', 'pro', 'enterprise'])
  planId: PlanId;
}
