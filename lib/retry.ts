/**
 * Retries an async operation a few times with a short backoff. Used for
 * "this really should succeed, and if it doesn't the user loses data
 * silently" operations — e.g. saving the assistant's reply after a stream
 * finishes, where there's no request/response cycle left to surface a
 * failure through.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 200 }: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastError;
}
