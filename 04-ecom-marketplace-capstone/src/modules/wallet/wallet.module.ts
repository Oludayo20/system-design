import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { OrderSettlementListener } from './listeners/order-settlement.listener';
import { ShardingModule } from '../../sharding/sharding.module';

@Module({
  imports: [ShardingModule],
  controllers: [WalletController],
  providers: [WalletService, OrderSettlementListener],
  exports: [WalletService],
})
export class WalletModule {}
