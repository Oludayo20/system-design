import { Router } from 'express';
import { ExecutionEnvironmentManager } from '../runtime/execution-environment-manager';
import { respond } from './api-gateway';

/**
 * File-drop trigger, simulating an S3 ObjectCreated event notification invoking
 * `resizeProductImage`. There is no real S3 bucket to watch locally, so this endpoint exists
 * purely as an honest stand-in for "S3 invoked Lambda" — in production, an actual S3 event
 * notification would call this same function with the same event shape, no code changes needed.
 */
export function createFileDropRouter(manager: ExecutionEnvironmentManager): Router {
  const router = Router();

  router.post('/_simulate/s3-upload', async (req, res) => {
    const bucket = req.body?.bucket ?? 'oja-product-images';
    const key = req.body?.key;

    if (!key) {
      res.status(400).json({ error: 'key is required (e.g. "product-42/original.jpg")' });
      return;
    }

    const result = await manager.invoke('resizeProductImage', { bucket, key });
    respond(res, result);
  });

  return router;
}
