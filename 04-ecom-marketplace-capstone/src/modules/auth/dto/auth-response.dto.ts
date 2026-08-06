import { ApiProperty } from '@nestjs/swagger';

class AuthUserDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'ada@oja.dev' })
  email!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  fullName!: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT bearer token for protected routes.' })
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
