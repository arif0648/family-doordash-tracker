import { useEffect, useState } from 'react';

export const OUNCE_GRAMS = 31.1034768;
export const QUARTER_FINE_GOLD_GRAMS = 1.608;
const CACHE_KEY = 'barbin-market-rates-v2';
const CACHE_MS = 10 * 60_000;

export function parseUsdTry(payload: unknown): number | null {
  const data = payload as { rates?: { TRY?: unknown; try?: unknown } };
  const value = Number(data?.rates?.TRY ?? data?.rates?.try);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function calculateQuarterGoldTry(usdTry: number, goldUsdPerOunce: number): number | null {
  if (![usdTry, goldUsdPerOunce].every((v) => Number.isFinite(v) && v > 0)) return null;
  return goldUsdPerOunce * usdTry * (QUARTER_FINE_GOLD_GRAMS / OUNCE_GRAMS);
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } finally { window.clearTimeout(timeout); }
}

async function fetchRates() {
  const [usdPayload, goldPayload] = await Promise.all([
    getJson('https://api.frankfurter.app/latest?from=USD&to=TRY'),
    getJson('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd'),
  ]);
  const usdTry = parseUsdTry(usdPayload);
  const goldUsd = Number((goldPayload as any)?.['pax-gold']?.usd);
  const quarterGoldTry = usdTry === null ? null : calculateQuarterGoldTry(usdTry, goldUsd);
  if (usdTry === null || quarterGoldTry === null) throw new Error('PARSE_FAILED');
  return { usdTry, quarterGoldTry };
}

type Cached = { usdTry: number; quarterGoldTry: number; updatedAt: string };
function readCache(): Cached | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return parsed && Number.isFinite(parsed.usdTry) && Number.isFinite(parsed.quarterGoldTry) ? parsed : null;
  } catch { return null; }
}

export function useMarketData() {
  const cached = readCache();
  const [state, setState] = useState({ usdTry: cached?.usdTry ?? null, quarterGoldTry: cached?.quarterGoldTry ?? null, updatedAt: cached ? new Date(cached.updatedAt) : null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const current = readCache();
      if (current && Date.now() - new Date(current.updatedAt).getTime() < CACHE_MS) return;
      try {
        const rates = await fetchRates();
        const updatedAt = new Date();
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...rates, updatedAt: updatedAt.toISOString() }));
        if (alive) setState({ ...rates, updatedAt });
      } catch { /* offline market data never blocks the app */ }
    };
    void load();
    const timer = window.setInterval(load, CACHE_MS);
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return state;
}
