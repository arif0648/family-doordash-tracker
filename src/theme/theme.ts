/**
 * theme.ts
 *
 * Family Finance & DoorDash — merkezi tasarım token sistemi.
 * "Deep Dark Mode + Glassmorphism + kontrollü Electric Neon Green".
 *
 * Amaç: her component kendi hex kodunu icat etmesin, hepsi buradan
 * çeksin. Böylece "neon her yerde" hatasına düşmeden, tek bir yerden
 * ton kontrolü yapılabilir.
 *
 * NOT: Projede zaten inline `style={{ ... }}` objeleri kullanılıyor
 * (Tailwind yok), bu yüzden bu dosya da aynı yaklaşımı sürdürüyor —
 * düz TS sabitleri + küçük yardımcı fonksiyonlar.
 */

import type { CSSProperties } from 'react';

export const colors = {
  // Zemin — Deep Dark / Midnight Black
  bgBase: '#05070D',
  bgElevated: '#0B1120',
  bgCard: '#111827',

  // Glass yüzeyler
  glassFill: 'rgba(17, 24, 39, 0.55)',
  glassFillStrong: 'rgba(17, 24, 39, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.07)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.12)',

  // Ana vurgu — Electric Neon Green (butonlar, aktif durumlar, CTA)
  neonGreen: '#00E676',
  neonGreenSoft: 'rgba(0, 230, 118, 0.14)',
  neonGreenGlow: 'rgba(0, 230, 118, 0.35)',

  // Pozitif değer metni (biraz daha okunabilir/yumuşak yeşil)
  positive: '#22C55E',

  // İkincil vurgu — Deep Blue / Cyan
  cyan: '#38BDF8',
  cyanSoft: 'rgba(56, 189, 248, 0.14)',

  // Negatif
  negative: '#F87171',
  negativeSoft: 'rgba(248, 113, 113, 0.14)',

  // Metin
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Çizgiler
  hairline: '#1E293B',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const spacing = (n: number) => n * 4;

export const type = {
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: colors.textMuted,
  },
  displayValue: {
    fontSize: 46,
    fontWeight: 800,
    letterSpacing: -1,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    fontWeight: 500,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 11.5,
    fontWeight: 600,
    color: colors.textMuted,
  },
};

/** Standart glass kart yüzeyi. `glow=true` ise çok hafif neon parıltı ekler (yalnızca önemli kartlarda kullan). */
export function glassCard(opts?: { glow?: 'green' | 'red' | 'none'; strong?: boolean }): CSSProperties {
  const glow = opts?.glow ?? 'none';
  const glowColor =
    glow === 'green' ? colors.neonGreenGlow : glow === 'red' ? 'rgba(248, 113, 113, 0.25)' : 'transparent';

  return {
    background: opts?.strong ? colors.glassFillStrong : colors.glassFill,
    border: `1px solid ${opts?.strong ? colors.glassBorderStrong : colors.glassBorder}`,
    borderRadius: radius.lg,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow: glow === 'none' ? '0 1px 0 rgba(255,255,255,0.03) inset' : `0 0 0 1px ${glowColor}, 0 8px 30px -12px ${glowColor}`,
  };
}

export function moneyColor(value: number): string {
  if (value > 0) return colors.positive;
  if (value < 0) return colors.negative;
  return colors.textSecondary;
}

export function formatMoney(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function formatMiles(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} mi`;
}
