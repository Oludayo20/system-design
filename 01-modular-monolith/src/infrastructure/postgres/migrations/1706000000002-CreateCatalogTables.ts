import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogTables1706000000002 implements MigrationInterface {
  name = 'CreateCatalogTables1706000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalog"."categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(120) NOT NULL,
        "slug" varchar(140) NOT NULL,
        CONSTRAINT "pk_catalog_categories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_catalog_categories_slug" ON "catalog"."categories" ("slug")`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL,
        "description" text NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "stock" int NOT NULL DEFAULT 0,
        "image_url" varchar(500),
        "category_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_catalog_products" PRIMARY KEY ("id"),
        CONSTRAINT "fk_catalog_products_category" FOREIGN KEY ("category_id")
          REFERENCES "catalog"."categories" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_catalog_products_category" ON "catalog"."products" ("category_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog"."products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog"."categories"`);
  }
}
