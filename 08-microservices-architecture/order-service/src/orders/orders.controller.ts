import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload.interface';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';

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
      'userId comes from the JWT `sub` claim, not the request body. ' +
      'Calls catalog-service over HTTP to check price/stock and decrement it, ' +
      'then fire-and-forgets a call to notification-service (see README ' +
      '"Fault isolation" - stop notification-service and this endpoint still succeeds).',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  placeOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
    @Headers('authorization') authorization: string,
  ) {
    return this.ordersService.placeOrder(user.sub, dto, authorization);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's orders" })
  @ApiResponse({ status: 200, type: [OrderResponseDto] })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.ordersService.findAllForUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the current user\'s orders' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersService.findOneForUser(id, user.sub);
  }
}
