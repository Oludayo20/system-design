import { FunctionContext, FunctionResponse } from '../runtime/types';

/**
 * Simulates an S3 ObjectCreated -> Lambda trigger: takes `{ bucket, key }` (the shape S3 event
 * notifications actually carry, simplified) and "resizes" the uploaded object. There is no real
 * S3 or image library here — see the file-drop trigger adapter for how this gets invoked without
 * a real S3 bucket.
 */
// eslint-disable-next-line no-console
console.log('[resizeProductImage] cold init: image pipeline handler module loaded');

interface S3UploadEvent {
  bucket: string;
  key: string;
}

export async function handler(
  event: S3UploadEvent,
  _context: FunctionContext,
): Promise<FunctionResponse> {
  // Simulated CPU-bound resize work (thumbnail + medium variants).
  await sleep(150 + Math.random() * 150);

  const outputKey = event.key.replace(/(\.[^./]+)$/, '-resized$1');

  const result = {
    bucket: event.bucket,
    inputKey: event.key,
    outputKey,
    variantsGenerated: ['thumbnail', 'medium'],
  };

  return { statusCode: 200, body: JSON.stringify(result) };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
