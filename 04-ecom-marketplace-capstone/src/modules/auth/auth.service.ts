import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserDirectory } from './entities/user-directory.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ShardRouterService } from '../../sharding/shard-router.service';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { SIGNUP_BONUS_CENTS } from '../wallet/wallet.service';
import { JwtPayload } from '../../common/jwt-payload.interface';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserDirectory, 'primary')
    private readonly directory: Repository<UserDirectory>,
    private readonly shardRouter: ShardRouterService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registration order matters:
   *   1. Generate userId (the shard key itself - nothing to shard-resolve
   *      before this exists).
   *   2. Resolve the shard from that id.
   *   3. Write User + Wallet atomically on that ONE shard.
   *   4. Only then write the primary-DB email->shard directory entry.
   *   5. Only then issue the JWT.
   *
   * Step 4 is a second, independent database write with no distributed
   * transaction tying it to step 3 (Postgres doesn't support 2PC across two
   * separate connections/instances out of the box, and adding an
   * external coordinator is overkill for this demo). If step 4 fails, we
   * compensate by deleting the shard row rather than leaving an orphaned
   * account nobody can log into. A crash between step 3 and step 4
   * completing (e.g. the process dying) is the one gap this doesn't close -
   * production would use a transactional outbox on the shard + a
   * reconciliation job instead of a synchronous compensating delete.
   */
  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; user: Record<string, unknown> }> {
    const existing = await this.directory.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const userId = randomUUID();
    const shardIndex = this.shardRouter.resolveShardIndex(userId);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const shardDataSource = this.shardRouter.getDataSource(shardIndex);

    this.logger.log(`Registering ${dto.email} -> userId=${userId} -> shard=${shardIndex}`);

    await shardDataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        id: userId,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
      });
      await manager.save(User, user);

      const wallet = manager.create(Wallet, {
        userId,
        balanceCents: SIGNUP_BONUS_CENTS,
      });
      await manager.save(Wallet, wallet);
    });

    try {
      await this.directory.insert({ email: dto.email, userId, shardIndex });
    } catch (error) {
      this.logger.error(
        `Directory write failed for ${dto.email} (userId=${userId}) - compensating by removing shard ${shardIndex} rows`,
        error as Error,
      );
      await shardDataSource.transaction(async (manager) => {
        await manager.delete(Wallet, { userId });
        await manager.delete(User, { id: userId });
      });
      throw error;
    }

    const accessToken = await this.issueToken({ sub: userId, email: dto.email });
    return { accessToken, user: { id: userId, email: dto.email, fullName: dto.fullName } };
  }

  /**
   * Login can't compute the shard from anything it's handed (email isn't
   * the shard key, userId is) - it has to ask the directory first. This is
   * the one read in the whole app that goes through the unsharded lookup
   * table instead of straight to a shard.
   */
  async login(dto: LoginDto): Promise<{ accessToken: string; user: Record<string, unknown> }> {
    const entry = await this.directory.findOne({ where: { email: dto.email } });
    if (!entry) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRepo = this.shardRouter.getRepository(User, entry.userId);
    const user = await userRepo.findOne({ where: { id: entry.userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.issueToken({ sub: user.id, email: user.email });
    return { accessToken, user: { id: user.id, email: user.email, fullName: user.fullName } };
  }

  private issueToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
