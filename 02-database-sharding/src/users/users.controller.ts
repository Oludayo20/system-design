import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { ShardDistributionResponseDto } from './dto/shard-distribution-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a user',
    description:
      'Generates a global Snowflake-style ID first, then routes the record to exactly one shard ' +
      'using the active `SHARDING_STRATEGY` (hash, range, or geo). Only that shard is written.',
  })
  @ApiResponse({ status: 201, description: 'User created on the resolved shard.', type: UserResponseDto })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get('_debug/distribution')
  @ApiOperation({
    summary: 'DEBUG: per-shard row counts',
    description:
      'The **only** endpoint allowed to query every shard (scatter-gather). Use this to verify ' +
      'hash distribution after seeding. Never call this on the production hot path.',
  })
  @ApiResponse({ status: 200, type: ShardDistributionResponseDto })
  getDistribution(): Promise<ShardDistributionResponseDto> {
    return this.usersService.getShardDistribution();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Fetch a user by ID',
    description:
      'Computes `shard(id)` and queries **only** that shard — no scatter-gather. ' +
      'With `SHARDING_STRATEGY=geo`, lookup by id alone is impossible and returns 400.',
  })
  @ApiParam({ name: 'id', description: 'Numeric user ID generated at creation time', example: '1927841923837952' })
  @ApiResponse({ status: 200, description: 'User found on its owning shard.', type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User not found on its resolved shard.' })
  @ApiBadRequestResponse({
    description: 'Geo strategy: cannot resolve shard from id alone (region was the shard key at write time).',
  })
  findById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }
}
