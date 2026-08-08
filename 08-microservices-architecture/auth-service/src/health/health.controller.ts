import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

/** Excluded from Swagger - a plain liveness probe for docker-compose healthchecks. */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'auth-service' };
  }
}
