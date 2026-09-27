const { kv } = require('@vercel/kv');
const { verifyPassword, createToken } = require('./_lib/auth');
const { upsertSession } = require('./_lib/sessions');
const { rateLimit, getClientIp } = require('./_lib/ratelimit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  /* --- Rate limit: 10 login attempts per IP per 15 min --- */
  const ip = getClientIp(req);
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
    res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { username, password, device } = body || {};

  if (!username || !password) {
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const userKey = `user:${cleanUsername}`;
  const user = await kv.get(userKey);

  if (!user || !verifyPassword(String(password), user.salt, user.hash)) {
    /* --- Audit: log failed login --- */
    const auditKey = `audit:${cleanUsername}`;
    const attempts = (await kv.get(auditKey)) || [];
    attempts.push({ ts: Date.now(), ip, type: 'login_fail' });
    /* keep only last 50 entries */
    if (attempts.length > 50) attempts.splice(0, attempts.length - 50);
    await kv.set(auditKey, attempts);

    res.status(401).json({ error: 'Username atau password salah.' });
    return;
  }

  /* --- Audit: log successful login --- */
  const auditKey = `audit:${cleanUsername}`;
  const attempts = (await kv.get(auditKey)) || [];
  attempts.push({ ts: Date.now(), ip, type: 'login_ok' });
  if (attempts.length > 50) attempts.splice(0, attempts.length - 50);
  await kv.set(auditKey, attempts);

  /* --- Catat perangkat yang dipakai login --- */
  const dev = (device && typeof device === 'object') ? device : {};
  const deviceId = String(dev.id || 'd_web').slice(0, 64);
  const browser = String(dev.browser || 'Browser').slice(0, 40);
  const os = String(dev.os || 'Unknown').slice(0, 40);
  const type = dev.type === 'mobile' ? 'mobile' : 'desktop';
  await upsertSession(cleanUsername, {
    deviceId,
    label: (String(dev.label || browser + ' · ' + os)).slice(0, 80),
    browser,
    os,
    type,
    ip,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    revoked: false
  });

  const token = createToken(cleanUsername, deviceId);
  res.status(200).json({ token, username: cleanUsername, deviceId });
};
