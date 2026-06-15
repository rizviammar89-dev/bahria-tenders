// Story 3.1: overall-rating validation. The DB CHECK (stars between 1 and 5) is the backstop;
// this guards the UI so it never attempts an out-of-range insert.

/** True iff `n` is an integer 1–5 (a valid overall star rating). */
export function isValidStars(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}
