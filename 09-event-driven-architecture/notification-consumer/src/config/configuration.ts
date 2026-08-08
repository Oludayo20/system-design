export default () => ({
  port: parseInt(process.env.NOTIFICATION_CONSUMER_PORT ?? '4102', 10),
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://freshcart:freshcart_password@localhost:5672',
  },
});
