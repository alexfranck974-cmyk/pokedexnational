const SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
export function isValidUsername(candidate: string): boolean {
  return SLUG_RE.test(candidate);
}
