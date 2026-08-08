import { Member } from './member.entity';

export interface MemberRepositoryPort {
  save(member: Member): Promise<Member>;
  findById(id: string): Promise<Member | null>;
}

/** DI token — lets Application-layer use-cases `@Inject` the port without knowing TypeORM exists. */
export const MEMBER_REPOSITORY = Symbol('MEMBER_REPOSITORY');
