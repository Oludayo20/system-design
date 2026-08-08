export default () => ({
  port: parseInt(process.env.ANALYTICS_CONSUMER_PORT ?? '4103', 10),
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://freshcart:freshcart_password@localhost:5672',
  },
});
