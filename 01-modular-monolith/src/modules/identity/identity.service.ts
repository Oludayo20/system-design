import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User, UserRole } from './entities/user.entity';
import { JwtPayload } from './identity.types';

const BCRYPT_SALT_ROUNDS = 10;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    roles: UserRole[];
  };
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        roles: [UserRole.CUSTOMER],
      }),
    );

    this.logger.log(`Registered new user ${user.id} (${user.email})`);
    return this.issueSession(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user);
  }

  private async issueSession(user: User): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email, roles: user.roles };
    const accessToken = await this.jwtService.signAsync(payload);

    // Session record in Redis: lets us support fast "who's logged in" lookups / future
    // token revocation without adding load to Postgres on every authenticated request.
    await this.redisService.setJson(
      `session:${user.id}`,
      { email: user.email },
      SESSION_TTL_SECONDS,
    );

    return {
      accessToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, roles: user.roles },
    };
  }
}
