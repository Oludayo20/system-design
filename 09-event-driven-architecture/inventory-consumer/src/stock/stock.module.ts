import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockItem } from './entities/stock-item.entity';
import { StockConsumer } from './stock.consumer';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [TypeOrmModule.forFeature([StockItem])],
  controllers: [StockController],
  providers: [StockService, StockConsumer],
})
export class StockModule {}
