// Story 2.1: pure validation for a job draft before it is posted (FR-6: needs a Trade, a
// description, and an address). The address is structured: villa/apartment number, street/building
// name, and precinct number. Kept pure + unit-tested; the screen and createJob reuse it.
export type JobDraft = {
  serviceId: string;
  description: string;
  addressUnit: string; // Villa / Apartment number
  addressStreet: string; // Street / Building name
  precinct: string; // Precinct number
};
export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateJobDraft(draft: JobDraft): ValidationResult {
  if (!draft.serviceId) {
    return { ok: false, error: 'Please choose a trade.' };
  }
  if (!draft.description.trim()) {
    return { ok: false, error: 'Please describe the problem.' };
  }
  if (!draft.addressUnit.trim()) {
    return { ok: false, error: 'Please enter your villa/apartment number.' };
  }
  if (!draft.addressStreet.trim()) {
    return { ok: false, error: 'Please enter your street/building name.' };
  }
  if (!draft.precinct.trim()) {
    return { ok: false, error: 'Please enter your precinct number.' };
  }
  return { ok: true };
}
