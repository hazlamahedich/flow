export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Provider call timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}
