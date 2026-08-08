import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MEMBER_REPOSITORY, MemberRepositoryPort } from '../../members/domain/member-repository.port';
import { Loan } from '../domain/loan.entity';
import { LOAN_REPOSITORY, LoanRepositoryPort } from '../domain/loan-repository.port';

@Injectable()
export class ListMemberLoansUseCase {
  constructor(
    @Inject(LOAN_REPOSITORY) private readonly loanRepository: LoanRepositoryPort,
    @Inject(MEMBER_REPOSITORY) private readonly memberRepository: MemberRepositoryPort,
  ) {}

  async execute(memberId: string): Promise<Loan[]> {
    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundException(`No member with id ${memberId}.`);
    }
    return this.loanRepository.findByMemberId(memberId);
  }
}
