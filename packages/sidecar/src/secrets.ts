import type { BrokerDeps } from '@opentrader/broker-core';

/**
 * Phase-1 in-memory secret store. In production, the Tauri shell will
 * forward keychain reads/writes through an HTTP endpoint we expose
 * here, so the sidecar never touches the keychain crate directly.
 */
export function createInMemorySecrets(): BrokerDeps['secrets'] {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}
