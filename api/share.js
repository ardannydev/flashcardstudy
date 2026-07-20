const { kv } = require('@vercel/kv');
const { verifyToken } = require('./_lib/auth');
const { rateLimit, getClientIp } = require('./_lib/ratelimit');

module.exports = async (req, res) => {
  /* --- Public share endpoint --- */
  if (req.method === 'GET') {
    /* Rate limit public reads: 30 per IP per 15 min */
    const ip = getClientIp(req);
    const rl = rateLimit(`share:${ip}`, 30, 15 * 60 * 1000);
    if (!rl.ok) {
      res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
      res.status(429).json({ error: 'Terlalu banyak permintaan.' });
      return;
    }

    const setId = req.query.id;
    if (!setId) {
      res.status(400).json({ error: 'Missing set id' });
      return;
    }

    /* Search all users for this set */
    const keys = await kv.keys('sets:*');

    for (const key of keys) {
      const sets = await kv.get(key);
      if (!Array.isArray(sets)) continue;
      const found = sets.find(s => s.id === setId);
      if (found) {
        const publicSet = {
          id: found.id,
          title: found.title,
          desc: found.desc || '',
          terms: (found.terms || []).map(t => ({
            id: t.id,
            term: t.term,
            def: t.def
          }))
        };
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).json({ set: publicSet });
        return;
      }
    }

    res.status(404).json({ error: 'Set tidak ditemukan.' });
    return;
  }

  /* --- Generate share link (auth required) --- */
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const username = verifyToken(token);

    if (!username) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const setId = body && body.setId;
    if (!setId) {
      res.status(400).json({ error: 'Missing setId' });
      return;
    }

    const key = `sets:${username}`;
    const sets = (await kv.get(key)) || [];
    const found = sets.find(s => s.id === setId);
    if (!found) {
      res.status(404).json({ error: 'Set tidak ditemukan.' });
      return;
    }

    res.status(200).json({ shareUrl: `/share.html?id=${setId}` });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
