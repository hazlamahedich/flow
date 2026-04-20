export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 5000, intervalMs = 100 } = options;
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`waitForCondition timed out after ${timeoutMs}ms`);
}
