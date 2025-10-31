type RetryFn<T> = (attempt: number) => Promise<T>;

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  onError?: (error: unknown, attempt: number) => void;
}

export const retryWithBackoff = async <T>(
  fn: RetryFn<T>,
  {
    retries = 3,
    baseDelayMs = 400,
    maxDelayMs = 4000,
    factor = 2,
    onError,
  }: RetryOptions = {},
): Promise<T> => {
  let delay = baseDelayMs;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      const nextAttempt = attempt + 1;
      onError?.(error, nextAttempt);

      if (nextAttempt > retries) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delay, maxDelayMs)),
      );

      delay = Math.min(delay * factor, maxDelayMs);
    }
  }

  throw new Error("retryWithBackoff reached an unexpected state");
};
