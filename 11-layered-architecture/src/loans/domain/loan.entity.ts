import { LoanAlreadyReturnedError } from './loan-domain.errors';

/** Domain layer. Plain TypeScript only — no NestJS, no TypeORM. */
export class Loan {
  constructor(
    public readonly id: string,
    public readonly bookId: string,
    public readonly memberId: string,
    public readonly borrowedAt: Date,
    public readonly dueAt: Date,
    public returnedAt: Date | null,
  ) {}

  isActive(): boolean {
    return this.returnedAt === null;
  }

  /** Business rule #3 (part of it): a loan is overdue if unreturned and past its due date. */
  isOverdue(asOf: Date = new Date()): boolean {
    return this.isActive() && asOf.getTime() > this.dueAt.getTime();
  }

  /** Business rule #4: returning a book sets returnedAt. */
  markReturned(asOf: Date = new Date()): void {
    if (!this.isActive()) {
      throw new LoanAlreadyReturnedError(`Loan ${this.id} has already been returned.`);
    }
    this.returnedAt = asOf;
  }
}
