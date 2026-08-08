import { ApiProperty } from '@nestjs/swagger';

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  bookId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPriceCents: number;

  @ApiProperty()
  totalCents: number;

  @ApiProperty()
  status: string;
}
