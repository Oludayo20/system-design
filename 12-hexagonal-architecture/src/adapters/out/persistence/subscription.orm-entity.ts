import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * TypeORM entity. This is the ONLY place `typeorm` decorators appear for subscriptions — the
 * domain's Subscription class (src/core/domain/subscription.ts) has never heard of TypeORM.
 * PostgresSubscriptionRepository maps between the two.
 */
@Entity({ name: 'subscriptions' })
export class SubscriptionOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 100 })
  customerId: string;

  @Column({ name: 'plan_id', type: 'varchar', length: 20 })
  planId: string;

  @Column({ name: 'current_period_start', type: 'timestamptz' })
  currentPeriodStart: Date;

  @Column({ name: 'current_period_end', type: 'timestamptz' })
  currentPeriodEnd: Date;

  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
