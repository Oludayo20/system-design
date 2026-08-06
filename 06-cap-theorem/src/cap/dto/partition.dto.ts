import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class PartitionDto {
  @ApiProperty({
    example: true,
    description: 'When `true`, simulates a network partition between nodes A and B.',
  })
  @IsBoolean()
  enabled!: boolean;
}
