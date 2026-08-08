import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateBookDto {
  @ApiProperty({ example: 'The Pragmatic Programmer' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: 'David Thomas & Andrew Hunt' })
  @IsString()
  @MinLength(1)
  author: string;

  @ApiProperty({ example: 3500, description: 'Price in cents' })
  @IsInt()
  @Min(0)
  priceCents: number;

  @ApiProperty({ example: 25, description: 'Units in stock' })
  @IsInt()
  @Min(0)
  stock: number;
}
