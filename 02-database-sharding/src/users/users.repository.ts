import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { UserRow } from './user.types';

/**
 * Plain SQL against whichever pool the caller already resolved. This class
 * has no idea shards exist - it just runs queries against a `Pool`. All
 * shard-routing decisions happen one layer up, in UsersService, via
 * ShardManagerService. Keeping that separation is what makes it structurally
 * impossible for a query here to accidentally hit more than one shard.
 */
@Injectable()
export class UsersRepository {
  async insert(
    pool: Pool,
    row: { id: number; email: string; displayName: string; region: string },
  ): Promise<UserRow> {
    const result = await pool.query<UserRow>(
      `INSERT INTO users (id, email, display_name, region)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, region, created_at`,
      [row.id, row.email, row.displayName, row.region],
    );
    return result.rows[0];
  }

  async findById(pool: Pool, id: number): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      `SELECT id, email, display_name, region, created_at FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async count(pool: Pool): Promise<number> {
    const result = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`);
    return Number(result.rows[0].count);
  }
}
