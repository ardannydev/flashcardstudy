const { kv } = require('@vercel/kv');
const { requireAuth } = require('./_lib/auth');
const { getSessions, touchSession, revokeSession, revokeOtherSessions } = require('./_lib/sessions');

module.exports = async (req, res) => {
  const auth = await requireAuth(req);
  if(!auth){
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const username = auth.user;

  if(req.method === 'GET'){
    const key = `user:${username}`;
    const user = await kv.get(key);
    if(!user){
      res.status(404).json({ error: 'User not found' });
      return;
    }

    /* Tandai perangkat aktif terakhir + kembalikan daftar perangkat yang login */
    const devices = [];
    try{
      if(auth.device) await touchSession(username, auth.device);
      const sessions = await getSessions(username);
      (sessions || []).filter(s => !s.revoked).forEach(s => {
        devices.push({
          deviceId: s.deviceId,
          label: s.label,
          browser: s.browser,
          os: s.os,
          type: s.type,
          ip: s.ip,
          createdAt: s.createdAt,
          lastSeen: s.lastSeen,
          current: auth.device ? s.deviceId === auth.device : false
        });
      });
    }catch(e){ /* daftar perangkat bersifat opsional */ }

    res.status(200).json({
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
      devices
    });
    return;
  }

  if(req.method === 'POST'){
    let body = req.body;
    if(typeof body === 'string'){
      try{ body = JSON.parse(body); }catch(e){ body = {}; }
    }
    body = body || {};
    const action = body.action;

    if(action === 'logout-device'){
      const deviceId = String(body.deviceId || '');
      if(!deviceId){
        res.status(400).json({ error: 'deviceId required' });
        return;
      }
      const remaining = await revokeSession(username, deviceId);
      res.status(200).json({ ok: true, devices: remaining.map(publicSession) });
      return;
    }

    if(action === 'logout-others'){
      const remaining = await revokeOtherSessions(username, auth.device || '');
      res.status(200).json({ ok: true, devices: remaining.map(publicSession) });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};

function publicSession(s){
  return {
    deviceId: s.deviceId,
    label: s.label,
    browser: s.browser,
    os: s.os,
    type: s.type,
    ip: s.ip,
    createdAt: s.createdAt,
    lastSeen: s.lastSeen
  };
}