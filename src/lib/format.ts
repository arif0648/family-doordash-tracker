export const MAX_AMOUNT = 1_000_000;

export function formatMoney(amount: number, showDecimals = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

export function formatDateTR(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}
