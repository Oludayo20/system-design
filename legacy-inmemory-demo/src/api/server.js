import express from 'express';

/**
 * doc.md: "API - Everything begins here ... The API decides which module
 * should handle the request." This file has no business logic of its own -
 * it just routes to the right module, exactly like the doc's
 * `POST /orders -> Ordering Module`, `GET /products -> Catalog Module`.
 */
export function createServer({ identity, catalog, basket, ordering }) {
  const app = express();
  app.use(express.json());

  app.post('/auth/register', async (req, res, next) => {
    try {
      const user = await identity.register(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/login', async (req, res, next) => {
    try {
      const result = await identity.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/products', (req, res) => {
    res.json(catalog.listProducts());
  });

  app.get('/products/:id', async (req, res, next) => {
    try {
      const product = await catalog.getProduct(Number(req.params.id));
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (err) {
      next(err);
    }
  });

  app.post('/basket/:userId/items', async (req, res, next) => {
    try {
      const cart = await basket.addToCart(
        Number(req.params.userId),
        Number(req.body.productId),
        req.body.qty ?? 1
      );
      res.status(201).json(cart);
    } catch (err) {
      next(err);
    }
  });

  app.get('/basket/:userId', async (req, res, next) => {
    try {
      res.json(await basket.getCart(Number(req.params.userId)));
    } catch (err) {
      next(err);
    }
  });

  app.post('/orders/:userId', async (req, res, next) => {
    try {
      const order = await ordering.placeOrder(Number(req.params.userId));
      res.status(201).json({ success: true, order });
    } catch (err) {
      next(err);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ error: err.message });
  });

  return app;
}
