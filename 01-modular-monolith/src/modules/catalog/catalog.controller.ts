import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { ProductResponseDto } from './dto/product-response.dto';
import { Product } from './entities/product.entity';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  @ApiOperation({
    summary: 'List all products',
    description: 'Returns every product in the catalog module. No caching on this list endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Product catalog.', type: [ProductResponseDto] })
  listProducts(): Promise<Product[]> {
    return this.catalogService.listProducts();
  }

  @Get('products/:id')
  @ApiOperation({
    summary: 'Get a product by ID (cache-aside)',
    description:
      'Reads from Redis first; on cache miss loads from PostgreSQL and populates Redis with a TTL. ' +
      'Call twice and check logs for "Cache hit" on the second request.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Product found.', type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'No product with this ID.' })
  getProduct(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.catalogService.getProduct(id);
  }
}
