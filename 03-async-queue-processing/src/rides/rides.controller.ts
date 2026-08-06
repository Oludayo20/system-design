import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompleteRideResponseDto } from './dto/complete-ride-response.dto';
import { CreateRideDto } from './dto/create-ride.dto';
import { CompleteRideResult, RidesService } from './rides.service';

@ApiTags('rides')
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Complete a ride (producer)',
    description:
      '**Synchronous path:** persists the ride to PostgreSQL (~100ms).\n\n' +
      '**Async path:** publishes `ride.completed` to the RabbitMQ `ride_events` topic exchange (~few ms), ' +
      'then returns immediately. Email, analytics, and loyalty workers consume from separate queues ' +
      'in a different process — the rider never waits on those side effects.\n\n' +
      'See README for retry/DLQ topology on `email.queue`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Ride saved and event published. Workers process asynchronously.',
    type: CompleteRideResponseDto,
  })
  async completeRide(@Body() dto: CreateRideDto): Promise<CompleteRideResult> {
    return this.ridesService.completeRide(dto);
  }
}
