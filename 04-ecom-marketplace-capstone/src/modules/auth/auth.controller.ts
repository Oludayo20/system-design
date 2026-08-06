import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      '1. Generates `userId` (shard key).\n' +
      '2. Writes User + Wallet (with signup bonus) on the resolved shard.\n' +
      '3. Writes email→shard entry on primary `user_directory`.\n' +
      '4. Issues JWT.\n\n' +
      'If step 3 fails, compensates by deleting the shard row.',
  })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email already registered.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Resolves shard via `user_directory` on primary Postgres, then queries exactly one shard for the user row.',
  })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
