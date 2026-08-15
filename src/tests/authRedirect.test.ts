import { describe, expect, it } from 'vitest';
import {
  getPasswordResetRedirectUrl,
  hasPasswordRecoveryParameters,
  PRODUCTION_PASSWORD_RESET_URL,
} from '../lib/authRedirect';

describe('password recovery redirect contract', () => {
  it('production build always uses the Surge recovery route', () => {
    expect(getPasswordResetRedirectUrl(false, 'http://localhost:5174')).toBe(
      PRODUCTION_PASSWORD_RESET_URL,
    );
    expect(PRODUCTION_PASSWORD_RESET_URL).toBe(
      'https://barbin.surge.sh/sifre-sifirla',
    );
  });

  it('development keeps the current local origin', () => {
    expect(getPasswordResetRedirectUrl(true, 'http://localhost:5173')).toBe(
      'http://localhost:5173/sifre-sifirla',
    );
  });

  it('recognizes implicit and PKCE recovery callbacks', () => {
    expect(hasPasswordRecoveryParameters('https://app.test/sifre-sifirla#type=recovery&access_token=x')).toBe(true);
    expect(hasPasswordRecoveryParameters('https://app.test/sifre-sifirla?code=pkce-code')).toBe(true);
    expect(hasPasswordRecoveryParameters('https://app.test/sifre-sifirla')).toBe(false);
  });
});
