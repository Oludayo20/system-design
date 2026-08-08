import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberRepositoryPort } from '../domain/member-repository.port';
import { Member } from '../domain/member.entity';
import { MemberOrmEntity } from './member.orm-entity';

@Injectable()
export class TypeOrmMemberRepository implements MemberRepositoryPort {
  constructor(
    @InjectRepository(MemberOrmEntity)
    private readonly repository: Repository<MemberOrmEntity>,
  ) {}

  async save(member: Member): Promise<Member> {
    const saved = await this.repository.save(this.toOrmEntity(member));
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<Member | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: MemberOrmEntity): Member {
    return new Member(row.id, row.name, row.email, row.membershipStatus);
  }

  private toOrmEntity(member: Member): MemberOrmEntity {
    const row = new MemberOrmEntity();
    row.id = member.id;
    row.name = member.name;
    row.email = member.email;
    row.membershipStatus = member.membershipStatus;
    return row;
  }
}
