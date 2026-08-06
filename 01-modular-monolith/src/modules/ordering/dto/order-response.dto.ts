import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

class OrderItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ example: 'Laptop Pro 15"' })
  productName!: string;

  @ApiProperty({ example: '1899.00' })
  unitPrice!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: '1899.00' })
  lineTotal!: string;
}

export class OrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PLACED })
  status!: OrderStatus;

  @ApiProperty({ example: '1899.00' })
  total!: string;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PlaceOrderResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  orderId!: string;
}
