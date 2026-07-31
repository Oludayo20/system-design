import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBasketCartItemsTable1706000000003 implements MigrationInterface {
  name = 'CreateBasketCartItemsTable1706000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "basket"."cart_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" int NOT NULL,
        "added_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "pk_basket_cart_items" PRIMARY KEY ("id"),
        CONSTRAINT "uq_cart_items_user_product" UNIQUE ("user_id", "product_id")
      )
    `);
    // No foreign key to catalog.products or identity.users on purpose: Basket never joins
    // across schemas, it resolves product data through CatalogService at read time instead.
    await queryRunner.query(
      `CREATE INDEX "ix_basket_cart_items_user" ON "basket"."cart_items" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "basket"."cart_items"`);
  }
}
