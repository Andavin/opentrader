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
import { type BrowserContext, type Page, chromium } from 'playwright';

const FIDELITY_CAPS: BrokerCapabilities = {
  options: true,
  multiLegOptions: true,
  extendedHours: true,
  level2: false,
  paperTrading: false,
  bracketOrders: true, // OCO supported in Active Trader Pro
  streamingQuotes: false,
  interactiveLogin: true,
};

const LOGIN_URL = 'https://digital.fidelity.com/prgw/digital/login/full-page';
const LOGGED_IN_HINT = 'digital.fidelity.com/ftgw/digital/portfolio/positions';

/**
 * SCAFFOLDING — Phase 5 stands up the Playwright contexts, login flow,
 * and capability surface. Endpoint coverage is intentionally narrow
 * (just enough to validate the auth path); the rest throw with phase
 * boundaries so the UI surfaces "not yet implemented" cleanly. Live
 * scraping selectors mirror the patterns from kennyboy106/fidelity-api,
 * which I cannot validate against the real site from the build sandbox.
 *
 * **Why scaffolding only?** Fidelity has no JSON API, scraping
 * selectors drift constantly, and any robust implementation has to be
 * built against a real authenticated session. We get the architecture
 * right here so adding endpoints later is purely additive.
 */
class FidelityBroker implements Broker {
  readonly id = 'fidelity' as const;
  readonly label = 'Fidelity';
  readonly capabilities = FIDELITY_CAPS;

  private context: BrowserContext | null = null;

  constructor(private readonly deps: BrokerDeps) {}

  isConnected(): boolean {
    return this.context !== null;
  }

  async connect(opts?: BrokerConnectOptions): Promise<void> {
    const userDataDir = resolve(this.deps.dataDir, 'profiles', 'fidelity');
    mkdirSync(userDataDir, { recursive: true });

    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 800 },
    });

    if (opts?.forceLogin === true) {
      await this.context.clearCookies();
    }

    const page = await this.context.newPage();
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await this.waitForLogin(page, 5 * 60 * 1000);
    await page.close();
    this.deps.log('info', 'fidelity connected');
  }

  async disconnect(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
    }
  }

  private async waitForLogin(page: Page, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (page.url().includes(LOGGED_IN_HINT)) return;
      if (page.isClosed()) throw new Error('login window closed before completion');
      await page.waitForTimeout(1000);
    }
    throw new Error('fidelity login timed out (5 min)');
  }

  /** Open a fresh page on the active context for scraping helpers to use. */
  private async newPage(): Promise<Page> {
    if (!this.context) throw new Error('fidelity not connected');
    return this.context.newPage();
  }

  // ---- core broker methods ----

  async listAccounts(): Promise<Account[]> {
    if (!this.isConnected()) return [];
    // Selector patterns from kennyboy106 fork — confirm against the
    // current DOM before relying on this in production.
    throw new Error('fidelity.listAccounts: scaffolding only — scrape from /portfolio/positions');
  }

  async getQuote(_symbol: string): Promise<Quote> {
    throw new Error('fidelity.getQuote: scaffolding only — scrape from /trade/dashboard');
  }

  async getCandles(_req: {
    symbol: string;
    interval: CandleInterval;
    from: number;
    to: number;
  }): Promise<Candle[]> {
    throw new Error('fidelity.getCandles: scaffolding only — Fidelity charts are mostly canvas');
  }

  async getBalances(_account: AccountRef): Promise<AccountBalances> {
    throw new Error('fidelity.getBalances: scaffolding only — scrape from /portfolio/summary');
  }

  async listPositions(_account: AccountRef): Promise<Position[]> {
    throw new Error('fidelity.listPositions: scaffolding only — scrape from /portfolio/positions');
  }

  async listOrders(_account: AccountRef): Promise<Order[]> {
    throw new Error('fidelity.listOrders: scaffolding only — scrape from /trade/orders');
  }

  async placeOrder(_req: OrderRequest): Promise<Order> {
    throw new Error('fidelity.placeOrder: scaffolding only — drive the trade form via Playwright');
  }

  async cancelOrder(_account: AccountRef, _orderId: string): Promise<void> {
    throw new Error('fidelity.cancelOrder: scaffolding only — drive the cancel button');
  }

  // Helper — keeps the unused page warning quiet during scaffolding
  // so noUnusedLocals stays green.
  private async _dropPage(page: Page): Promise<void> {
    await page.close();
  }
}

export function createFidelityBroker(deps: BrokerDeps): Broker {
  return new FidelityBroker(deps);
}
