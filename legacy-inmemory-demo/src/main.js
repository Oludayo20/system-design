import { bootstrap } from './bootstrap.js';
import { createServer } from './api/server.js';

const PORT = process.env.PORT || 3000;

const app = await bootstrap();
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`\nModular monolith demo listening on http://localhost:${PORT}`);
  console.log('Try:');
  console.log(`  curl http://localhost:${PORT}/products`);
  console.log(`  curl -X POST http://localhost:${PORT}/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"secret"}'`);
  console.log(`  curl -X POST http://localhost:${PORT}/basket/1/items -H "Content-Type: application/json" -d '{"productId":1}'`);
  console.log(`  curl -X POST http://localhost:${PORT}/orders/1`);
});
