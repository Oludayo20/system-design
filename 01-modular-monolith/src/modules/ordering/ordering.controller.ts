import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../identity/identity.types';
import { Order } from './entities/order.entity';
import { OrderingService, PlaceOrderResult } from './ordering.service';

@ApiTags('ordering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderingController {
  constructor(private readonly orderingService: OrderingService) {}

  @Post()
  placeOrder(@CurrentUser() user: AuthenticatedUser): Promise<PlaceOrderResult> {
    return this.orderingService.placeOrder(user.userId);
  }

  @Get()
  listOrders(@CurrentUser() user: AuthenticatedUser): Promise<Order[]> {
    return this.orderingService.listOrders(user.userId);
  }

  @Get(':id')
  getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    return this.orderingService.getOrder(user.userId, id);
  }

  @Post(':id/cancel')
  cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    return this.orderingService.cancelOrder(user.userId, id);
  }
}
