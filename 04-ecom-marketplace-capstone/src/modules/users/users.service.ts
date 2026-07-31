import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ShardRouterService } from '../../sharding/shard-router.service';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Every method here resolves the shard from userId FIRST and then issues a
 * single query against that one shard - never a scatter-gather across all
 * three. That's the whole point of sharding by userId: a request that
 * already knows the userId (which every authenticated request does, via
 * the JWT `sub` claim) never needs to ask more than one database.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly shardRouter: ShardRouterService) {}

  async findById(userId: string): Promise<User> {
    const shardIndex = this.shardRouter.resolveShardIndex(userId);
    this.logger.debug(`Resolving user ${userId} -> shard ${shardIndex}`);
    const repo = this.shardRouter.getRepository(User, userId);
    const user = await repo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<User> {
    const repo = this.shardRouter.getRepository(User, userId);
    const user = await repo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    Object.assign(user, dto);
    return repo.save(user);
  }
}
