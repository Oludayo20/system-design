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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../identity/identity.types';
import { BasketView } from './basket.types';
import { BasketService } from './basket.service';
import { AddItemDto } from './dto/add-item.dto';

@ApiTags('basket')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('basket')
export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  @Get()
  getBasket(@CurrentUser() user: AuthenticatedUser): Promise<BasketView> {
    return this.basketService.getBasket(user.userId);
  }

  @Post('items')
  addItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddItemDto): Promise<BasketView> {
    return this.basketService.addItem(user.userId, dto);
  }

  @Delete('items/:productId')
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<BasketView> {
    return this.basketService.removeItem(user.userId, productId);
  }
}
