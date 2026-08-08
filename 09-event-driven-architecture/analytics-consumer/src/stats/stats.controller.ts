import { Controller, Get } from '@nestjs/common';
import { SalesStats } from './stats.model';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** Inspection endpoint: today's running sales counters. */
  @Get()
  getStats(): SalesStats {
    return this.statsService.getStats();
  }
}
