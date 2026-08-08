import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ApiReadErrors } from '../../shared/swagger/api-error.decorators';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get the current user profile',
    description: 'Resolves the JWT subject straight through UsersService.findById().',
  })
  @ApiResponse({ status: 200, description: 'Current user profile.', type: UserResponseDto })
  @ApiReadErrors({ auth: true })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    const record = await this.usersService.findById(user.userId);
    return {
      id: record.id,
      email: record.email,
      displayName: record.displayName,
      createdAt: record.createdAt,
    };
  }
}
