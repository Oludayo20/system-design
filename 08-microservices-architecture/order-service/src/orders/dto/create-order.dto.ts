import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: '3b1f8e2a-1c2d-4e3f-9a0b-123456789abc' })
  @IsUUID()
  bookId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
