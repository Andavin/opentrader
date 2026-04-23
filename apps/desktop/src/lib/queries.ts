import type { BrokerId, CandleInterval } from '@opentrader/broker-core';
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
