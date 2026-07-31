export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'async_demo',
    password: process.env.POSTGRES_PASSWORD ?? 'async_demo_password',
    name: process.env.POSTGRES_DB ?? 'async_demo',
    // Demo-only: synchronize keeps the schema in lockstep with the Ride entity without a
    // migration step, including inside the "production" NODE_ENV used by docker-compose here.
    // A real production system would run TypeORM migrations in the deploy pipeline instead
    // and set this to false unconditionally.
    synchronize: true,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://async_demo:async_demo_password@localhost:5672',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  },
  email: {
    failureRate: parseFloat(process.env.EMAIL_FAILURE_RATE ?? '0.3'),
  },
});
