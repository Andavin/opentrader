import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(1421),
  HOST: z.string().default('127.0.0.1'),
  OPENTRADER_SIDECAR_TOKEN: z.string().min(8).default('dev-token-change-in-prod'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Filesystem root for Playwright user-data dirs, etc. Created on first use. */
  OPENTRADER_DATA_DIR: z.string().default('./.opentrader-data'),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
