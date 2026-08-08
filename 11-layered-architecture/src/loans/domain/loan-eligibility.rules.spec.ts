import { Book } from '../../books/domain/book.entity';
import { BookUnavailableError, MaxActiveLoansExceededError, OverdueLoanExistsError } from './loan-domain.errors';
import { LoanEligibilityRules } from './loan-eligibility.rules';
import { Loan } from './loan.entity';

/**
 * These tests instantiate plain `Book` and `Loan` objects directly — no `Test.createTestingModule`,
 * no NestJS application context, no PostgreSQL, not even an HTTP request. This is the payoff of
 * the layering described in the README: the actual business rules run and assert in milliseconds,
 * and a reviewer can trust that borrowing eligibility is entirely captured by this one class.
 */
describe('LoanEligibilityRules (domain)', () => {
  const book = (availableCopies: number) =>
    new Book('book-1', 'Domain-Driven Design', 'Eric Evans', '978-0321125217', 3, availableCopies);

  const activeLoan = (id: string, dueAt: Date) => new Loan(id, 'book-1', 'member-1', new Date(), dueAt, null);

  const returnedLoan = (id: string, dueAt: Date) =>
    new Loan(id, 'book-1', 'member-1', new Date('2020-01-01'), dueAt, new Date('2020-01-10'));

  const future = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const past = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  it('allows borrowing when a copy is available and the member has no active loans', () => {
    expect(() => LoanEligibilityRules.assertCanBorrow(book(1), [])).not.toThrow();
  });

  it('rejects borrowing when availableCopies is 0 (rule 1)', () => {
    expect(() => LoanEligibilityRules.assertCanBorrow(book(0), [])).toThrow(BookUnavailableError);
  });

  it('rejects borrowing when the member already has 3 active loans (rule 2)', () => {
    const threeActiveLoans = [
      activeLoan('loan-1', future()),
      activeLoan('loan-2', future()),
      activeLoan('loan-3', future()),
    ];
    expect(() => LoanEligibilityRules.assertCanBorrow(book(1), threeActiveLoans)).toThrow(
      MaxActiveLoansExceededError,
    );
  });

  it('allows borrowing when the member has only 2 active loans', () => {
    const twoActiveLoans = [activeLoan('loan-1', future()), activeLoan('loan-2', future())];
    expect(() => LoanEligibilityRules.assertCanBorrow(book(1), twoActiveLoans)).not.toThrow();
  });

  it('rejects borrowing when the member has an overdue, unreturned loan (rule 3)', () => {
    const overdue = [activeLoan('loan-1', past())];
    expect(() => LoanEligibilityRules.assertCanBorrow(book(1), overdue)).toThrow(OverdueLoanExistsError);
  });

  it('does not count returned loans toward the active-loan limit or overdue check', () => {
    const returnedButPastDue = [returnedLoan('loan-1', past())];
    expect(() => LoanEligibilityRules.assertCanBorrow(book(1), returnedButPastDue)).not.toThrow();
  });

  it('checks copy availability before the active-loan count', () => {
    // Even with 0 active loans, no copies means no borrow.
    expect(() => LoanEligibilityRules.assertCanBorrow(book(0), [])).toThrow(BookUnavailableError);
  });
});
