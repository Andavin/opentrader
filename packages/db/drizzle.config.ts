import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/index.ts',
  out: './src/migrations',
  // Path is resolved by the consumer at runtime; this default is for
  // CLI commands like drizzle-kit studio.
  dbCredentials: {
    url: process.env.OPENTRADER_DB_URL ?? './opentrader.db',
  },
  strict: true,
  verbose: true,
});
