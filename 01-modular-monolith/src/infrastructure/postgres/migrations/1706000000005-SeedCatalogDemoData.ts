import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCatalogDemoData1706000000005 implements MigrationInterface {
  name = 'SeedCatalogDemoData1706000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const categories: Array<{ name: string; slug: string }> = [
      { name: 'Computers', slug: 'computers' },
      { name: 'Audio', slug: 'audio' },
      { name: 'Accessories', slug: 'accessories' },
    ];

    for (const category of categories) {
      await queryRunner.query(
        `INSERT INTO "catalog"."categories" ("name", "slug") VALUES ($1, $2)`,
        [category.name, category.slug],
      );
    }

    const products: Array<{
      name: string;
      description: string;
      price: string;
      stock: number;
      categorySlug: string;
    }> = [
      {
        name: 'Laptop Pro 14"',
        description: '14-inch laptop with 32GB RAM and a 1TB SSD, built for developers.',
        price: '1899.00',
        stock: 25,
        categorySlug: 'computers',
      },
      {
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with silent clicks and USB-C charging.',
        price: '39.99',
        stock: 200,
        categorySlug: 'accessories',
      },
      {
        name: 'Mechanical Keyboard',
        description: 'Hot-swappable mechanical keyboard with tactile brown switches.',
        price: '129.00',
        stock: 80,
        categorySlug: 'accessories',
      },
      {
        name: 'Noise Cancelling Headphones',
        description: 'Over-ear headphones with active noise cancellation and 30h battery life.',
        price: '249.50',
        stock: 60,
        categorySlug: 'audio',
      },
      {
        name: '27" 4K Monitor',
        description: '27-inch 4K IPS monitor with USB-C power delivery.',
        price: '449.00',
        stock: 40,
        categorySlug: 'computers',
      },
    ];

    for (const product of products) {
      await queryRunner.query(
        `
          INSERT INTO "catalog"."products" ("name", "description", "price", "stock", "category_id")
          VALUES ($1, $2, $3, $4, (SELECT "id" FROM "catalog"."categories" WHERE "slug" = $5))
        `,
        [product.name, product.description, product.price, product.stock, product.categorySlug],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "catalog"."products"`);
    await queryRunner.query(`DELETE FROM "catalog"."categories"`);
  }
}
