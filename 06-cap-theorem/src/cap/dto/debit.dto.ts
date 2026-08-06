import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class DebitDto {
  @ApiProperty({ example: 500, description: 'Amount to debit from wallet balance.', minimum: 1 })
  @IsInt()
  @Min(1)
  amount!: number;
}
