export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let level: LogLevel = 'info';

export function setLogLevel(next: LogLevel): void {
  level = next;
}

const order: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function enabled(l: LogLevel): boolean {
  return order[l] >= order[level];
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (enabled('debug')) console.debug('[debug]', ...args);
  },
  info: (...args: unknown[]) => {
    if (enabled('info')) console.info('[info]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (enabled('warn')) console.warn('[warn]', ...args);
  },
  error: (...args: unknown[]) => {
    if (enabled('error')) console.error('[error]', ...args);
  },
};
