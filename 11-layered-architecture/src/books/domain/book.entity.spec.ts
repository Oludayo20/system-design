import { Book } from './book.entity';

/**
 * Pure domain test: no NestJS TestingModule, no database, no HTTP. Just `new Book(...)`.
 * This is the payoff of the layering — business rules run and assert in milliseconds.
 */
describe('Book (domain)', () => {
  it('reports available copies correctly', () => {
    const book = new Book('b1', 'Clean Architecture', 'R. Martin', '111', 3, 1);
    expect(book.hasAvailableCopies()).toBe(true);
  });

  it('reports no available copies when availableCopies is 0', () => {
    const book = new Book('b1', 'Clean Architecture', 'R. Martin', '111', 3, 0);
    expect(book.hasAvailableCopies()).toBe(false);
  });

  it('decrements availableCopies when borrowed', () => {
    const book = new Book('b1', 'Clean Architecture', 'R. Martin', '111', 3, 2);
    book.borrowOneCopy();
    expect(book.availableCopies).toBe(1);
  });

  it('refuses to borrow when no copies are available', () => {
    const book = new Book('b1', 'Clean Architecture', 'R. Martin', '111', 3, 0);
    expect(() => book.borrowOneCopy()).toThrow(/no copies available/i);
  });

  it('increments availableCopies when returned', () => {
    const book = new Book('b1', 'Clean Architecture', 'R. Martin', '111', 3, 1);
    book.returnOneCopy();
    expect(book.availableCopies).toBe(2);
  });

  it('refuses to return more copies than totalCopies', () => {
    const book = new Book('b1', 'Clean Architecture', 'R. Martin', '111', 3, 3);
    expect(() => book.returnOneCopy()).toThrow(/already accounted for/i);
  });
});
