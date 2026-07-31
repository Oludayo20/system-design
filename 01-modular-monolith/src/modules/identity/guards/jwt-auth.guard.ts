import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * The one piece of Identity every other module is allowed to depend on directly. Basket and
 * Ordering import this guard (a stable, narrow contract) instead of reaching into Identity's
 * services or tables.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
