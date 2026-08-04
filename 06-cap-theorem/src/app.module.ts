import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CapModule } from './cap/cap.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CapModule],
})
export class AppModule {}
