import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('products')
  listProducts() {
    return this.marketplaceService.listProducts();
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.marketplaceService.getProductById(id);
  }

  @Get('categories')
  listCategories() {
    return this.marketplaceService.listCategories();
  }
}
