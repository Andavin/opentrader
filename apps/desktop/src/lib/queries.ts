import type { AccountRef, BrokerId, CandleInterval, OrderRequest } from '@opentrader/broker-core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { brokerClient } from './brokerClient';

export function useBrokerStatus(brokerId: BrokerId) {
  return useQuery({
    queryKey: ['broker-status', brokerId],
    queryFn: () => brokerClient.status(brokerId),
    refetchInterval: 10_000,
  });
}

export function useQuote(brokerId: BrokerId, symbol: string | null, enabled = true) {
  return useQuery({
    queryKey: ['quote', brokerId, symbol],
    queryFn: () => brokerClient.getQuote(brokerId, symbol!),
    enabled: enabled && !!symbol,
    refetchInterval: 2_000,
    staleTime: 1_500,
  });
}

export function useCandles(
  brokerId: BrokerId,
  req: { symbol: string | null; interval: CandleInterval; from: number; to: number },
) {
  return useQuery({
    queryKey: ['candles', brokerId, req.symbol, req.interval, req.from, req.to],
    queryFn: () =>
      brokerClient.getCandles(brokerId, {
        symbol: req.symbol!,
        interval: req.interval,
        from: req.from,
        to: req.to,
      }),
    enabled: !!req.symbol,
    staleTime: 30_000,
  });
}

export function useDataFeed(brokerId: BrokerId, enabled = true) {
  return useQuery({
    queryKey: ['data-feed', brokerId],
    queryFn: () => brokerClient.getDataFeed(brokerId),
    enabled,
    staleTime: 60_000,
  });
}

export function useSetDataFeed(brokerId: BrokerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feed: string) => brokerClient.setDataFeed(brokerId, feed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-feed', brokerId] });
      // Bust quote/candle caches so widgets refetch through the new feed.
      queryClient.invalidateQueries({ queryKey: ['quote', brokerId] });
      queryClient.invalidateQueries({ queryKey: ['candles', brokerId] });
    },
  });
}

export function useRefreshDataFeed(brokerId: BrokerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => brokerClient.refreshDataFeed(brokerId),
    onSuccess: (data) => {
      queryClient.setQueryData(['data-feed', brokerId], data);
    },
  });
}

// ---- trading-side hooks ----

export function useAccounts(brokerId: BrokerId, enabled = true) {
  return useQuery({
    queryKey: ['accounts', brokerId],
    queryFn: () => brokerClient.listAccounts(brokerId),
    enabled,
    staleTime: 60_000,
  });
}

export function useBalances(account: AccountRef | null, enabled = true) {
  return useQuery({
    queryKey: ['balances', account?.brokerId, account?.accountId],
    queryFn: () => brokerClient.getBalances(account!),
    enabled: enabled && !!account,
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}

export function usePositions(account: AccountRef | null, enabled = true) {
  return useQuery({
    queryKey: ['positions', account?.brokerId, account?.accountId],
    queryFn: () => brokerClient.listPositions(account!),
    enabled: enabled && !!account,
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}

export function useOrders(account: AccountRef | null, enabled = true) {
  return useQuery({
    queryKey: ['orders', account?.brokerId, account?.accountId],
    queryFn: () => brokerClient.listOrders(account!),
    enabled: enabled && !!account,
    refetchInterval: 5_000,
    staleTime: 3_000,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: OrderRequest) => brokerClient.placeOrder(req),
    onSuccess: (_data, req) => {
      const { brokerId, accountId } = req.account;
      queryClient.invalidateQueries({ queryKey: ['orders', brokerId, accountId] });
      queryClient.invalidateQueries({ queryKey: ['positions', brokerId, accountId] });
      queryClient.invalidateQueries({ queryKey: ['balances', brokerId, accountId] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: { account: AccountRef; orderId: string }) =>
      brokerClient.cancelOrder(req.account, req.orderId),
    onSuccess: (_data, vars) => {
      const { brokerId, accountId } = vars.account;
      queryClient.invalidateQueries({ queryKey: ['orders', brokerId, accountId] });
    },
  });
}
