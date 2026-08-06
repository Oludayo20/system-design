import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { CategoryResponseDto, ProductResponseDto } from './dto/marketplace-response.dto';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('products')
  @ApiOperation({
    summary: 'List all products',
    description: 'Redis cache-aside: first call hits Postgres and populates cache; subsequent calls (within TTL) serve from Redis.',
  })
  @ApiResponse({ status: 200, type: [ProductResponseDto] })
  listProducts() {
    return this.marketplaceService.listProducts();
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  getProduct(@Param('id') id: string) {
    return this.marketplaceService.getProductById(id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  listCategories() {
    return this.marketplaceService.listCategories();
  }
}
