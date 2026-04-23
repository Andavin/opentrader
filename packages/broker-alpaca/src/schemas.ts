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
  bars: z
    .array(barSchema)
    .nullable()
    .default([])
    .transform((v) => v ?? []),
  symbol: z.string(),
  next_page_token: z.string().nullable().optional(),
});

export type AlpacaBar = z.infer<typeof barSchema>;

// ---- snapshot schema ----

const dailyBarSchema = z.object({
  t: z.string(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
});

export const stockSnapshotSchema = z.object({
  symbol: z.string().optional(),
  latestTrade: z.object({ p: z.number(), s: z.number().optional(), t: z.string() }).optional(),
  latestQuote: z.object({ bp: z.number(), ap: z.number(), t: z.string() }).optional(),
  minuteBar: dailyBarSchema.optional(),
  dailyBar: dailyBarSchema.optional(),
  prevDailyBar: dailyBarSchema.optional(),
});

export type AlpacaStockSnapshot = z.infer<typeof stockSnapshotSchema>;

// ---- options schemas ----

export const optionContractSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string().optional(),
  status: z.string().optional(),
  tradable: z.boolean().optional(),
  expiration_date: z.string(),
  root_symbol: z.string(),
  underlying_symbol: z.string(),
  underlying_asset_id: z.string().optional(),
  type: z.enum(['call', 'put']),
  style: z.enum(['american', 'european']).optional(),
  strike_price: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  size: z.union([z.string(), z.number()]).optional(),
  open_interest: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v))),
  open_interest_date: z.string().optional(),
  close_price: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v))),
  close_price_date: z.string().optional(),
});

export type AlpacaOptionContract = z.infer<typeof optionContractSchema>;

export const optionContractsResponseSchema = z.object({
  option_contracts: z.array(optionContractSchema).default([]),
  next_page_token: z.string().nullable().optional(),
});

export const optionSnapshotSchema = z.object({
  latestQuote: z
    .object({
      bp: z.number(),
      ap: z.number(),
      bs: z.number().optional(),
      as: z.number().optional(),
      t: z.string(),
    })
    .optional(),
  latestTrade: z.object({ p: z.number(), s: z.number().optional(), t: z.string() }).optional(),
  greeks: z
    .object({
      delta: z.number().optional(),
      gamma: z.number().optional(),
      theta: z.number().optional(),
      vega: z.number().optional(),
      rho: z.number().optional(),
    })
    .optional(),
  impliedVolatility: z.number().optional(),
});

export type AlpacaOptionSnapshot = z.infer<typeof optionSnapshotSchema>;

export const optionSnapshotsResponseSchema = z.object({
  snapshots: z.record(z.string(), optionSnapshotSchema).default({}),
  next_page_token: z.string().nullable().optional(),
});
