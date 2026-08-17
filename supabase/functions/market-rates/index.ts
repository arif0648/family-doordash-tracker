const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const timeoutMs = 8_000;
const SOURCE_URL = 'https://finans.truncgil.com/v4/today.json';
const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

async function fetchBody(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json, application/xml;q=0.9', 'user-agent': 'BARBIN-Ailesi/1.0' },
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function positive(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function turkeyTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const iso = `${value.replace(' ', 'T')}+03:00`;
  return Number.isFinite(new Date(iso).getTime()) ? iso : null;
}

function tcmbUsdMid(xml: string): number | null {
  const block = xml.match(/<Currency[^>]+CurrencyCode="USD"[\s\S]*?<\/Currency>/)?.[0];
  if (!block) return null;
  const buy = positive(block.match(/<ForexBuying>([^<]+)<\/ForexBuying>/)?.[1]);
  const sell = positive(block.match(/<ForexSelling>([^<]+)<\/ForexSelling>/)?.[1]);
  return buy !== null && sell !== null ? (buy + sell) / 2 : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const [marketText, tcmbResult] = await Promise.all([
      fetchBody(SOURCE_URL),
      fetchBody(TCMB_URL).catch(() => null),
    ]);
    const market = JSON.parse(marketText) as Record<string, unknown>;
    const usd = market.USD as { Buying?: unknown; Selling?: unknown } | undefined;
    const quarter = market.CEYREKALTIN as { Buying?: unknown; Selling?: unknown } | undefined;
    const usdBuy = positive(usd?.Buying);
    const usdSell = positive(usd?.Selling);
    const quarterGoldBuy = positive(quarter?.Buying);
    const quarterGoldSell = positive(quarter?.Selling);
    const sourceUpdatedAt = turkeyTimestamp(market.Update_Date);

    if (
      usdBuy === null || usdSell === null || quarterGoldBuy === null || quarterGoldSell === null ||
      sourceUpdatedAt === null || usdBuy > usdSell || quarterGoldBuy > quarterGoldSell
    ) throw new Error('INVALID_SOURCE_DATA');

    // TCMB is an official daily reference, not the displayed live market price.
    // A large divergence protects the family screen from an obviously corrupt USD quote.
    const tcmbMid = tcmbResult ? tcmbUsdMid(tcmbResult) : null;
    const usdMid = (usdBuy + usdSell) / 2;
    if (tcmbMid !== null && Math.abs(usdMid - tcmbMid) / tcmbMid > 0.10) {
      throw new Error('USD_REFERENCE_MISMATCH');
    }

    return new Response(JSON.stringify({
      usdBuy,
      usdSell,
      quarterGoldBuy,
      quarterGoldSell,
      source: 'Trunçgil Finans',
      sourceUpdatedAt,
      usdReference: tcmbMid === null ? null : { source: 'TCMB', mid: tcmbMid, withinTolerance: true },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'MARKET_DATA_UNAVAILABLE' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
});
