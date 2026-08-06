import { ApiProperty } from '@nestjs/swagger';

export class HealthReportDto {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status!: 'ok' | 'degraded';

  @ApiProperty({ example: 'api-1', description: 'Replica identifier from INSTANCE_ID env var.' })
  instanceId!: string;

  @ApiProperty({
    example: {
      'postgres-primary': 'up',
      'postgres-shard-0': 'up',
      'postgres-shard-1': 'up',
      'postgres-shard-2': 'up',
      redis: 'up',
      rabbitmq: 'up',
    },
    description: 'Per-dependency probe results.',
  })
  services!: Record<string, 'up' | 'down'>;
}
