import { NextFunction, Request, Response } from 'express';

/**
 * Every request through the gateway gets one structured log line with the
 * route it was matched to and how long it took. This is the closest thing
 * this demo has to distributed tracing - in a real system you'd attach a
 * correlation/request ID header here and have every downstream service
 * echo it back into their own logs, so a single customer request can be
 * followed across all four services after the fact.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = Math.random().toString(36).slice(2, 10);
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(
      `[gateway] ${requestId} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`,
    );
  });

  next();
}
