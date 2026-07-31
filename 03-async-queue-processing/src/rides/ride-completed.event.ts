/** Payload published to the ride_events exchange with routing key "ride.completed". */
export interface RideCompletedEvent {
  rideId: string;
  riderId: string;
  driverId: string;
  fare: string;
  pickupLocation: string;
  dropoffLocation: string;
  completedAt: string;
}
