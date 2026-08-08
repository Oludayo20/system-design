import { ApiProperty } from '@nestjs/swagger';

export class BookResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'Clean Architecture' })
  title!: string;

  @ApiProperty({ example: 'Robert C. Martin' })
  author!: string;

  @ApiProperty({ example: '9780134494166' })
  isbn!: string;

  @ApiProperty({ example: 3 })
  totalCopies!: number;

  @ApiProperty({ example: 2 })
  availableCopies!: number;
}
