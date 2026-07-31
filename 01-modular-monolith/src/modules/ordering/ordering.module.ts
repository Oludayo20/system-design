import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BasketModule } from '../basket/basket.module';
import { IdentityModule } from '../identity/identity.module';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderingController } from './ordering.controller';
import { OrderingService } from './ordering.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), BasketModule, IdentityModule],
  controllers: [OrderingController],
  providers: [OrderingService],
})
export class OrderingModule {}
