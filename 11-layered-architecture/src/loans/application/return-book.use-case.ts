import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BOOK_REPOSITORY, BookRepositoryPort } from '../../books/domain/book-repository.port';
import { LoanAlreadyReturnedError } from '../domain/loan-domain.errors';
import { Loan } from '../domain/loan.entity';
import { LOAN_REPOSITORY, LoanRepositoryPort } from '../domain/loan-repository.port';

/**
 * Application layer. Orchestrates the return flow: load the loan, ask the Domain layer to
 * mark it returned (rule 4), then free up a copy on the book. Again, the decision ("is this
 * loan even returnable right now?") lives in Loan.markReturned(), not here.
 */
@Injectable()
export class ReturnBookUseCase {
  constructor(
    @Inject(LOAN_REPOSITORY) private readonly loanRepository: LoanRepositoryPort,
    @Inject(BOOK_REPOSITORY) private readonly bookRepository: BookRepositoryPort,
  ) {}

  async execute(loanId: string): Promise<Loan> {
    const loan = await this.loanRepository.findById(loanId);
    if (!loan) {
      throw new NotFoundException(`No loan with id ${loanId}.`);
    }

    try {
      loan.markReturned(new Date());
    } catch (error) {
      if (error instanceof LoanAlreadyReturnedError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    const book = await this.bookRepository.findById(loan.bookId);
    if (book) {
      book.returnOneCopy();
      await this.bookRepository.save(book);
    }

    return this.loanRepository.save(loan);
  }
}
