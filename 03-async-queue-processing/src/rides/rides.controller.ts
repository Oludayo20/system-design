import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateRideDto } from './dto/create-ride.dto';
import { CompleteRideResult, RidesService } from './rides.service';

@ApiTags('rides')
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Complete a ride (Producer)',
    description:
      'Persists the ride and publishes ride.completed to RabbitMQ, then returns immediately. ' +
      'The receipt email, analytics record, and loyalty points are produced by independent ' +
      'workers after this request has already responded.',
  })
  @ApiResponse({ status: 201, description: 'Ride saved, ride.completed published.' })
  async completeRide(@Body() dto: CreateRideDto): Promise<CompleteRideResult> {
    return this.ridesService.completeRide(dto);
  }
}
