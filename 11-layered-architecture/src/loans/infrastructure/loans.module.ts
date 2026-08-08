import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from '../../books/infrastructure/books.module';
import { MembersModule } from '../../members/infrastructure/members.module';
import { BorrowBookUseCase } from '../application/borrow-book.use-case';
import { ListMemberLoansUseCase } from '../application/list-member-loans.use-case';
import { ReturnBookUseCase } from '../application/return-book.use-case';
import { LOAN_REPOSITORY } from '../domain/loan-repository.port';
import { LoansController } from '../presentation/loans.controller';
import { LoanOrmEntity } from './loan.orm-entity';
import { TypeOrmLoanRepository } from './typeorm-loan.repository';

/**
 * LoansModule imports BooksModule and MembersModule to get access to their exported
 * BOOK_REPOSITORY / MEMBER_REPOSITORY DI tokens — the borrow/return use cases need both a book
 * and a member to run the eligibility check. Nothing here reaches into books/domain or
 * members/domain directly except through their published ports.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LoanOrmEntity]), BooksModule, MembersModule],
  controllers: [LoansController],
  providers: [
    BorrowBookUseCase,
    ReturnBookUseCase,
    ListMemberLoansUseCase,
    { provide: LOAN_REPOSITORY, useClass: TypeOrmLoanRepository },
  ],
})
export class LoansModule {}
