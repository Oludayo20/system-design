import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Why plain monoliths still ship products' })
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'A monolith is just one app, one repo, one deploy...' })
  @IsNotEmpty()
  body: string;
}
