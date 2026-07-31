import { UserRole } from './entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: UserRole[];
}
