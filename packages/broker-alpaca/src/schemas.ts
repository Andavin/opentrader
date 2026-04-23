/**
 * Zod schemas for the Alpaca v2 REST API responses we consume.
 * Kept narrow on purpose — every field we use is listed here so wire-
 * format drift is caught at parse time, not deep inside a UI render.
 */
import { z } from 'zod';

const numericString = z.union([z.string(), z.number()]).transform((v) => Number(v));

export const accountSchema = z.object({
  id: z.string(),
  account_number: z.string(),
  status: z.string(),
  currency: z.string(),
  cash: numericString,
  portfolio_value: numericString,
  buying_power: numericString,
  options_buying_power: numericString.optional(),
  equity: numericString,
  last_equity: numericString,
  daytrade_count: z.number().optional(),
  pattern_day_trader: z.boolean().optional(),
  trading_blocked: z.boolean(),
  account_blocked: z.boolean(),
});

export type AlpacaAccount = z.infer<typeof accountSchema>;

export const positionSchema = z.object({
  symbol: z.string(),
  asset_class: z.string(),
  qty: numericString,
  avg_entry_price: numericString,
  current_price: numericString,
  market_value: numericString,
  cost_basis: numericString,
  unrealized_pl: numericString,
  unrealized_plpc: numericString,
  unrealized_intraday_pl: numericString,
  unrealized_intraday_plpc: numericString,
  side: z.string(),
});

export type AlpacaPosition = z.infer<typeof positionSchema>;

export const orderSchema = z.object({
  id: z.string(),
  client_order_id: z.string().optional().nullable(),
  symbol: z.string(),
  asset_class: z.string(),
  qty: numericString,
  filled_qty: numericString,
  filled_avg_price: numericString.nullable().optional(),
  limit_price: numericString.nullable().optional(),
  stop_price: numericString.nullable().optional(),
  side: z.enum(['buy', 'sell']),
  order_type: z.string(),
  time_in_force: z.string(),
  status: z.string(),
  extended_hours: z.boolean(),
  submitted_at: z.string(),
  updated_at: z.string(),
});

export type AlpacaOrder = z.infer<typeof orderSchema>;

export const latestQuoteSchema = z.object({
  symbol: z.string(),
  quote: z.object({
    t: z.string(),
    bp: z.number(),
    bs: z.number().optional(),
    ap: z.number(),
    as: z.number().optional(),
  }),
});

export const latestTradeSchema = z.object({
  symbol: z.string(),
  trade: z.object({
    t: z.string(),
    p: z.number(),
    s: z.number().optional(),
  }),
});

export const barSchema = z.object({
  t: z.string(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
});

export const barsResponseSchema = z.object({
  bars: z.array(barSchema).nullable().default([]),
  symbol: z.string(),
  next_page_token: z.string().nullable().optional(),
});

export type AlpacaBar = z.infer<typeof barSchema>;
