export const PRODUCTION_PASSWORD_RESET_URL =
  'https://barbin-phase32-test.surge.sh/sifre-sifirla';

export function getPasswordResetRedirectUrl(isDevelopment: boolean, origin: string): string {
  return isDevelopment
    ? `${origin.replace(/\/$/, '')}/sifre-sifirla`
    : PRODUCTION_PASSWORD_RESET_URL;
}

export function hasPasswordRecoveryParameters(url: string): boolean {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));

  return (
    query.get('type') === 'recovery' ||
    hash.get('type') === 'recovery' ||
    query.has('code') ||
    (query.has('token_hash') && query.get('type') === 'recovery')
  );
}
