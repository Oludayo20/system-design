import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  // No boundary here: UsersService is exported as a plain provider and any module that imports
  // UsersModule can call any of its methods (see AuthService, CommentsService).
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
