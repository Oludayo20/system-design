import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem], 'primary'), MarketplaceModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
