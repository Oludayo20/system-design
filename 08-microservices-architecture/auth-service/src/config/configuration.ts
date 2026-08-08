export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 4001),
  jwtSecret: process.env.JWT_SECRET ?? 'change_me_in_production_please',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  db: {
    host: process.env.AUTH_DB_HOST ?? 'localhost',
    port: Number(process.env.AUTH_DB_PORT ?? 5432),
    username: process.env.AUTH_DB_USER ?? 'bookhive',
    password: process.env.AUTH_DB_PASSWORD ?? 'bookhive_dev_password',
    database: process.env.AUTH_DB_NAME ?? 'auth_db',
  },
});
