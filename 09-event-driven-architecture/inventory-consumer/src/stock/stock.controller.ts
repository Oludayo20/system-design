import { Controller, Get } from '@nestjs/common';
import { StockItem } from './entities/stock-item.entity';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  /** Inspection endpoint: current stock levels, to observe order.placed being applied. */
  @Get()
  async getStock(): Promise<StockItem[]> {
    return this.stockService.getAll();
  }
}
