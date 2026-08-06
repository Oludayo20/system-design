import { ApiProperty } from '@nestjs/swagger';

export class CompleteRideResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({
    example: '5f1b6b2e-8c4d-4a1e-9f3b-2d7e6a5b4c3d',
    description: 'UUID of the persisted ride record.',
  })
  rideId!: string;
}
