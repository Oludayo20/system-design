import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rides')
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  riderId: string;

  @Column()
  driverId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  fare: string;

  @Column()
  pickupLocation: string;

  @Column()
  dropoffLocation: string;

  @Column({ default: 'completed' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
