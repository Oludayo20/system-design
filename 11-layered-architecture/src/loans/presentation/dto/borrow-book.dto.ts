import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class BorrowBookDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  bookId!: string;

  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @IsUUID()
  memberId!: string;
}
