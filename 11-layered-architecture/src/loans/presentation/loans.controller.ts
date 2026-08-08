import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BorrowBookUseCase } from '../application/borrow-book.use-case';
import { ListMemberLoansUseCase } from '../application/list-member-loans.use-case';
import { ReturnBookUseCase } from '../application/return-book.use-case';
import { Loan } from '../domain/loan.entity';
import { BorrowBookDto } from './dto/borrow-book.dto';
import { LoanResponseDto } from './dto/loan-response.dto';

/**
 * Presentation layer. No base @Controller() prefix so the two "members"-rooted and
 * "loans"-rooted routes required by this API can both live on one controller class, matching
 * the endpoint list in the README exactly. Every method below only calls into the Application
 * layer's use cases — it never reaches into loans/domain or loans/infrastructure directly.
 */
@ApiTags('loans')
@Controller()
export class LoansController {
  constructor(
    private readonly borrowBookUseCase: BorrowBookUseCase,
    private readonly returnBookUseCase: ReturnBookUseCase,
    private readonly listMemberLoansUseCase: ListMemberLoansUseCase,
  ) {}

  @Post('loans')
  @ApiOperation({
    summary: 'Borrow a book',
    description:
      'Applies all 4 borrowing business rules (availability, 3-loan cap, no outstanding overdue ' +
      'loans) via the Domain layer before creating the loan.',
  })
  @ApiResponse({ status: 201, type: LoanResponseDto })
  @ApiResponse({ status: 409, description: 'A borrowing rule was violated.' })
  @ApiResponse({ status: 404, description: 'Book or member not found.' })
  borrow(@Body() dto: BorrowBookDto): Promise<Loan> {
    return this.borrowBookUseCase.execute(dto);
  }

  @Post('loans/:id/return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return a borrowed book' })
  @ApiResponse({ status: 200, type: LoanResponseDto })
  @ApiResponse({ status: 409, description: 'Loan was already returned.' })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  return(@Param('id') id: string): Promise<Loan> {
    return this.returnBookUseCase.execute(id);
  }

  @Get('members/:id/loans')
  @ApiOperation({ summary: "List a member's loans (active and historical)" })
  @ApiResponse({ status: 200, type: [LoanResponseDto] })
  @ApiResponse({ status: 404, description: 'No member with this id.' })
  listForMember(@Param('id') id: string): Promise<Loan[]> {
    return this.listMemberLoansUseCase.execute(id);
  }
}
