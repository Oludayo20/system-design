import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({
    example: 5000,
    description: 'Payment amount in minor currency units (kobo/cents).',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount!: number;
}
