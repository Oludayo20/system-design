import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One PostgreSQL instance, one database — but schema-per-module (the "stronger boundary" option
 * described in the design doc). Each feature module owns exactly one schema and no module is
 * granted cross-schema foreign keys into another module's tables.
 */
export class CreateSchemas1706000000000 implements MigrationInterface {
  name = 'CreateSchemas1706000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "identity"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "catalog"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "basket"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "ordering"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS "ordering" CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "basket" CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "catalog" CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "identity" CASCADE`);
  }
}
