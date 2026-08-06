import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiNotFoundError, ApiReadErrors } from '../../common/swagger/api-error.decorators';
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
  @ApiReadErrors()
  listProducts() {
    return this.marketplaceService.listProducts();
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  @ApiReadErrors()
  @ApiNotFoundError('Product not found.')
  getProduct(@Param('id') id: string) {
    return this.marketplaceService.getProductById(id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  @ApiReadErrors()
  listCategories() {
    return this.marketplaceService.listCategories();
  }
}
