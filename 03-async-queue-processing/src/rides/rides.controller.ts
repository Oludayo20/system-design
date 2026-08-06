import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiServerError, ApiValidationErrors } from '../common/swagger/api-error.decorators';
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
  @ApiBody({ type: CreateRideDto })
  @ApiResponse({
    status: 201,
    description: 'Ride saved and event published. Workers process asynchronously.',
    type: CompleteRideResponseDto,
  })
  @ApiValidationErrors()
  @ApiServerError()
  async completeRide(@Body() dto: CreateRideDto): Promise<CompleteRideResult> {
    return this.ridesService.completeRide(dto);
  }
}
