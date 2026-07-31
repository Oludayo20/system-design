import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Identical migration, run independently against shard0, shard1 and shard2
 * (each shard DataSource points at this same file - see
 * shard0/1/2.data-source.ts). Each shard keeps its own `migrations` history
 * table, so running this three times against three different databases is
 * expected and safe - it is NOT the same as running it three times against
 * one database.
 */
export class InitShardSchema1700000000001 implements MigrationInterface {
  name = 'InitShardSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY,
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "full_name" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "balance_cents" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE TYPE "ledger_entry_type_enum" AS ENUM ('CREDIT', 'DEBIT')`);
    await queryRunner.query(`
      CREATE TABLE "wallet_ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
        "type" "ledger_entry_type_enum" NOT NULL,
        "amount_cents" integer NOT NULL,
        "reason" varchar NOT NULL,
        "reference_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_ledger_entries_wallet_id" ON "wallet_ledger_entries" ("wallet_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wallet_ledger_entries"`);
    await queryRunner.query(`DROP TYPE "ledger_entry_type_enum"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
