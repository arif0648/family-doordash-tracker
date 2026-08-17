import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface MarketRates {
  usdBuy: number | null;
  usdSell: number | null;
  quarterGoldBuy: number | null;
  quarterGoldSell: number | null;
  source: string | null;
  sourceUpdatedAt: Date | null;
  loading: boolean;
  error: string | null;
  available: boolean;
}

export interface MarketRatesPayload {
  usdBuy: number;
  usdSell: number;
  quarterGoldBuy: number;
  quarterGoldSell: number;
  source: string;
  sourceUpdatedAt: string;
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function parseMarketRatesPayload(payload: unknown): MarketRatesPayload | null {
  const data = payload as Partial<MarketRatesPayload>;
  const usdBuy = positiveNumber(data?.usdBuy);
  const usdSell = positiveNumber(data?.usdSell);
  const quarterGoldBuy = positiveNumber(data?.quarterGoldBuy);
  const quarterGoldSell = positiveNumber(data?.quarterGoldSell);
  const sourceUpdatedAt = typeof data?.sourceUpdatedAt === 'string' ? new Date(data.sourceUpdatedAt) : null;

  if (
    usdBuy === null || usdSell === null || quarterGoldBuy === null || quarterGoldSell === null ||
    typeof data?.source !== 'string' || data.source.trim() === '' ||
    !sourceUpdatedAt || !Number.isFinite(sourceUpdatedAt.getTime()) ||
    usdBuy > usdSell || quarterGoldBuy > quarterGoldSell
  ) return null;

  return {
    usdBuy,
    usdSell,
    quarterGoldBuy,
    quarterGoldSell,
    source: data.source,
    sourceUpdatedAt: data.sourceUpdatedAt!,
  };
}

const emptyRates: Omit<MarketRates, 'loading' | 'error'> = {
  usdBuy: null,
  usdSell: null,
  quarterGoldBuy: null,
  quarterGoldSell: null,
  source: null,
  sourceUpdatedAt: null,
  available: false,
};

export function useMarketRates(refreshMs = 300_000): MarketRates {
  const [state, setState] = useState<MarketRates>({ ...emptyRates, loading: true, error: null });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('market-rates', { method: 'GET' });
        if (error) throw error;
        const rates = parseMarketRatesPayload(data);
        if (!rates) throw new Error('Piyasa kaynağı geçersiz veri döndürdü');

        if (alive) {
          setState({
            ...rates,
            sourceUpdatedAt: new Date(rates.sourceUpdatedAt),
            loading: false,
            error: null,
            available: true,
          });
        }
      } catch {
        if (alive) {
          // Eski veya hesaplanmış fiyatı canlıymış gibi göstermeyiz.
          setState({ ...emptyRates, loading: false, error: 'Veri alınamıyor' });
        }
      }
    };

    void load();
    const id = window.setInterval(load, refreshMs);
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', visible);

    return () => {
      alive = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refreshMs]);

  return state;
}
