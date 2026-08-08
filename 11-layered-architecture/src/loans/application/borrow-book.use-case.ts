import { randomUUID } from 'crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BOOK_REPOSITORY, BookRepositoryPort } from '../../books/domain/book-repository.port';
import { MEMBER_REPOSITORY, MemberRepositoryPort } from '../../members/domain/member-repository.port';
import {
  BookUnavailableError,
  MaxActiveLoansExceededError,
  OverdueLoanExistsError,
} from '../domain/loan-domain.errors';
import { LoanEligibilityRules } from '../domain/loan-eligibility.rules';
import { Loan } from '../domain/loan.entity';
import { LOAN_REPOSITORY, LoanRepositoryPort } from '../domain/loan-repository.port';
import { BorrowBookDto } from '../presentation/dto/borrow-book.dto';

const LOAN_PERIOD_DAYS = 14;

/**
 * Application layer. Orchestrates the borrow flow: fetch the book and member through their
 * repository ports, ask the Domain layer whether borrowing is allowed, and — only if the
 * Domain layer doesn't object — mutate stock and persist a new loan.
 *
 * Note what this class does NOT do: it never checks `availableCopies` or counts active loans
 * itself. Deciding "can this member borrow" is entirely LoanEligibilityRules' job (Domain).
 * This use case only coordinates the steps and translates domain errors into HTTP-shaped ones.
 */
@Injectable()
export class BorrowBookUseCase {
  constructor(
    @Inject(LOAN_REPOSITORY) private readonly loanRepository: LoanRepositoryPort,
    @Inject(BOOK_REPOSITORY) private readonly bookRepository: BookRepositoryPort,
    @Inject(MEMBER_REPOSITORY) private readonly memberRepository: MemberRepositoryPort,
  ) {}

  async execute(dto: BorrowBookDto): Promise<Loan> {
    const book = await this.bookRepository.findById(dto.bookId);
    if (!book) {
      throw new NotFoundException(`No book with id ${dto.bookId}.`);
    }

    const member = await this.memberRepository.findById(dto.memberId);
    if (!member) {
      throw new NotFoundException(`No member with id ${dto.memberId}.`);
    }

    const activeLoans = await this.loanRepository.findActiveByMemberId(dto.memberId);

    // Ask the domain. It throws if any of the 4 business rules is violated.
    try {
      LoanEligibilityRules.assertCanBorrow(book, activeLoans, new Date());
    } catch (error) {
      if (
        error instanceof BookUnavailableError ||
        error instanceof MaxActiveLoansExceededError ||
        error instanceof OverdueLoanExistsError
      ) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    book.borrowOneCopy();
    await this.bookRepository.save(book);

    const borrowedAt = new Date();
    const dueAt = new Date(borrowedAt.getTime() + LOAN_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const loan = new Loan(randomUUID(), book.id, member.id, borrowedAt, dueAt, null);

    return this.loanRepository.save(loan);
  }
}
