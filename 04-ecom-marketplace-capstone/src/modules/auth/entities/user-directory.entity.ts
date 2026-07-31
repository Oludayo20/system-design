import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * `user_directory` lives on the PRIMARY (unsharded) database and answers
 * exactly one question at login time: "given an email, which shard is this
 * user's row on?".
 *
 * Why not just hash the email? Because the shard key is hash(userId), not
 * hash(email) - a user's userId is generated once at registration and never
 * changes, whereas allowing email changes to silently move a user's data to
 * a different shard would be a much harder problem. So something has to
 * remember the email -> {userId, shardIndex} mapping, and that something
 * can't live *on* a shard (you'd have to guess the shard to find it, which
 * is the chicken-and-egg problem sharding creates for any lookup key that
 * isn't the shard key itself).
 *
 * Tradeoff (documented in README): this table is a second write on every
 * registration, in a *different* database than the shard the user row was
 * just written to. There is no distributed transaction across the two -
 * AuthService writes the shard row first, then this directory row, and
 * compensates (deletes the shard row) if the second write fails. That
 * leaves a narrow window where a crash between the two writes could strand
 * an orphaned user row on a shard with no directory entry pointing at it.
 * In production this would be closed with an outbox/reconciliation job;
 * for this demo the compensating delete is judged sufficient.
 */
@Entity({ name: 'user_directory' })
export class UserDirectory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'shard_index', type: 'integer' })
  shardIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
