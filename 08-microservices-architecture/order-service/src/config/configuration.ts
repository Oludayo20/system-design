export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  catalogServiceUrl: string;
  notificationServiceUrl: string;
  notificationTimeoutMs: number;
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

export default (): AppConfig => ({
  port: Number(process.env.PORT ?? 4003),
  jwtSecret: process.env.JWT_SECRET ?? 'change_me_in_production_please',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  // Network addresses, not database credentials - this is the ONLY way
  // order-service reaches catalog data or triggers a notification.
  catalogServiceUrl: process.env.CATALOG_SERVICE_URL ?? 'http://localhost:4002',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:4004',
  notificationTimeoutMs: Number(process.env.NOTIFICATION_TIMEOUT_MS ?? 2000),
  db: {
    host: process.env.ORDER_DB_HOST ?? 'localhost',
    port: Number(process.env.ORDER_DB_PORT ?? 5432),
    username: process.env.ORDER_DB_USER ?? 'bookhive',
    password: process.env.ORDER_DB_PASSWORD ?? 'bookhive_dev_password',
    database: process.env.ORDER_DB_NAME ?? 'order_db',
  },
});
