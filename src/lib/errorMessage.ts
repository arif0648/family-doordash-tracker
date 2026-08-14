export function translateError(message: string | null | undefined): string {
  if (!message) return 'Beklenmedik bir hata oluştu.';

  const known: Record<string, string> = {
    MILEAGE_LOWER_THAN_PREVIOUS: 'Girilen kilometre önceki kayıttan düşük olamaz.',
    AUTH_REQUIRED: 'Oturumunuz sona ermiş. Tekrar giriş yapın.',
    FAMILY_ACCESS_DENIED: 'Bu kayda veya aileye erişiminiz yok.',
    CHAIN_INTEGRITY_VIOLATION: 'Kilometre zinciri bozuk. Lütfen kayıtları kontrol edin.',
    '23502': 'Gelir kaydı için gerekli bilgiler eksik. Veritabanı güncellemesini uygulayın.',
    INVALID_AMOUNT: 'Geçerli bir tutar girin.',
    INVALID_MILEAGE: 'Geçerli bir kapanış mili girin.',
    VEHICLE_NOT_FOUND: 'Seçilen araç bulunamadı veya aktif değil.',
  };

  for (const [code, text] of Object.entries(known)) {
    if (message.includes(code)) return text;
  }

  // Hide raw PostgreSQL / RPC internals
  if (message.includes('record "new" has no field') || message.includes('column') || message.includes('relation')) {
    return 'İşlem tamamlanamadı, lütfen tekrar deneyin.';
  }

  // Keep user-friendly messages as-is if already Turkish/short
  if (message.length < 80 && !message.includes(' ')) {
    return message;
  }

  return 'İşlem tamamlanamadı, lütfen tekrar deneyin.';
}
