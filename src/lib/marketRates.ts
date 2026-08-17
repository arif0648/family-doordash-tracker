import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface MarketRates {
  usdTry: number | null;
  quarterGoldTry: number | null;
  updatedAt: Date | null;
  loading: boolean;
  error: string | null;
  available: boolean;
}

export const OUNCE_GRAMS = 31.1034768;
export const QUARTER_FINE_GOLD_GRAMS = 1.608;

export function parseUsdTry(payload: unknown): number | null {
  const data = payload as { rates?: { TRY?: unknown; try?: unknown } };
  const value = Number(data?.rates?.TRY ?? data?.rates?.try);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function calculateQuarterGoldTry(usdTry: number, goldUsdPerOunce: number): number | null {
  if (![usdTry, goldUsdPerOunce].every((value) => Number.isFinite(value) && value > 0)) return null;
  return goldUsdPerOunce * usdTry * (QUARTER_FINE_GOLD_GRAMS / OUNCE_GRAMS);
}

export function parseMarketRatesPayload(payload: unknown): { usdTry: number; goldUsd: number } | null {
  const data = payload as { usdTry?: unknown; goldUsd?: unknown };
  const usdTry = Number(data?.usdTry);
  const goldUsd = Number(data?.goldUsd);
  return Number.isFinite(usdTry) && usdTry > 0 && Number.isFinite(goldUsd) && goldUsd > 0
    ? { usdTry, goldUsd }
    : null;
}

const FETCH_TIMEOUT = 10_000;
const MARKET_CACHE_KEY = 'barbin-market-rates-v3';

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('API isteği zaman aşımına uğradı');
    }
    throw error;
  }
}

async function fetchUsdTry(): Promise<number | null> {
  const sources = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.exchangerate-api.com/v4/latest/USD',
    'https://api.frankfurter.app/latest?from=USD&to=TRY',
  ];

  for (const url of sources) {
    try {
      const res = await fetchWithTimeout(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const rate = parseUsdTry(await res.json());
      if (rate !== null) return rate;
    } catch {
      // try next source
    }
  }
  return null;
}

async function fetchGoldUsd(): Promise<number | null> {
  // Fallback chain for gold spot in USD per troy ounce
  const sources = [
    {
      url: 'https://api.metals.live/v1/spot/gold',
      parse: (d: any) => {
        const arr = Array.isArray(d) ? d : [d];
        const found = arr.find((x: any) => x.gold)?.gold;
        return Number(found ?? arr[0]?.gold ?? arr[0]?.price);
      },
    },
    {
      url: 'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd',
      parse: (d: any) => Number(d?.['pax-gold']?.usd),
    },
    {
      url: 'https://api.gold-api.com/price/XAU',
      parse: (d: any) => Number(d?.price),
    },
  ];

  for (const { url, parse } of sources) {
    try {
      const res = await fetchWithTimeout(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const price = parse(data);
      if (Number.isFinite(price) && price > 0) return price;
    } catch {
      // try next source
    }
  }
  return null;
}

async function fetchRates() {
  let usdTry: number | null = null;
  let goldUsd: number | null = null;
  try {
    const { data, error } = await supabase.functions.invoke('market-rates', { method: 'GET' });
    if (!error) {
      const parsed = parseMarketRatesPayload(data);
      if (parsed) ({ usdTry, goldUsd } = parsed);
    }
  } catch {
    // Direct providers below remain a browser fallback if the edge function is unavailable.
  }

  if (usdTry === null || goldUsd === null) {
    [usdTry, goldUsd] = await Promise.all([fetchUsdTry(), fetchGoldUsd()]);
  }
  const errors: string[] = [];

  if (usdTry === null) errors.push('USD/TRY alınamadı');
  if (goldUsd === null) errors.push('Altın verisi alınamadı');

  const quarterGoldTry = usdTry !== null && goldUsd !== null
    ? calculateQuarterGoldTry(usdTry, goldUsd)
    : null;

  if (usdTry !== null || quarterGoldTry !== null) {
    return { usdTry, quarterGoldTry, error: errors.length > 0 ? errors.join(', ') : null };
  }

  throw new Error('Piyasa verisi alınamadı: ' + errors.join(', '));
}

function readCachedRates(): Pick<MarketRates, 'usdTry' | 'quarterGoldTry' | 'updatedAt' | 'available'> | null {
  try {
    const value = JSON.parse(localStorage.getItem(MARKET_CACHE_KEY) ?? 'null');
    const updatedAt = value?.updatedAt ? new Date(value.updatedAt) : null;
    const usdTry = Number(value?.usdTry);
    const quarterGoldTry = Number(value?.quarterGoldTry);
    if (!updatedAt || !Number.isFinite(updatedAt.getTime())) return null;
    return {
      usdTry: Number.isFinite(usdTry) && usdTry > 0 ? usdTry : null,
      quarterGoldTry: Number.isFinite(quarterGoldTry) && quarterGoldTry > 0 ? quarterGoldTry : null,
      updatedAt,
      available: (Number.isFinite(usdTry) && usdTry > 0) || (Number.isFinite(quarterGoldTry) && quarterGoldTry > 0),
    };
  } catch { return null; }
}

export function useMarketRates(refreshMs = 300_000): MarketRates {
  const cached = readCachedRates();
  const [state, setState] = useState<MarketRates>(() => ({
    usdTry: cached?.usdTry ?? null,
    quarterGoldTry: cached?.quarterGoldTry ?? null,
    updatedAt: cached?.updatedAt ?? null,
    loading: !cached?.available,
    error: null,
    available: cached?.available ?? false,
  }));

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const rates = await fetchRates();
        if (alive) {
          const next = {
            ...rates,
            updatedAt: new Date(),
            loading: false,
            error: rates.error,
            available: true,
          };
          localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(next));
          setState(next);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
        if (alive) {
          setState((s) => ({
            ...s,
            loading: false,
            error: errorMessage,
            available: s.available,
          }));
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
