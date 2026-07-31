import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Registered once, globally, so every module that protects a route with
 * `@UseGuards(JwtAuthGuard)` gets the same JwtService/secret without each
 * module re-declaring its own JwtModule.registerAsync (which would risk
 * subtly different config drifting apart, e.g. mismatched expiresIn).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret'),
        signOptions: { expiresIn: config.get<string>('jwtExpiresIn') },
      }),
    }),
  ],
  providers: [JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class JwtCommonModule {}
