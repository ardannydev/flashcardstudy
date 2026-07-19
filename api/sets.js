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
    const sets = (body && body.sets) || [];
    await kv.set(key, sets);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
