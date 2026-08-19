export type ReferralSide = 'LEFT' | 'RIGHT';

const REFERRAL_CODE_PATTERN = /^GK-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function safeDecode(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeReferralCode(value: string | null | undefined): string | null {
  const normalized = safeDecode(value ?? '').normalize('NFKC').trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeReferralSide(value: string | null | undefined): ReferralSide | null {
  const normalized = safeDecode(value ?? '').trim().toUpperCase();
  return normalized === 'LEFT' || normalized === 'RIGHT' ? normalized : null;
}

export interface ReferralContext {
  code: string | null;
  side: ReferralSide;
}

export function readReferralContext(search: string, storedCode?: string | null, storedSide?: string | null): ReferralContext {
  const params = new URLSearchParams(search);
  const code = normalizeReferralCode(
    params.get('ref') ??
    params.get('referral') ??
    params.get('sponsor') ??
    params.get('sponsor_code') ??
    storedCode,
  );
  const side = normalizeReferralSide(
    params.get('binary') ??
    params.get('side') ??
    params.get('position') ??
    storedSide,
  ) ?? 'LEFT';

  return { code, side };
}

export function isValidReferralCode(value: string | null | undefined): boolean {
  return normalizeReferralCode(value) !== null;
}

export function clearReferralStorage(): void {
  localStorage.removeItem('nova_digital_referral');
  localStorage.removeItem('nova_digital_binary_side');
  localStorage.removeItem('geminix_referral');
  localStorage.removeItem('geminix_ref_token');
  localStorage.removeItem('geminix_binary_position');

  const expired = 'expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
  document.cookie = `nova_digital_ref=;${expired}`;
  document.cookie = `nova_digital_binary_side=;${expired}`;
  document.cookie = `geminix_ref=;${expired}`;
  document.cookie = `geminix_ref_token=;${expired}`;
  document.cookie = `geminix_binary_position=;${expired}`;
}
