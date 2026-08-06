import { ApiProperty } from '@nestjs/swagger';

class BasketLineDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  productId!: string;

  @ApiProperty({ example: 'Laptop Pro 15"' })
  name!: string;

  @ApiProperty({ example: 1899 })
  unitPrice!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 1899 })
  lineTotal!: number;
}

export class BasketResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId!: string;

  @ApiProperty({ type: [BasketLineDto] })
  items!: BasketLineDto[];

  @ApiProperty({ example: 1899, description: 'Sum of all line totals.' })
  total!: number;
}
