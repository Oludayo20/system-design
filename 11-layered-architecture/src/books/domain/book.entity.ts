/**
 * Domain layer. Plain TypeScript only — no NestJS, no TypeORM, no HTTP concepts.
 * This class must be importable and testable with nothing more than `tsc`/`ts-jest`.
 */
export class Book {
  constructor(
    public readonly id: string,
    public title: string,
    public author: string,
    public isbn: string,
    public totalCopies: number,
    public availableCopies: number,
  ) {}

  /** Business rule #1 (part of it): a book can only be borrowed if a copy is available. */
  hasAvailableCopies(): boolean {
    return this.availableCopies > 0;
  }

  /** Decrements available stock. Callers are expected to have already checked eligibility. */
  borrowOneCopy(): void {
    if (!this.hasAvailableCopies()) {
      throw new Error(`Cannot borrow "${this.title}": no copies available.`);
    }
    this.availableCopies -= 1;
  }

  /** Business rule #4: returning a book increments availableCopies. */
  returnOneCopy(): void {
    if (this.availableCopies >= this.totalCopies) {
      throw new Error(`Cannot return "${this.title}": all copies are already accounted for.`);
    }
    this.availableCopies += 1;
  }
}
