import express, { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { requestLogger } from './middleware/request-logger';
import { createRateLimiter } from './middleware/rate-limiter';

const PORT = Number(process.env.PORT ?? 3008);
const RATE_LIMIT_CAPACITY = Number(process.env.RATE_LIMIT_CAPACITY ?? 20);
const RATE_LIMIT_REFILL_PER_SEC = Number(process.env.RATE_LIMIT_REFILL_PER_SEC ?? 10);

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL ?? 'http://localhost:4002';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL ?? 'http://localhost:4003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:4004';

const app = express();

// Disabling this means req.ip is the raw socket address rather than a
// spoofable X-Forwarded-For header - fine for this demo where the gateway
// is the first hop. A gateway sitting behind a load balancer in production
// would enable `trust proxy` and rate-limit on the LB-supplied client IP.
app.set('trust proxy', false);

app.use(requestLogger);
app.use(createRateLimiter(RATE_LIMIT_CAPACITY, RATE_LIMIT_REFILL_PER_SEC));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'gateway' });
});

/**
 * Routing table: gateway prefix -> owning service.
 *
 * `changeOrigin: true` rewrites the Host header to the target's; no
 * `pathRewrite` is configured because every downstream controller is
 * mounted at the same prefix the gateway routes on (e.g. auth-service's
 * AuthController is mounted at `/auth`, matching `/auth/*` here) - so the
 * request path passes through unchanged end to end.
 *
 * The Authorization header is NOT inspected or stripped here - it passes
 * straight through to whichever service owns the route, and that service
 * verifies the JWT itself with the shared JWT_SECRET. That is the "auth
 * check pass-through": the gateway's job is to make sure the header
 * survives the hop, not to be the one place auth is enforced.
 */
const routes: Array<{ path: string; target: string }> = [
  { path: '/auth', target: AUTH_SERVICE_URL },
  { path: '/books', target: CATALOG_SERVICE_URL },
  { path: '/orders', target: ORDER_SERVICE_URL },
  { path: '/notifications', target: NOTIFICATION_SERVICE_URL },
];

for (const route of routes) {
  app.use(
    route.path,
    createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      logLevel: 'warn',
      onError: (err, _req, res) => {
        // eslint-disable-next-line no-console
        console.error(`[gateway] proxy error for ${route.path} -> ${route.target}:`, err.message);
        (res as Response).status(502).json({
          statusCode: 502,
          message: `${route.path} is temporarily unavailable`,
        });
      },
    }),
  );
}

app.use((_req: Request, res: Response) => {
  res.status(404).json({ statusCode: 404, message: 'No route matches this path' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('[gateway] unhandled error:', err);
  res.status(500).json({ statusCode: 500, message: 'Internal gateway error' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[gateway] listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(
    `[gateway] routes: /auth -> ${AUTH_SERVICE_URL}, /books -> ${CATALOG_SERVICE_URL}, ` +
      `/orders -> ${ORDER_SERVICE_URL}, /notifications -> ${NOTIFICATION_SERVICE_URL}`,
  );
});
