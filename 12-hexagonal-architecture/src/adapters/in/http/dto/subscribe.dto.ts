import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';
import { PlanId } from '../../../../core/domain/plan';

export class SubscribeDto {
  @ApiProperty({ example: 'cust_123', description: 'Opaque customer identifier' })
  @IsString()
  @MinLength(1)
  customerId: string;

  @ApiProperty({ example: 'pro', enum: ['basic', 'pro', 'enterprise'] })
  @IsIn(['basic', 'pro', 'enterprise'])
  planId: PlanId;
}
