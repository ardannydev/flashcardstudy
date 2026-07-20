import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(check, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

describe('Password Hashing', () => {
  it('should hash password with salt', () => {
    const result = hashPassword('mypassword');
    expect(result.salt).toBeDefined();
    expect(result.hash).toBeDefined();
    expect(result.hash.length).toBe(128);
  });

  it('should verify correct password', () => {
    const { salt, hash } = hashPassword('test123');
    expect(verifyPassword('test123', salt, hash)).toBe(true);
  });

  it('should reject wrong password', () => {
    const { salt, hash } = hashPassword('test123');
    expect(verifyPassword('wrongpass', salt, hash)).toBe(false);
  });

  it('should generate different hashes for same password', () => {
    const r1 = hashPassword('same');
    const r2 = hashPassword('same');
    expect(r1.salt).not.toBe(r2.salt);
    expect(r1.hash).not.toBe(r2.hash);
  });
});
