/** Domain layer. Plain TypeScript only — no NestJS, no TypeORM. */
export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class Member {
  constructor(
    public readonly id: string,
    public name: string,
    public email: string,
    public membershipStatus: MembershipStatus,
  ) {}

  isActive(): boolean {
    return this.membershipStatus === MembershipStatus.ACTIVE;
  }
}
