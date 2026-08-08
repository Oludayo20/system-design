import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ example: 'milk-1l' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 'Whole Milk 1L' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 1.5, description: 'Unit price in the local currency' })
  @IsNumber()
  @IsPositive()
  unitPrice: number;
}
