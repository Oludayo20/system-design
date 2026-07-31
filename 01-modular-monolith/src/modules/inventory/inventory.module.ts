import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryConsumer } from './inventory.consumer';

@Module({
  imports: [CatalogModule],
  providers: [InventoryConsumer],
})
export class InventoryModule {}
