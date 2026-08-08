import { Loan } from './loan.entity';

export interface LoanRepositoryPort {
  save(loan: Loan): Promise<Loan>;
  findById(id: string): Promise<Loan | null>;
  findByMemberId(memberId: string): Promise<Loan[]>;
  /** Unreturned loans only — used by the eligibility rules. */
  findActiveByMemberId(memberId: string): Promise<Loan[]>;
}

/** DI token — lets Application-layer use-cases `@Inject` the port without knowing TypeORM exists. */
export const LOAN_REPOSITORY = Symbol('LOAN_REPOSITORY');
