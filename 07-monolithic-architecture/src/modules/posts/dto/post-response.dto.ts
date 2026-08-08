import { ApiProperty } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId!: string;

  @ApiProperty({ example: 'Why plain monoliths still ship products' })
  title!: string;

  @ApiProperty({ example: 'A monolith is just one app, one repo, one deploy...' })
  body!: string;

  @ApiProperty({ example: '2026-08-08T12:00:00.000Z' })
  createdAt!: Date;
}
