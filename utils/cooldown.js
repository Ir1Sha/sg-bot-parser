const recentlyProcessed = new Map();
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function isInCooldown(normalizedEmail) {
  const last = recentlyProcessed.get(normalizedEmail);
  if (!last) return false;

  const diff = Date.now() - last;
  if (diff >= COOLDOWN_MS) {
    recentlyProcessed.delete(normalizedEmail);
    return false;
  }
  return true;
}

export function markProcessed(normalizedEmail) {
  recentlyProcessed.set(normalizedEmail, Date.now());
}
