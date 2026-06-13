// Story 2.1: pure validation for a job draft before it is posted (FR-6: needs a Trade,
// a description, and a Precinct). Kept pure + unit-tested; the screen and createJob reuse it.
export type JobDraft = { serviceId: string; description: string; precinct: string };
export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateJobDraft(draft: JobDraft): ValidationResult {
  if (!draft.serviceId) {
    return { ok: false, error: 'Please choose a trade.' };
  }
  if (!draft.description.trim()) {
    return { ok: false, error: 'Please describe the problem.' };
  }
  if (!draft.precinct.trim()) {
    return { ok: false, error: 'Please enter your precinct.' };
  }
  return { ok: true };
}
