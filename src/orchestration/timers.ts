export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function yieldToEventLoop(): Promise<void> {
  await sleep(0);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<{ ok: true; value: T } | { ok: false }>
{
  let timer: number | undefined;
  const timeout = new Promise<{ ok: false }>((resolve) => {
    timer = globalThis.setTimeout(() => resolve({ ok: false }), ms) as unknown as number;
  });

  const res = (await Promise.race([
    promise.then((value) => ({ ok: true as const, value })),
    timeout,
  ])) as { ok: true; value: T } | { ok: false };

  if (timer !== undefined) globalThis.clearTimeout(timer as unknown as number);
  return res;
}

export const timers = {
  sleep,
  yield: yieldToEventLoop,
};
