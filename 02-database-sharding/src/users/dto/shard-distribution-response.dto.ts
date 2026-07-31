import { ApiProperty } from '@nestjs/swagger';

export class ShardCountDto {
  @ApiProperty()
  shardIndex!: number;

  @ApiProperty()
  userCount!: number;
}

export class ShardDistributionResponseDto {
  @ApiProperty({ description: 'Active sharding strategy at the time this ran.' })
  strategy!: string;

  @ApiProperty({ type: [ShardCountDto] })
  shards!: ShardCountDto[];

  @ApiProperty()
  totalUsers!: number;
}
