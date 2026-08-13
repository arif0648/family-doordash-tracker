import { useEffect, useState } from 'react';

export interface MarketRates {
  usdTry: number | null;
  quarterGoldTry: number | null;
  updatedAt: Date | null;
  loading: boolean;
  error: string | null;
  available: boolean;
}

const OUNCE_GRAMS = 31.1034768;
const QUARTER_FINE_GOLD_GRAMS = 1.608;

const FETCH_TIMEOUT = 10_000;

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
      const data = await res.json();
      const rate =
        Number(data?.rates?.TRY) ||
        Number(data?.rates?.try) ||
        Number(data?.base === 'USD' ? data.rates?.TRY : undefined);
      if (Number.isFinite(rate) && rate > 0) return rate;
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
  const [usdTry, goldUsd] = await Promise.all([fetchUsdTry(), fetchGoldUsd()]);
  const errors: string[] = [];

  if (usdTry === null) errors.push('USD/TRY alınamadı');
  if (goldUsd === null) errors.push('Altın verisi alınamadı');

  const quarterGoldTry = usdTry !== null && goldUsd !== null
    ? goldUsd * usdTry * (QUARTER_FINE_GOLD_GRAMS / OUNCE_GRAMS)
    : null;

  if (usdTry !== null || quarterGoldTry !== null) {
    return { usdTry, quarterGoldTry, error: errors.length > 0 ? errors.join(', ') : null };
  }

  throw new Error('Piyasa verisi alınamadı: ' + errors.join(', '));
}

export function useMarketRates(refreshMs = 300_000): MarketRates {
  const [state, setState] = useState<MarketRates>({
    usdTry: null,
    quarterGoldTry: null,
    updatedAt: null,
    loading: true,
    error: null,
    available: false,
  });

  useEffect(() => {
    let alive = true;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;

    const load = async () => {
      try {
        const rates = await fetchRates();
        if (alive) {
          setState({
            ...rates,
            updatedAt: new Date(),
            loading: false,
            error: rates.error,
            available: true,
          });
          consecutiveErrors = 0;
        }
      } catch (err) {
        consecutiveErrors++;
        const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
        if (alive) {
          setState((s) => ({
            ...s,
            loading: false,
            error: errorMessage,
            available: s.available,
          }));
        }
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.warn(`Market rates API failed ${consecutiveErrors} times consecutively.`);
        }
      }
    };

    load();

    const getInterval = () => (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS ? refreshMs * 5 : refreshMs);
    const id = window.setInterval(() => {
      if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS || state.available === false) {
        load();
      }
    }, getInterval());

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [refreshMs, state.available]);

  return state;
}
