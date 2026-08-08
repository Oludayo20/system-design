import { Column, Entity, PrimaryColumn } from 'typeorm';
import { MembershipStatus } from '../domain/member.entity';

/** Data Access layer. TypeORM row shape — kept separate from the pure domain Member class. */
@Entity({ name: 'members' })
export class MemberOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({
    name: 'membership_status',
    type: 'varchar',
    length: 20,
    default: MembershipStatus.ACTIVE,
  })
  membershipStatus!: MembershipStatus;
}
