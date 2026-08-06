import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import {
  ApiMutationErrors,
  ApiNotFoundError,
  ApiReadErrors,
} from '../../shared/swagger/api-error.decorators';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../identity/identity.types';
import { BasketView } from './basket.types';
import { BasketService } from './basket.service';
import { AddItemDto } from './dto/add-item.dto';
import { BasketResponseDto } from './dto/basket-response.dto';

@ApiTags('basket')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('basket')
export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the current user basket',
    description: 'Returns cart line items with prices resolved via CatalogService (not direct SQL joins).',
  })
  @ApiResponse({ status: 200, description: 'Current basket.', type: BasketResponseDto })
  @ApiReadErrors({ auth: true })
  getBasket(@CurrentUser() user: AuthenticatedUser): Promise<BasketView> {
    return this.basketService.getBasket(user.userId);
  }

  @Post('items')
  @ApiOperation({
    summary: 'Add a product to the basket',
    description: 'Resolves product name and price through CatalogService public API. Merges quantity if the product is already in the cart.',
  })
  @ApiBody({ type: AddItemDto })
  @ApiResponse({ status: 201, description: 'Updated basket.', type: BasketResponseDto })
  @ApiMutationErrors({ auth: true })
  @ApiNotFoundError('Product not found in catalog.')
  addItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddItemDto): Promise<BasketView> {
    return this.basketService.addItem(user.userId, dto);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove a product from the basket' })
  @ApiParam({ name: 'productId', description: 'Product UUID to remove', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Updated basket.', type: BasketResponseDto })
  @ApiReadErrors({ auth: true })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<BasketView> {
    return this.basketService.removeItem(user.userId, productId);
  }
}
