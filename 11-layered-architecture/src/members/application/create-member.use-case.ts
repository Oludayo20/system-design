import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CreateMemberDto } from '../presentation/dto/create-member.dto';
import { MEMBER_REPOSITORY, MemberRepositoryPort } from '../domain/member-repository.port';
import { Member, MembershipStatus } from '../domain/member.entity';

@Injectable()
export class CreateMemberUseCase {
  constructor(@Inject(MEMBER_REPOSITORY) private readonly memberRepository: MemberRepositoryPort) {}

  async execute(dto: CreateMemberDto): Promise<Member> {
    const member = new Member(randomUUID(), dto.name, dto.email, MembershipStatus.ACTIVE);
    return this.memberRepository.save(member);
  }
}
