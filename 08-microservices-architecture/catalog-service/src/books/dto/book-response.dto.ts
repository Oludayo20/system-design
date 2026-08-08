import { ApiProperty } from '@nestjs/swagger';

export class BookResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  author: string;

  @ApiProperty()
  priceCents: number;

  @ApiProperty()
  stock: number;
}

export class ReserveStockResponseDto {
  @ApiProperty()
  bookId: string;

  @ApiProperty()
  unitPriceCents: number;

  @ApiProperty()
  totalCents: number;

  @ApiProperty()
  remainingStock: number;
}
