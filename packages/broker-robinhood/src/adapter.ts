import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  Account,
  AccountBalances,
  AccountRef,
  Broker,
  BrokerCapabilities,
  BrokerConnectOptions,
  BrokerDeps,
  Candle,
  CandleInterval,
  Order,
  OrderRequest,
  Position,
  Quote,
} from '@opentrader/broker-core';
import {
  type Browser,
  type BrowserContext,
  type Page,
  chromium,
} from 'playwright';

import { extractSessionFromCookies, type RobinhoodSession } from './session';

const ROBINHOOD_CAPS: BrokerCapabilities = {
  options: true,
  multiLegOptions: true,
  extendedHours: true,
  level2: true, // Robinhood Gold (Nasdaq TotalView)
  paperTrading: false, // RH has no native paper account
  bracketOrders: false, // not exposed via the unofficial API
  streamingQuotes: false, // RH streams via Pusher; not wired yet
  interactiveLogin: true,
};

/**
 * SCAFFOLDING — Phases 4 lays down the lifecycle, login flow, and
 * capability surface. Live endpoint coverage is intentionally narrow
 * (getQuote only, against `/api/quotes/`) so we have a working probe
 * to validate the auth path against the real site. Other Broker
 * methods throw "not yet implemented" with phase-appropriate messages.
 *
 * **Why scaffolding over a flagship implementation?** Robinhood
 * actively rotates their unofficial endpoints and runs bot detection;
 * the right way to harden this adapter is iteratively against a real
 * account, which the build sandbox cannot reach. Patterns here mirror
 * jmfernandes/robin_stocks for the auth dance.
 */
class RobinhoodBroker implements Broker {
  readonly id = 'robinhood' as const;
  readonly label = 'Robinhood';
  readonly capabilities = ROBINHOOD_CAPS;

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private session: RobinhoodSession | null = null;

  constructor(private readonly deps: BrokerDeps) {}

  isConnected(): boolean {
    return this.session !== null && this.context !== null;
  }

  async connect(opts?: BrokerConnectOptions): Promise<void> {
    const userDataDir = resolve(this.deps.dataDir, 'profiles', 'robinhood');
    mkdirSync(userDataDir, { recursive: true });

    const force = opts?.forceLogin === true;

    // Reuse persistent context — cookies survive across launches so the
    // device-approval dance only happens on first connect.
    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1024, height: 768 },
    });

    if (force) {
      // Wipe stored cookies so the user is re-prompted.
      await this.context.clearCookies();
    }

    const page = await this.context.newPage();
    await page.goto('https://robinhood.com/login', { waitUntil: 'domcontentloaded' });

    // Wait until the session lands on a logged-in page (URL contains
    // /account, /portfolio, etc.) OR until the user explicitly closes
    // the page. 5-min ceiling so we don't hang forever in dev.
    await this.waitForLogin(page, 5 * 60 * 1000);

    const cookies = await this.context.cookies('https://robinhood.com');
    const found = extractSessionFromCookies(cookies);
    if (!found.accessToken) {
      this.deps.log('warn', 'robinhood login completed but no auth token captured', {
        cookieCount: cookies.length,
      });
      throw new Error('robinhood: failed to capture session token after login');
    }
    this.session = {
      accessToken: found.accessToken,
      deviceToken: found.deviceToken,
      expiresAt: found.expiresAt,
    };
    await page.close();
    this.deps.log('info', 'robinhood connected', { hasDeviceToken: !!this.session.deviceToken });
  }

  async disconnect(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
    this.session = null;
  }

  private async waitForLogin(page: Page, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const url = page.url();
      if (
        url.includes('/account') ||
        url.includes('/portfolio') ||
        url.includes('/dashboard')
      ) {
        return;
      }
      // If the user closed the tab we'll throw on the next interaction.
      if (page.isClosed()) throw new Error('login window closed before completion');
      await page.waitForTimeout(1000);
    }
    throw new Error('robinhood login timed out (5 min)');
  }

  /** Small helper: hit Robinhood's REST API through the Playwright context
   *  so requests inherit cookies + UA from the real browser session. */
  private async apiFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    if (!this.context || !this.session) {
      throw new Error('robinhood not connected');
    }
    const res = await this.context.request.fetch(`https://api.robinhood.com${path}`, {
      method: init?.method ?? 'GET',
      data: init?.body ? JSON.stringify(init.body) : undefined,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok()) {
      throw new Error(`robinhood ${init?.method ?? 'GET'} ${path} ${res.status()}`);
    }
    return (await res.json()) as T;
  }

  // ---- core broker methods ----

  async listAccounts(): Promise<Account[]> {
    if (!this.isConnected()) return [];
    const r = await this.apiFetch<{
      results: Array<{ url: string; account_number: string; type: string }>;
    }>('/accounts/');
    return r.results.map((a) => ({
      brokerId: this.id,
      accountId: a.account_number,
      name: a.account_number,
      type: 'individual',
      mode: 'live',
      currency: 'USD',
    }));
  }

  async getQuote(symbol: string): Promise<Quote> {
    type RhQuote = {
      symbol: string;
      bid_price: string;
      ask_price: string;
      last_trade_price: string;
      updated_at: string;
    };
    const r = await this.apiFetch<RhQuote>(`/quotes/${encodeURIComponent(symbol)}/`);
    return {
      symbol: r.symbol,
      bid: Number(r.bid_price),
      ask: Number(r.ask_price),
      last: Number(r.last_trade_price),
      asOf: r.updated_at,
    };
  }

  async getCandles(_req: {
    symbol: string;
    interval: CandleInterval;
    from: number;
    to: number;
  }): Promise<Candle[]> {
    throw new Error('robinhood.getCandles: scaffolding only — implement via /marketdata/historicals/');
  }

  async getBalances(_account: AccountRef): Promise<AccountBalances> {
    throw new Error('robinhood.getBalances: scaffolding only — implement via /accounts/portfolio/');
  }

  async listPositions(_account: AccountRef): Promise<Position[]> {
    throw new Error('robinhood.listPositions: scaffolding only — implement via /positions/');
  }

  async listOrders(_account: AccountRef): Promise<Order[]> {
    throw new Error('robinhood.listOrders: scaffolding only — implement via /orders/');
  }

  async placeOrder(_req: OrderRequest): Promise<Order> {
    throw new Error('robinhood.placeOrder: scaffolding only — implement via /orders/ (multi-leg via /options/orders/)');
  }

  async cancelOrder(_account: AccountRef, _orderId: string): Promise<void> {
    throw new Error('robinhood.cancelOrder: scaffolding only — implement via /orders/{id}/cancel/');
  }
}

export function createRobinhoodBroker(deps: BrokerDeps): Broker {
  return new RobinhoodBroker(deps);
}
