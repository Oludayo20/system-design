export default () => ({
  port: parseInt(process.env.ORDER_API_PORT ?? '3009', 10),
  database: {
    host: process.env.ORDER_DB_HOST ?? 'localhost',
    port: parseInt(process.env.ORDER_DB_PORT ?? '5432', 10),
    username: process.env.ORDER_DB_USER ?? 'freshcart',
    password: process.env.ORDER_DB_PASSWORD ?? 'freshcart_password',
    name: process.env.ORDER_DB_NAME ?? 'order_db',
    // Demo-only: synchronize keeps the schema in lockstep with the Order entity without a
    // migration step. A real production system would run TypeORM migrations in the deploy
    // pipeline instead and set this to false unconditionally.
    synchronize: true,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://freshcart:freshcart_password@localhost:5672',
  },
});
