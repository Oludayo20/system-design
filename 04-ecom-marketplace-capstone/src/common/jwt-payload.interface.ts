export interface JwtPayload {
  /** userId - the shard key. Kept minimal on purpose (see AuthService). */
  sub: string;
  email: string;
}
