import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'Laptop Pro 15"' })
  name!: string;

  @ApiProperty({ example: 'High-performance laptop for work and play.' })
  description!: string;

  @ApiProperty({ example: '1899.00', description: 'Decimal string from Postgres numeric column.' })
  price!: string;

  @ApiProperty({ example: 42 })
  stock!: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/laptop.jpg' })
  imageUrl!: string | null;

  @ApiPropertyOptional({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  categoryId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
