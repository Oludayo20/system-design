import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RemoveItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;
}
