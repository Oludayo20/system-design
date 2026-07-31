import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { Product } from './entities/product.entity';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  listProducts(): Promise<Product[]> {
    return this.catalogService.listProducts();
  }

  @Get('products/:id')
  getProduct(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.catalogService.getProduct(id);
  }
}
