import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great breakdown of the tradeoffs!' })
  @IsNotEmpty()
  body: string;
}
