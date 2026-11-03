// Retries for calls from GitHub's runners to Aliyun and to the stats API, which now and then time out
// (2026-11-01: the aliyun CLI could not connect within 10 seconds and the day's import failed). Only
// for calls that are safe to repeat: reads, and imports that replace their day.

/** `fn()`, tried up to `waits.length + 1` times, waiting `waits[i]` ms before retry i + 1. */
export async function withRetries<T>(
  what: string,
  fn: () => T | Promise<T>,
  waits: readonly number[] = [5_000, 20_000],
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= waits.length) throw e;
      const reason = e instanceof Error ? e.message.split("\n")[0] : String(e);
      console.warn(`${what} failed (${reason}); retrying in ${waits[attempt]! / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, waits[attempt]));
    }
  }
}
