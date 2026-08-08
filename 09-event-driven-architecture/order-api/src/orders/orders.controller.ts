import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiReadErrors, ApiServerError, ApiValidationErrors } from '../common/swagger/api-error.decorators';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { Order } from './entities/order.entity';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Place an order (the only producer endpoint in this project)',
    description:
      '**Synchronous path:** persists the order to PostgreSQL inside a transaction (~ms).\n\n' +
      '**Async path:** once — and only once — that transaction has committed, publishes ' +
      '`order.placed` to the `grocery_events` topic exchange, then returns immediately. ' +
      'inventory-consumer, notification-consumer, analytics-consumer, and loyalty-consumer each ' +
      'independently subscribe to this event in separate processes; order-api never calls them, ' +
      'never waits for them, and does not know they exist.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Order committed and order.placed published. Consumers react asynchronously.',
    type: OrderResponseDto,
  })
  @ApiValidationErrors()
  @ApiServerError()
  async placeOrder(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.ordersService.placeOrder(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a previously placed order' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order found.', type: OrderResponseDto })
  @ApiReadErrors()
  async getOrder(@Param('id') id: string): Promise<Order> {
    return this.ordersService.getOrder(id);
  }
}
