import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateMemberUseCase } from '../application/create-member.use-case';
import { GetMemberUseCase } from '../application/get-member.use-case';
import { Member } from '../domain/member.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { MemberResponseDto } from './dto/member-response.dto';

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(
    private readonly createMemberUseCase: CreateMemberUseCase,
    private readonly getMemberUseCase: GetMemberUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a new library member' })
  @ApiResponse({ status: 201, type: MemberResponseDto })
  create(@Body() dto: CreateMemberDto): Promise<Member> {
    return this.createMemberUseCase.execute(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a member by id' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  @ApiResponse({ status: 404, description: 'No member with this id.' })
  get(@Param('id') id: string): Promise<Member> {
    return this.getMemberUseCase.execute(id);
  }
}
