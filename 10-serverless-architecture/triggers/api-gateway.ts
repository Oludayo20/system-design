import { Response, Router } from 'express';
import {
  ExecutionEnvironmentManager,
  InvokeResult,
} from '../runtime/execution-environment-manager';

/**
 * HTTP trigger, named `apiGateway` to make the mapping to real AWS explicit: in production this
 * front door would be Amazon API Gateway routing `POST /orders` to a Lambda; here it's an Express
 * router calling into the SAME execution-environment manager every other trigger uses.
 */
export function createApiGatewayRouter(manager: ExecutionEnvironmentManager): Router {
  const router = Router();

  router.post('/orders', async (req, res) => {
    const event = { body: JSON.stringify(req.body ?? {}) };
    const result = await manager.invoke('createOrder', event);
    respond(res, result);
  });

  return router;
}

/**
 * Shared response mapping used by every HTTP-facing trigger adapter: surfaces cold/warm and
 * billing info in BOTH headers and the JSON body so it's provable with a plain curl -i.
 */
export function respond(res: Response, result: InvokeResult): void {
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(result.response.body);
  } catch {
    parsedBody = { raw: result.response.body };
  }

  res.set('X-Cold-Start', String(result.cold));
  res.set('X-Billed-Duration-Ms', String(result.billedMs));
  res.set('X-Function-Name', result.functionName);
  res.set('X-Request-Id', result.requestId);

  res.status(result.response.statusCode).json({
    ...(typeof parsedBody === 'object' && parsedBody !== null ? parsedBody : { data: parsedBody }),
    runtime: {
      functionName: result.functionName,
      requestId: result.requestId,
      cold: result.cold,
      durationMs: result.durationMs,
      billedMs: result.billedMs,
      instanceId: result.instanceId,
    },
  });
}
