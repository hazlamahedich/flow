export function createDelayedHandler<T>(ms: number, response: T): () => Promise<T> {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => resolve(response), ms);
    });
}

export async function waitForOptimisticState(
  predicate: () => boolean,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for optimistic state');
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

export function simulateRaceCondition<T>(
  handlers: Array<() => Promise<T>>,
): Promise<PromiseSettledResult<Awaited<T>>[]> {
  return Promise.allSettled(handlers.map((h) => h()));
}
