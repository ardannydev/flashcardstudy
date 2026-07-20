const { kv } = require('@vercel/kv');
const { verifyToken } = require('./_lib/auth');

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const username = verifyToken(token);

  if(!username){
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const key = `sets:${username}`;

  if(req.method === 'GET'){
    const sets = (await kv.get(key)) || [];
    res.status(200).json({ sets });
    return;
  }

  if(req.method === 'PUT'){
    let body = req.body;
    if(typeof body === 'string'){
      try{ body = JSON.parse(body); }catch(e){ body = {}; }
    }
    let sets = (body && body.sets) || [];
    if(!Array.isArray(sets)) sets = [];
    sets = sets.filter(s => s && typeof s === 'object' && s.id && s.title && Array.isArray(s.terms)).slice(0, 200);
    sets = sets.map(s => ({
      id: String(s.id).slice(0, 64),
      title: String(s.title).slice(0, 200),
      desc: String(s.desc || '').slice(0, 500),
      terms: (s.terms || []).slice(0, 1000).map(t => ({
        id: String(t.id || '').slice(0, 64),
        term: String(t.term || '').slice(0, 1000),
        def: String(t.def || '').slice(0, 1000),
        _review: t._review && typeof t._review === 'object' ? {
          reps: Math.min(Number(t._review.reps) || 0, 9999),
          ease: Math.min(Math.max(Number(t._review.ease) || 2.5, 1.3), 5),
          interval: Math.min(Number(t._review.interval) || 0, 36500),
          last: Number(t._review.last) || null,
          due: Number(t._review.due) || null
        } : undefined
      })),
      updatedAt: Number(s.updatedAt) || Date.now()
    }));
    await kv.set(key, sets);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
