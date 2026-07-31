import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IdGeneratorService } from '../common/id-generator.service';
import { ShardManagerService } from '../sharding/shard-manager.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ShardDistributionResponseDto } from './dto/shard-distribution-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRow } from './user.types';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly shardManager: ShardManagerService,
    private readonly usersRepository: UsersRepository,
    private readonly idGenerator: IdGeneratorService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    // Generate the global ID FIRST, then use it to pick a shard. This is
    // what lets IDs stay unique across shards - see IdGeneratorService.
    const id = this.idGenerator.nextId();
    const shardIndex = this.shardManager.resolveShardIndex(id, { region: dto.region });
    const pool = this.shardManager.getPoolForKey(id, { region: dto.region });

    try {
      const row = await this.usersRepository.insert(pool, {
        id,
        email: dto.email,
        displayName: dto.displayName,
        region: dto.region,
      });
      return this.toResponseDto(row, shardIndex);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          `Email "${dto.email}" is already in use on shard ${shardIndex}`,
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<UserResponseDto> {
    const numericId = this.parseId(id);
    const shardIndex = this.resolveShardIndexForLookup(numericId);
    const pool = this.shardManager.getPoolForKey(numericId);

    // Exactly one shard is queried here - never all of them.
    const row = await this.usersRepository.findById(pool, numericId);
    if (!row) {
      throw new NotFoundException(`User ${id} not found on shard ${shardIndex}`);
    }
    return this.toResponseDto(row, shardIndex);
  }

  /**
   * The one legitimate cross-shard operation in this codebase: fan out a
   * COUNT(*) to every shard so a reader can see the distribution is roughly
   * even under the hash strategy. This is a debug/ops endpoint - never call
   * getAllPools() from a normal request path.
   */
  async getShardDistribution(): Promise<ShardDistributionResponseDto> {
    const pools = this.shardManager.getAllPools();
    const counts = await Promise.all(pools.map((pool) => this.usersRepository.count(pool)));

    const shards = counts.map((userCount, shardIndex) => ({ shardIndex, userCount }));
    const totalUsers = counts.reduce((sum, count) => sum + count, 0);

    return { strategy: this.shardManager.strategyName, shards, totalUsers };
  }

  private resolveShardIndexForLookup(numericId: number): number {
    try {
      return this.shardManager.resolveShardIndex(numericId);
    } catch {
      throw new BadRequestException(
        `Cannot resolve a shard for id ${numericId} without extra context under the "` +
          `${this.shardManager.strategyName}" strategy. Geo sharding routes by region, so a ` +
          'lookup-by-id-alone endpoint would need a separate id -> shard directory in production ' +
          '(intentionally out of scope for this demo - see README).',
      );
    }
  }

  private parseId(id: string): number {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId < 0) {
      throw new BadRequestException(`"${id}" is not a valid user id`);
    }
    return numericId;
  }

  private toResponseDto(row: UserRow, shardIndex: number): UserResponseDto {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      region: row.region,
      createdAt: new Date(row.created_at).toISOString(),
      shardIndex,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
    );
  }
}
