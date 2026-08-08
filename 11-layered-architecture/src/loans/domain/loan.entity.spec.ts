import { LoanAlreadyReturnedError } from './loan-domain.errors';
import { Loan } from './loan.entity';

describe('Loan (domain)', () => {
  it('is active until returned', () => {
    const loan = new Loan('l1', 'b1', 'm1', new Date(), new Date(Date.now() + 1000), null);
    expect(loan.isActive()).toBe(true);
  });

  it('is overdue when unreturned and past its due date', () => {
    const loan = new Loan('l1', 'b1', 'm1', new Date('2024-01-01'), new Date('2024-01-15'), null);
    expect(loan.isOverdue(new Date('2024-02-01'))).toBe(true);
  });

  it('is not overdue when returned, even if past the original due date', () => {
    const loan = new Loan(
      'l1',
      'b1',
      'm1',
      new Date('2024-01-01'),
      new Date('2024-01-15'),
      new Date('2024-01-10'),
    );
    expect(loan.isOverdue(new Date('2024-02-01'))).toBe(false);
  });

  it('sets returnedAt when marked returned', () => {
    const loan = new Loan('l1', 'b1', 'm1', new Date(), new Date(Date.now() + 1000), null);
    const now = new Date();
    loan.markReturned(now);
    expect(loan.returnedAt).toBe(now);
    expect(loan.isActive()).toBe(false);
  });

  it('refuses to return a loan that was already returned', () => {
    const loan = new Loan('l1', 'b1', 'm1', new Date(), new Date(Date.now() + 1000), new Date());
    expect(() => loan.markReturned()).toThrow(LoanAlreadyReturnedError);
  });
});
