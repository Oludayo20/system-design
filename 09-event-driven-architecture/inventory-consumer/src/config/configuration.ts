export default () => ({
  port: parseInt(process.env.INVENTORY_CONSUMER_PORT ?? '4101', 10),
  database: {
    host: process.env.INVENTORY_DB_HOST ?? 'localhost',
    port: parseInt(process.env.INVENTORY_DB_PORT ?? '5433', 10),
    username: process.env.INVENTORY_DB_USER ?? 'freshcart',
    password: process.env.INVENTORY_DB_PASSWORD ?? 'freshcart_password',
    name: process.env.INVENTORY_DB_NAME ?? 'inventory_db',
    synchronize: true,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://freshcart:freshcart_password@localhost:5672',
  },
});
