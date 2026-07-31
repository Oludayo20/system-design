import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ schema: 'basket', name: 'cart_items' })
@Unique('uq_cart_items_user_product', ['userId', 'productId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /**
   * Foreign-key-in-spirit only: this column deliberately has no TypeORM relation and no DB
   * foreign key into `catalog.products`. Basket knows a product exists only by asking
   * CatalogService.getProductForOrder(productId) — see basket.service.ts.
   */
  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
