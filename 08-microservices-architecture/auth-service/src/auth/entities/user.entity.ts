import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Lives only in auth-db. catalog-service and order-service never query
 * this table directly - they only ever learn `userId` from a verified JWT
 * `sub` claim. That's the whole point of this project: no cross-service
 * database reads, only network calls (or, for identity, a self-contained
 * signed token).
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
