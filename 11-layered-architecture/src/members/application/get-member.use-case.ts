import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MEMBER_REPOSITORY, MemberRepositoryPort } from '../domain/member-repository.port';
import { Member } from '../domain/member.entity';

@Injectable()
export class GetMemberUseCase {
  constructor(@Inject(MEMBER_REPOSITORY) private readonly memberRepository: MemberRepositoryPort) {}

  async execute(id: string): Promise<Member> {
    const member = await this.memberRepository.findById(id);
    if (!member) {
      throw new NotFoundException(`No member with id ${id}.`);
    }
    return member;
  }
}
