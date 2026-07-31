import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserDirectory } from './entities/user-directory.entity';
import { ShardingModule } from '../../sharding/sharding.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserDirectory], 'primary'), ShardingModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
