import { env } from './env';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const threshold = LEVELS[env.LOG_LEVEL];

function emit(level: Level, scope: string, msg: string, meta?: object) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const tail = meta ? ' ' + JSON.stringify(meta) : '';
  process.stdout.write(`${ts} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}${tail}\n`);
}

export interface Logger {
  debug(msg: string, meta?: object): void;
  info(msg: string, meta?: object): void;
  warn(msg: string, meta?: object): void;
  error(msg: string, meta?: object): void;
  child(scope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, x) => emit('debug', scope, m, x),
    info: (m, x) => emit('info', scope, m, x),
    warn: (m, x) => emit('warn', scope, m, x),
    error: (m, x) => emit('error', scope, m, x),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}
