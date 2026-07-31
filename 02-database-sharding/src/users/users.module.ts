import { Module } from '@nestjs/common';
import { IdGeneratorService } from '../common/id-generator.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, IdGeneratorService],
})
export class UsersModule {}
