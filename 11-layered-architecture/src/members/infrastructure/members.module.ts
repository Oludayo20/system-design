import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateMemberUseCase } from '../application/create-member.use-case';
import { GetMemberUseCase } from '../application/get-member.use-case';
import { MEMBER_REPOSITORY } from '../domain/member-repository.port';
import { MembersController } from '../presentation/members.controller';
import { MemberOrmEntity } from './member.orm-entity';
import { TypeOrmMemberRepository } from './typeorm-member.repository';

@Module({
  imports: [TypeOrmModule.forFeature([MemberOrmEntity])],
  controllers: [MembersController],
  providers: [
    CreateMemberUseCase,
    GetMemberUseCase,
    { provide: MEMBER_REPOSITORY, useClass: TypeOrmMemberRepository },
  ],
  exports: [MEMBER_REPOSITORY],
})
export class MembersModule {}
