import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Palm Oil (1L)' })
  name!: string;

  @ApiPropertyOptional({ example: 'Cold-pressed red palm oil.' })
  description!: string | null;

  @ApiProperty({ example: 150000, description: 'Price in minor currency units (kobo/cents).' })
  priceCents!: number;

  @ApiProperty({ example: 100 })
  stock!: number;

  @ApiPropertyOptional()
  imageUrl!: string | null;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CategoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Groceries' })
  name!: string;

  @ApiProperty({ example: 'groceries' })
  slug!: string;

  @ApiProperty()
  createdAt!: Date;
}
