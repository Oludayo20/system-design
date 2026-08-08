import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiServerError,
  ApiUnauthorizedError,
  ApiValidationErrors,
} from '../../shared/swagger/api-error.decorators';
import { AuthResult, AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new BlogStack account',
    description: 'Creates a user, hashes the password with bcrypt, and returns a JWT access token.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Account created.', type: AuthResponseDto })
  @ApiValidationErrors()
  @ApiConflictError('An account with this email already exists.')
  @ApiServerError()
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email and password',
    description: 'Validates credentials and returns a JWT access token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful.', type: AuthResponseDto })
  @ApiValidationErrors()
  @ApiUnauthorizedError('Invalid email or password.')
  @ApiServerError()
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }
}
