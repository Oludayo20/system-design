import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category])],
  controllers: [CatalogController],
  providers: [CatalogService],
  // CatalogService is the ONLY export: Basket and Ordering may call getProductForOrder(),
  // but they cannot inject the Product/Category repositories — those stay private to this module.
  exports: [CatalogService],
})
export class CatalogModule {}
