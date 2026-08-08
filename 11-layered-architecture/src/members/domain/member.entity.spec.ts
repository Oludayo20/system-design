import { Member, MembershipStatus } from './member.entity';

describe('Member (domain)', () => {
  it('is active when membershipStatus is ACTIVE', () => {
    const member = new Member('m1', 'Ada Lovelace', 'ada@example.com', MembershipStatus.ACTIVE);
    expect(member.isActive()).toBe(true);
  });

  it('is not active when membershipStatus is SUSPENDED', () => {
    const member = new Member('m1', 'Ada Lovelace', 'ada@example.com', MembershipStatus.SUSPENDED);
    expect(member.isActive()).toBe(false);
  });
});
