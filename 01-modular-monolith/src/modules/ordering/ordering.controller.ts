import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../identity/identity.types';
import { OrderResponseDto, PlaceOrderResponseDto } from './dto/order-response.dto';
import { Order } from './entities/order.entity';
import { OrderingService, PlaceOrderResult } from './ordering.service';

@ApiTags('ordering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderingController {
  constructor(private readonly orderingService: OrderingService) {}

  @Post()
  @ApiOperation({
    summary: 'Place an order from the current basket',
    description:
      'Snapshots the basket into an order inside a DB transaction, commits, then publishes `order.created` ' +
      'to RabbitMQ without awaiting consumers. Returns in well under a second while Inventory and Notifications ' +
      'process asynchronously.',
  })
  @ApiResponse({ status: 201, description: 'Order placed.', type: PlaceOrderResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Basket is empty.' })
  placeOrder(@CurrentUser() user: AuthenticatedUser): Promise<PlaceOrderResult> {
    return this.orderingService.placeOrder(user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List order history for the current user' })
  @ApiResponse({ status: 200, description: 'Orders newest first.', type: [OrderResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  listOrders(@CurrentUser() user: AuthenticatedUser): Promise<Order[]> {
    return this.orderingService.listOrders(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order by ID' })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Order with line items.', type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found or not owned by this user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    return this.orderingService.getOrder(user.userId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a placed order',
    description: 'Only orders in `placed` status can be cancelled.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cancelled order.', type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiForbiddenResponse({ description: 'Order cannot be cancelled (wrong status or not owned).' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Order> {
    return this.orderingService.cancelOrder(user.userId, id);
  }
}
