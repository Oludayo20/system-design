import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * No constructor dependencies, so any controller in the app can `@UseGuards(JwtAuthGuard)` by
 * importing this class directly — it doesn't need AuthModule imported alongside it. That's the
 * monolith habit this project is built to show: nothing stops a module from reaching straight
 * into another module's file instead of going through a declared module boundary.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
