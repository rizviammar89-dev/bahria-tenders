// Story 1.4: canonical Pakistani phone normalization + synthetic-email derivation.
// Phone is the identity key (profiles.phone, UNIQUE E.164). The login screen and the
// founder provisioning script both derive the same synthetic auth email from the phone.

const SYNTHETIC_EMAIL_DOMAIN = 'phone.bahria-tenders.local';

/**
 * Normalizes common Pakistani mobile input forms to canonical E.164 (+923XXXXXXXXX).
 * Accepts: 03XXXXXXXXX, +923XXXXXXXXX, 923XXXXXXXXX, 3XXXXXXXXX (with optional spaces/dashes).
 * Returns null for anything that is not a valid PK mobile number (mobile prefixes start with 3).
 */
export function normalizePkPhone(raw: string): string | null {
  if (!raw) return null;
  // Strip spaces and dashes; keep a leading + for detection.
  const cleaned = raw.replace(/[\s-]/g, '');
  // Must be digits, optionally one leading +.
  if (!/^\+?\d+$/.test(cleaned)) return null;

  const digits = cleaned.replace(/^\+/, '');

  // Reduce every accepted form to the 10-digit national mobile number (3XXXXXXXXX).
  let national: string;
  if (digits.length === 12 && digits.startsWith('92')) {
    national = digits.slice(2); // 923XXXXXXXXX -> 3XXXXXXXXX
  } else if (digits.length === 11 && digits.startsWith('0')) {
    national = digits.slice(1); // 03XXXXXXXXX -> 3XXXXXXXXX
  } else if (digits.length === 10) {
    national = digits; // 3XXXXXXXXX
  } else {
    return null;
  }

  // PK mobile numbers are exactly 10 national digits starting with 3.
  if (!/^3\d{9}$/.test(national)) return null;

  return `+92${national}`;
}

/** Derives the synthetic auth email used for password sign-in, from a canonical E.164 phone. */
export function phoneToSyntheticEmail(e164: string): string {
  return `${e164}@${SYNTHETIC_EMAIL_DOMAIN}`;
}
