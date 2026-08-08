/**
 * Domain errors. Plain `Error` subclasses — no NestJS `HttpException` here. The Application
 * layer (loans/application/*.use-case.ts) catches these and translates them into HTTP-shaped
 * exceptions; the Domain layer itself has no idea what HTTP is.
 */
export class BookUnavailableError extends Error {}
export class MaxActiveLoansExceededError extends Error {}
export class OverdueLoanExistsError extends Error {}
export class LoanAlreadyReturnedError extends Error {}
