import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Loan } from '../domain/loan.entity';
import { LoanRepositoryPort } from '../domain/loan-repository.port';
import { LoanOrmEntity } from './loan.orm-entity';

@Injectable()
export class TypeOrmLoanRepository implements LoanRepositoryPort {
  constructor(
    @InjectRepository(LoanOrmEntity)
    private readonly repository: Repository<LoanOrmEntity>,
  ) {}

  async save(loan: Loan): Promise<Loan> {
    const saved = await this.repository.save(this.toOrmEntity(loan));
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<Loan | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByMemberId(memberId: string): Promise<Loan[]> {
    const rows = await this.repository.find({ where: { memberId }, order: { borrowedAt: 'DESC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async findActiveByMemberId(memberId: string): Promise<Loan[]> {
    const rows = await this.repository.find({ where: { memberId, returnedAt: IsNull() } });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: LoanOrmEntity): Loan {
    return new Loan(row.id, row.bookId, row.memberId, row.borrowedAt, row.dueAt, row.returnedAt);
  }

  private toOrmEntity(loan: Loan): LoanOrmEntity {
    const row = new LoanOrmEntity();
    row.id = loan.id;
    row.bookId = loan.bookId;
    row.memberId = loan.memberId;
    row.borrowedAt = loan.borrowedAt;
    row.dueAt = loan.dueAt;
    row.returnedAt = loan.returnedAt;
    return row;
  }
}
