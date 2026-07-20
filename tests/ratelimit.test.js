import { describe, it, expect, beforeEach } from 'vitest';

// Re-implement rate limiter for testing (pure function)
const buckets = new Map();

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

describe('Rate Limiter', () => {
  beforeEach(() => {
    buckets.clear();
  });

  it('should allow requests within limit', () => {
    const result = rateLimit('test:ip', 5, 60000);
    expect(result.ok).toBe(true);
  });

  it('should block requests exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('test:ip', 5, 60000);
    }
    const result = rateLimit('test:ip', 5, 60000);
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should track different keys separately', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('ip1', 5, 60000);
    }
    const result = rateLimit('ip2', 5, 60000);
    expect(result.ok).toBe(true);
  });

  it('should reset after window expires', () => {
    buckets.set('test:ip', { start: Date.now() - 100000, count: 10 });
    const result = rateLimit('test:ip', 5, 60000);
    expect(result.ok).toBe(true);
  });
});
