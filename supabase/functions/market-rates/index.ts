const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const timeoutMs = 8_000;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function firstNumber(sources: Array<{ url: string; parse: (data: unknown) => number }>): Promise<number | null> {
  for (const source of sources) {
    try {
      const value = source.parse(await fetchJson(source.url));
      if (Number.isFinite(value) && value > 0) return value;
    } catch {
      // Continue with the next independent provider.
    }
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const [usdTry, goldUsd] = await Promise.all([
    firstNumber([
      { url: 'https://open.er-api.com/v6/latest/USD', parse: (data) => Number((data as { rates?: { TRY?: unknown } })?.rates?.TRY) },
      { url: 'https://api.exchangerate-api.com/v4/latest/USD', parse: (data) => Number((data as { rates?: { TRY?: unknown } })?.rates?.TRY) },
      { url: 'https://api.frankfurter.app/latest?from=USD&to=TRY', parse: (data) => Number((data as { rates?: { TRY?: unknown } })?.rates?.TRY) },
    ]),
    firstNumber([
      { url: 'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd', parse: (data) => Number((data as Record<string, { usd?: unknown }>)?.['pax-gold']?.usd) },
      { url: 'https://api.gold-api.com/price/XAU', parse: (data) => Number((data as { price?: unknown })?.price) },
    ]),
  ]);

  if (usdTry === null || goldUsd === null) {
    return new Response(JSON.stringify({ error: 'MARKET_DATA_UNAVAILABLE', usdTry, goldUsd }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({ usdTry, goldUsd, updatedAt: new Date().toISOString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
  });
});
