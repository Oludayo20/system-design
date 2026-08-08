import { Book } from '../../books/domain/book.entity';
import { BookUnavailableError, MaxActiveLoansExceededError, OverdueLoanExistsError } from './loan-domain.errors';
import { Loan } from './loan.entity';

/**
 * The actual business rules for borrowing, as pure functions over plain domain objects.
 * Nothing in this file imports NestJS or TypeORM, and nothing here touches a database —
 * it operates entirely on `Book` and `Loan` instances handed to it by the Application layer.
 *
 * This is the part of the codebase reviewers should scrutinize most closely: it is the reason
 * the other four layers exist. See loan-eligibility.rules.spec.ts for tests that exercise this
 * class with zero setup — no NestJS TestingModule, no database, no HTTP server.
 */
const MAX_ACTIVE_LOANS = 3;

export class LoanEligibilityRules {
  /**
   * Throws a domain error if the member is not allowed to borrow `book` right now.
   * Returns void (no throw) if borrowing is allowed.
   */
  static assertCanBorrow(book: Book, memberActiveLoans: Loan[], now: Date = new Date()): void {
    // Rule 1: no available copies.
    if (!book.hasAvailableCopies()) {
      throw new BookUnavailableError(`"${book.title}" has no available copies right now.`);
    }

    // Rule 2: at most 3 active (unreturned) loans at a time.
    if (memberActiveLoans.length >= MAX_ACTIVE_LOANS) {
      throw new MaxActiveLoansExceededError(
        `Member already has ${memberActiveLoans.length} active loan(s) (limit is ${MAX_ACTIVE_LOANS}).`,
      );
    }

    // Rule 3: any overdue, unreturned loan blocks further borrowing.
    const overdueLoan = memberActiveLoans.find((loan) => loan.isOverdue(now));
    if (overdueLoan) {
      throw new OverdueLoanExistsError(
        `Member has an overdue loan (loan ${overdueLoan.id}, due ${overdueLoan.dueAt.toISOString()}) ` +
          'and cannot borrow further books until it is returned.',
      );
    }
  }
}
