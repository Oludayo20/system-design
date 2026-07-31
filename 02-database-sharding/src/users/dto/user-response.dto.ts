import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '1927841923837952' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  region!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ description: 'Shard index that owns this record, for demo transparency.' })
  shardIndex!: number;
}
