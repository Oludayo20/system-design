import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity({ name: 'order_items' })
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'product_id' })
  productId: string;

  // Snapshot at purchase time - Catalog prices can change after the sale.
  @Column({ name: 'product_name' })
  productName: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents: number;
}
