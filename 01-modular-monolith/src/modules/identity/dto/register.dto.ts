import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'S3curePassword!' })
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  fullName: string;
}
