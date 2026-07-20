import { describe, it, expect } from 'vitest';

// Extract SM-2 logic for testing (pure functions)
function sm2Update(meta, quality) {
  const now = Date.now();
  if (quality < 3) {
    meta.reps = 0;
    meta.interval = 1;
    meta.due = now + 24 * 60 * 60 * 1000;
  } else {
    meta.reps = (meta.reps || 0) + 1;
    meta.ease = Math.max(1.3, (meta.ease || 2.5) + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (meta.reps === 1) {
      meta.interval = 1;
    } else if (meta.reps === 2) {
      meta.interval = 6;
    } else {
      meta.interval = Math.round((meta.interval || 6) * meta.ease);
    }
    meta.due = now + meta.interval * 24 * 60 * 60 * 1000;
  }
  meta.last = now;
  return meta;
}

describe('SM-2 Algorithm', () => {
  it('should reset on failed recall (quality < 3)', () => {
    const meta = { reps: 5, ease: 2.6, interval: 30, last: Date.now(), due: Date.now() };
    const result = sm2Update(meta, 2);
    expect(result.reps).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.due).toBeGreaterThan(Date.now());
  });

  it('should increment reps on successful recall (quality >= 3)', () => {
    const meta = { reps: 0, ease: 2.5, interval: 0, last: null, due: Date.now() };
    sm2Update(meta, 5);
    expect(meta.reps).toBe(1);
    expect(meta.interval).toBe(1);
  });

  it('should set interval to 6 on second success', () => {
    const meta = { reps: 1, ease: 2.5, interval: 1, last: Date.now(), due: Date.now() };
    sm2Update(meta, 5);
    expect(meta.reps).toBe(2);
    expect(meta.interval).toBe(6);
  });

  it('should multiply interval by ease factor on 3rd+ success', () => {
    const meta = { reps: 2, ease: 2.5, interval: 6, last: Date.now(), due: Date.now() };
    sm2Update(meta, 5);
    expect(meta.reps).toBe(3);
    expect(meta.interval).toBe(Math.round(6 * meta.ease));
  });

  it('should not let ease factor drop below 1.3', () => {
    const meta = { reps: 3, ease: 1.3, interval: 10, last: Date.now(), due: Date.now() };
    sm2Update(meta, 3);
    expect(meta.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('should update last timestamp', () => {
    const before = Date.now();
    const meta = { reps: 0, ease: 2.5, interval: 0, last: null, due: Date.now() };
    sm2Update(meta, 5);
    expect(meta.last).toBeGreaterThanOrEqual(before);
  });
});
