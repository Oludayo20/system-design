/* eslint-disable no-console */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import configuration from '../src/config/configuration';
import { IdGeneratorService } from '../src/common/id-generator.service';
import { createShardingStrategy } from '../src/sharding/sharding-strategy.factory';

/**
 * Inserts ~1000 synthetic users directly (no HTTP hop) so this script can
 * run standalone against the shards started by `docker compose up -d`, and
 * prints the resulting per-shard distribution.
 *
 * Under the default hash strategy this should come out roughly even across
 * shards. If you flip SHARDING_STRATEGY=range in your .env before running
 * this, the same 1000 users - because their global IDs are generated
 * sequentially in time - will land almost entirely on whichever shard owns
 * the current id window, skewing hard toward one shard. That skew is the
 * concrete illustration of why range sharding needs care around ID
 * distribution while hash sharding doesn't.
 */

const REGIONS = ['africa', 'europe', 'asia'];
const USER_COUNT = 1000;

function randomEmail(index: number): string {
  return `seed-user-${index}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function randomRegion(): string {
  return REGIONS[Math.floor(Math.random() * REGIONS.length)];
}

async function main() {
  const config = configuration();
  const strategy = createShardingStrategy(config.shardingStrategy, config.shardCount);
  const idGenerator = new IdGeneratorService();

  const pools = config.shards.map(
    (shard) =>
      new Pool({
        host: shard.host,
        port: shard.port,
        database: shard.database,
        user: shard.user,
        password: shard.password,
      }),
  );

  console.log(`Seeding ${USER_COUNT} users using the "${strategy.name}" strategy...`);

  const perShardInserted = new Array(pools.length).fill(0);

  for (let i = 0; i < USER_COUNT; i++) {
    const id = idGenerator.nextId();
    const region = randomRegion();
    const shardIndex = strategy.resolveShard(id, { region });

    await pools[shardIndex].query(
      `INSERT INTO users (id, email, display_name, region)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [id, randomEmail(i), `Seed User ${i}`, region],
    );

    perShardInserted[shardIndex]++;
  }

  console.log('\nInserted (by this run):');
  perShardInserted.forEach((count, shardIndex) => {
    console.log(`  shard ${shardIndex}: ${count} rows`);
  });

  console.log('\nActual row counts per shard (COUNT(*) after seeding):');
  let total = 0;
  for (let shardIndex = 0; shardIndex < pools.length; shardIndex++) {
    const result = await pools[shardIndex].query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM users',
    );
    const count = Number(result.rows[0].count);
    total += count;
    console.log(`  shard ${shardIndex}: ${count} rows`);
  }
  console.log(`  total: ${total} rows`);

  await Promise.all(pools.map((pool) => pool.end()));
}

main().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
