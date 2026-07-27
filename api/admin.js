const { kv } = require('@vercel/kv');
const { verifyToken } = require('./_lib/auth');

const ADMIN_USER = 'devardwannyy';

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const username = verifyToken(token);

  if (!username || username !== ADMIN_USER) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const action = (body && body.action) || '';

    if (action === 'resolveReport') {
      const reportId = body.reportId;
      if (!reportId) { res.status(400).json({ error: 'reportId required' }); return; }
      const reports = (await kv.get('reports:all')) || [];
      const found = reports.find(r => r.id === reportId);
      if (!found) { res.status(404).json({ error: 'Report not found' }); return; }
      found.status = 'resolved';
      await kv.set('reports:all', reports);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'deleteReport') {
      const reportId = body.reportId;
      if (!reportId) { res.status(400).json({ error: 'reportId required' }); return; }
      let reports = (await kv.get('reports:all')) || [];
      reports = reports.filter(r => r.id !== reportId);
      await kv.set('reports:all', reports);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const action = req.query.action || 'stats';

  if (action === 'stats') {
    const userKeys = await kv.keys('user:*');
    const userCount = userKeys.length;

    const setKeys = await kv.keys('sets:*');
    let totalSets = 0;
    let totalCards = 0;
    for (const key of setKeys) {
      const sets = (await kv.get(key)) || [];
      totalSets += sets.length;
      for (const s of sets) {
        totalCards += (s.terms || []).length;
      }
    }

    const reports = (await kv.get('reports:all')) || [];
    const pendingReports = reports.filter(r => r.status === 'pending').length;

    res.status(200).json({
      users: userCount,
      sets: totalSets,
      cards: totalCards,
      reports: reports.length,
      pendingReports
    });
    return;
  }

  if (action === 'users') {
    const userKeys = await kv.keys('user:*');
    const users = [];
    for (const key of userKeys) {
      const ukey = key.slice('user:'.length);
      const user = await kv.get(key);
      if (!user) continue;
      const audit = (await kv.get(`audit:${ukey}`)) || [];
      const lastLogin = audit.filter(a => a.type === 'login_ok').pop();
      const lastIp = lastLogin ? lastLogin.ip : null;
      const lastLoginTs = lastLogin ? lastLogin.ts : null;
      const recentLogins = audit.slice(-10).reverse();

      const sets = (await kv.get(`sets:${ukey}`)) || [];
      const setCount = sets.length;
      const cardCount = sets.reduce((sum, s) => sum + (s.terms || []).length, 0);

      users.push({
        username: user.username || ukey,
        displayName: user.displayName || '',
        createdAt: user.createdAt || null,
        setCount,
        cardCount,
        lastLogin: lastLoginTs,
        lastIp,
        audit: recentLogins
      });
    }
    users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.status(200).json({ users });
    return;
  }

  if (action === 'reports') {
    const reports = (await kv.get('reports:all')) || [];
    res.status(200).json({ reports });
    return;
  }

  if (action === 'audit') {
    const targetUser = req.query.user;
    if (!targetUser) {
      const userKeys = await kv.keys('audit:*');
      const allEntries = [];
      for (const key of userKeys) {
        const ukey = key.slice('audit:'.length);
        const entries = (await kv.get(key)) || [];
        entries.forEach(e => allEntries.push({ ...e, user: ukey }));
      }
      allEntries.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      res.status(200).json({ entries: allEntries.slice(0, 200) });
      return;
    }
    const entries = (await kv.get(`audit:${targetUser}`)) || [];
    entries.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    res.status(200).json({ entries });
    return;
  }

  res.status(400).json({ error: 'Unknown action' });
};
