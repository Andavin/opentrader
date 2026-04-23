import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Broker, BrokerDeps, BrokerId } from '@opentrader/broker-core';
import { createAlpacaBroker } from '@opentrader/broker-alpaca';
import { createFidelityBroker } from '@opentrader/broker-fidelity';
import { createRobinhoodBroker } from '@opentrader/broker-robinhood';

import { env } from './env';
import { createLogger } from './logger';
import { createInMemorySecrets } from './secrets';

const dataDir = resolve(env.OPENTRADER_DATA_DIR);
mkdirSync(dataDir, { recursive: true });

const secrets = createInMemorySecrets();
const log = createLogger('broker');

const baseDeps: BrokerDeps = {
  secrets,
  dataDir,
  log: (level, msg, meta) => log[level](msg, meta),
};

const brokers = new Map<BrokerId, Broker>([
  ['alpaca', createAlpacaBroker(baseDeps)],
  ['robinhood', createRobinhoodBroker(baseDeps)],
  ['fidelity', createFidelityBroker(baseDeps)],
]);

export function getBroker(id: string): Broker | null {
  return brokers.get(id as BrokerId) ?? null;
}

export function listBrokerIds(): BrokerId[] {
  return [...brokers.keys()];
}
