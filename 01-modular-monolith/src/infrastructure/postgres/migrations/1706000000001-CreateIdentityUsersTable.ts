import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentityUsersTable1706000000001 implements MigrationInterface {
  name = 'CreateIdentityUsersTable1706000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "identity"."users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "full_name" varchar(255) NOT NULL,
        "roles" text NOT NULL DEFAULT 'customer',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_identity_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_identity_users_email" ON "identity"."users" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "identity"."users"`);
  }
}
