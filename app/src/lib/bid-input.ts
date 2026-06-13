// Story 2.4: pure validation of a bid price. PKR is whole rupees (architecture format),
// so only a positive integer string is valid. Pure + unit-tested; the bid modal reuses it.
export type BidValidation = { ok: true; pricePkr: number } | { ok: false; error: string };

export function validateBidInput(priceText: string): BidValidation {
  const trimmed = priceText.trim();
  if (!trimmed) {
    return { ok: false, error: 'Please enter your price.' };
  }
  // Whole rupees only — digits, no decimal point, no sign.
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'Enter a whole rupee amount (numbers only).' };
  }
  const pricePkr = parseInt(trimmed, 10);
  if (pricePkr <= 0) {
    return { ok: false, error: 'Your price must be more than zero.' };
  }
  return { ok: true, pricePkr };
}
