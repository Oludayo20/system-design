import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiServerError } from '../../common/swagger/api-error.decorators';
import { HealthService } from './health.service';
import { HealthReportDto } from './dto/health-report.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Infrastructure health check',
    description:
      'Probes primary Postgres, all three user/wallet shards, Redis, and RabbitMQ. ' +
      'Returns HTTP 200 when all are up, HTTP 503 when any dependency is down. ' +
      'Used by Nginx and Docker Compose healthchecks.',
  })
  @ApiResponse({ status: 200, description: 'All dependencies healthy.', type: HealthReportDto })
  @ApiResponse({ status: 503, description: 'One or more dependencies unreachable.', type: HealthReportDto })
  @ApiServerError()
  async check(@Res() res: Response) {
    const report = await this.healthService.check(this.config.get<string>('instanceId')!);
    res
      .status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(report);
  }
}
