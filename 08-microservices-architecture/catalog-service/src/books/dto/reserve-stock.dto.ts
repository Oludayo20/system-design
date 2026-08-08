import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ReserveStockDto {
  @ApiProperty({ example: 1, description: 'Units to reserve (decrement from stock)' })
  @IsInt()
  @Min(1)
  quantity: number;
}
