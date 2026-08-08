import { Controller, Get } from '@nestjs/common';
import { PointsSummary } from './points.model';
import { PointsService } from './points.service';

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  /**
   * Inspection endpoint: points balance per customer, plus how many distinct eventIds have
   * been applied (useful for confirming the duplicate-delivery demo didn't double-count).
   */
  @Get()
  getSummary(): PointsSummary {
    return this.pointsService.getSummary();
  }
}
