const { kv } = require('@vercel/kv');
const { verifyToken } = require('./_lib/auth');
const { getClientIp } = require('./_lib/ratelimit');

const ADMIN_USER = 'devardwannyy';

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const username = verifyToken(token);

  if (!username) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { type, message } = body || {};
    if (!type || !message) {
      res.status(400).json({ error: 'type and message required' });
      return;
    }

    const report = {
      id: 'rpt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      userId: username,
      username,
      type: String(type).slice(0, 20),
      message: String(message).slice(0, 2000),
      date: new Date().toISOString(),
      device: (req.headers['user-agent'] || '').slice(0, 500),
      ip: getClientIp(req),
      status: 'pending'
    };

    const reports = (await kv.get('reports:all')) || [];
    reports.unshift(report);
    if (reports.length > 500) reports.splice(500);
    await kv.set('reports:all', reports);

    res.status(200).json({ ok: true, id: report.id });
    return;
  }

  if (req.method === 'GET') {
    if (username !== ADMIN_USER) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const reports = (await kv.get('reports:all')) || [];
    res.status(200).json({ reports });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
