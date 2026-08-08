import { ApiProperty } from '@nestjs/swagger';
import { OrderItemDto } from './order-item.dto';

export class OrderResponseDto {
  @ApiProperty({ example: '5f1b6b2e-8c4d-4a1e-9f3b-2d7e6a5b4c3d' })
  id!: string;

  @ApiProperty({ example: 'customer-42' })
  customerId!: string;

  @ApiProperty({ type: [OrderItemDto] })
  items!: OrderItemDto[];

  @ApiProperty({ example: '9.00' })
  totalAmount!: string;

  @ApiProperty({ example: 'placed' })
  status!: string;

  @ApiProperty({ example: '2026-08-08T12:00:00.000Z' })
  createdAt!: Date;
}
