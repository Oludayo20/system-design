import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('stock_items')
export class StockItem {
  @PrimaryColumn()
  sku: string;

  @Column()
  name: string;

  @Column('int')
  quantity: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
