import { ApiProperty } from '@nestjs/swagger';
import { MembershipStatus } from '../../domain/member.entity';

export class MemberResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name!: string;

  @ApiProperty({ example: 'ada@example.com' })
  email!: string;

  @ApiProperty({ enum: MembershipStatus, example: MembershipStatus.ACTIVE })
  membershipStatus!: MembershipStatus;
}
