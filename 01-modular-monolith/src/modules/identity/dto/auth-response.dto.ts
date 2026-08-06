import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class AuthUserDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName!: string;

  @ApiProperty({ enum: UserRole, isArray: true, example: [UserRole.CUSTOMER] })
  roles!: UserRole[];
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT bearer token. Pass as `Authorization: Bearer <token>` on protected routes.',
  })
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
