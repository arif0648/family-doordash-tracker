import { useEffect, useState } from 'react';

/**
 * ÖRNEK / BAŞLANGIÇ hook'u — MarketTicker bileşenine gerçek zamanlı veri
 * sağlamak için. Zorunlu değil, isterse silinip kendi veri kaynağınla
 * değiştirilebilir.
 *
 * USD/TRY için: exchangerate.host anahtar gerektirmeyen ücretsiz bir uçtur
 * (rate limit'e tabi, prod için kendi API key'li sağlayıcını önerilir).
 *
 * GOLD için: güvenilir ücretsiz/anahtarsız bir kaynak yok — goldapi.io,
 * metals-api.com gibi bir sağlayıcıdan API key almanız gerekir. O yüzden
 * burada gold alanı bilinçli olarak boş/undefined bırakıldı; kendi key'inle
 * doldurmalısın.
 */
export function useMarketTicker() {
  const [usdRate, setUsdRate] = useState<number | undefined>(undefined);
  const [usdChangePercent, setUsdChangePercent] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function loadUsd() {
      try {
        const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=TRY');
        if (!res.ok) throw new Error('exchangerate.host isteği başarısız');
        const data = await res.json();
        if (!cancelled && data?.rates?.TRY) {
          setUsdRate(data.rates.TRY);
          // Not: bu ücretsiz uç günlük değişim yüzdesi vermiyor —
          // gerçek bir kaynağa geçince bu alanı da doldurabilirsin.
          setUsdChangePercent(undefined);
        }
      } catch {
        // Sessizce yut — ticker zaten undefined durumda "—" gösteriyor.
      }
    }

    loadUsd();
    const interval = setInterval(loadUsd, 5 * 60 * 1000); // 5 dakikada bir

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return {
    usdRate,
    usdChangePercent,
    // Gold: kendi API key'li kaynağınla doldur.
    goldPrice: undefined as number | undefined,
    goldChangePercent: undefined as number | undefined,
  };
}
