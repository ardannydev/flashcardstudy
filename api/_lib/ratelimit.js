/* In-memory rate limiter (reset on cold start).
   Untuk production, gunakan Vercel KV atau Redis. */
const buckets = new Map();

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
}

/**
 * Rate limit check.
 * @param {string} key     — identifier (e.g. ip or ip+endpoint)
 * @param {number} max     — max requests per window
 * @param {number} windowMs — window in ms (default 15 min)
 * @returns {{ ok: boolean, retryAfterMs: number }}
 */
function rateLimit(key, max = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 1 };
    buckets.set(key, entry);
    return { ok: true, retryAfterMs: 0 };
  }

  entry.count++;
  if (entry.count > max) {
    const retryAfterMs = windowMs - (now - entry.start);
    return { ok: false, retryAfterMs };
  }
  return { ok: true, retryAfterMs: 0 };
}

/**
 * Clean up expired entries.
 * NOTE: In Vercel serverless, instances are short-lived so
 * the Map naturally stays small. No setInterval needed.
 */
function cleanup() {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now - v.start > 15 * 60 * 1000) buckets.delete(k);
  }
}

module.exports = { rateLimit, getClientIp };
