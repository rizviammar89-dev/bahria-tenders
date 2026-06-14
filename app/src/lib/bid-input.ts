// Story 2.4: pure validation of a bid price. PKR is whole rupees (architecture format),
// so only a positive integer string is valid. Pure + unit-tested; the bid modal reuses it.
export type BidValidation = { ok: true; pricePkr: number } | { ok: false; error: string };

// Rs 1 crore — far above any home-service job, and well within the int4 price_pkr column.
const MAX_PRICE_PKR = 10_000_000;

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
  if (pricePkr > MAX_PRICE_PKR) {
    return { ok: false, error: 'That price looks too high — please check it.' };
  }
  return { ok: true, pricePkr };
}
