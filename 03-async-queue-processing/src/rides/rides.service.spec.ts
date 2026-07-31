import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { RIDE_COMPLETED_ROUTING_KEY, RIDE_EVENTS_EXCHANGE } from '../common/rabbitmq/topology';
import { Ride } from './entities/ride.entity';
import { RidesService } from './rides.service';

describe('RidesService', () => {
  let service: RidesService;
  let publish: jest.Mock;
  let save: jest.Mock;
  let create: jest.Mock;

  const dto = {
    riderId: 'rider-1',
    driverId: 'driver-1',
    fare: 24.5,
    pickupLocation: 'Ikeja, Lagos',
    dropoffLocation: 'Lekki, Lagos',
  };

  beforeEach(async () => {
    create = jest.fn((partial) => partial);
    save = jest.fn(async (partial) => ({
      id: 'ride-123',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      ...partial,
    }));
    publish = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        RidesService,
        { provide: getRepositoryToken(Ride), useValue: { create, save } },
        { provide: RabbitmqService, useValue: { publish } },
      ],
    }).compile();

    service = moduleRef.get(RidesService);
  });

  it('persists the ride and returns { success: true, rideId } immediately', async () => {
    const result = await service.completeRide(dto);

    expect(save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, rideId: 'ride-123' });
  });

  it('publishes ride.completed to the ride_events exchange with the ride payload', async () => {
    await service.completeRide(dto);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      RIDE_EVENTS_EXCHANGE,
      RIDE_COMPLETED_ROUTING_KEY,
      expect.objectContaining({
        rideId: 'ride-123',
        riderId: dto.riderId,
        driverId: dto.driverId,
        fare: '24.50',
      }),
    );
  });

  it('saves before publishing — the event carries the persisted ride id', async () => {
    await service.completeRide(dto);

    const saveOrder = save.mock.invocationCallOrder[0];
    const publishOrder = publish.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(publishOrder);
  });

  it('never touches worker logic: its only collaborators are the repository and the publisher', async () => {
    // Workers (Email/Analytics/Loyalty) live in a separate process (worker.main.ts), reachable
    // only by consuming a queue — RidesService has no dependency on them at all, so "returns
    // immediately without awaiting worker logic" holds by construction here, not just by timing.
    await service.completeRide(dto);
    expect(publish).toHaveBeenCalled();
  });
});
