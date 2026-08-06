import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiServerError,
  ApiUnauthorizedError,
  ApiValidationErrors,
} from '../../common/swagger/api-error.decorators';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderResponseDto } from './dto/create-order-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/jwt-payload.interface';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Place an order',
    description:
      '1. Validates stock via MarketplaceService.\n' +
      '2. Persists Order + OrderItems on **primary** Postgres in a transaction.\n' +
      '3. Publishes `order.created` to RabbitMQ.\n' +
      '4. Returns immediately — Email, Inventory, Analytics, and Wallet workers settle asynchronously.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, type: CreateOrderResponseDto })
  @ApiValidationErrors()
  @ApiUnauthorizedError()
  @ApiServerError()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.sub, dto);
  }
}
