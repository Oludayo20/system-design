import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { RIDE_COMPLETED_ROUTING_KEY, RIDE_EVENTS_EXCHANGE } from '../common/rabbitmq/topology';
import { CreateRideDto } from './dto/create-ride.dto';
import { Ride } from './entities/ride.entity';
import { RideCompletedEvent } from './ride-completed.event';

export interface CompleteRideResult {
  success: true;
  rideId: string;
}

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    @InjectRepository(Ride) private readonly rides: Repository<Ride>,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  /**
   * Mirrors the doc's Uber example: persist the trip (the one thing the rider needs to be
   * durable before we respond), publish ride.completed, and return. We deliberately do not
   * call — let alone await — sendEmail/generateReceipt/updateAnalytics/awardLoyaltyPoints here;
   * those only exist inside the worker process, reached solely by consuming the queues that
   * ride_events fans out to. That is what keeps this handler in the ~200ms range instead of the
   * 6-7s a fully-serial implementation would take.
   */
  async completeRide(dto: CreateRideDto): Promise<CompleteRideResult> {
    const ride = await this.rides.save(
      this.rides.create({
        riderId: dto.riderId,
        driverId: dto.driverId,
        fare: dto.fare.toFixed(2),
        pickupLocation: dto.pickupLocation,
        dropoffLocation: dto.dropoffLocation,
        status: 'completed',
      }),
    );

    const event: RideCompletedEvent = {
      rideId: ride.id,
      riderId: ride.riderId,
      driverId: ride.driverId,
      fare: ride.fare,
      pickupLocation: ride.pickupLocation,
      dropoffLocation: ride.dropoffLocation,
      completedAt: ride.createdAt.toISOString(),
    };

    await this.rabbitmq.publish(RIDE_EVENTS_EXCHANGE, RIDE_COMPLETED_ROUTING_KEY, event);
    this.logger.log(`Ride ${ride.id} completed and ride.completed published`);

    return { success: true, rideId: ride.id };
  }
}
