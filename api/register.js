const { kv } = require('@vercel/kv');
const { hashPassword, createToken } = require('./_lib/auth');

module.exports = async (req, res) => {
  if(req.method !== 'POST'){
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  let body = req.body;
  if(typeof body === 'string'){
    try{ body = JSON.parse(body); }catch(e){ body = {}; }
  }
  const { username, password } = body || {};

  if(!username || !password){
    res.status(400).json({ error: 'Username dan password wajib diisi.' });
    return;
  }
  const cleanUsername = String(username).trim().toLowerCase();
  if(cleanUsername.length < 3){
    res.status(400).json({ error: 'Username minimal 3 karakter.' });
    return;
  }
  if(!/^[a-z0-9_.-]+$/.test(cleanUsername)){
    res.status(400).json({ error: 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip.' });
    return;
  }
  if(String(password).length < 6){
    res.status(400).json({ error: 'Password minimal 6 karakter.' });
    return;
  }

  const userKey = `user:${cleanUsername}`;
  const existing = await kv.get(userKey);
  if(existing){
    res.status(409).json({ error: 'Username sudah dipakai. Silakan pilih username lain.' });
    return;
  }

  const { salt, hash } = hashPassword(String(password));
  await kv.set(userKey, {
    username: cleanUsername,
    displayName: String(username).trim(),
    salt, hash,
    createdAt: Date.now()
  });
  await kv.set(`sets:${cleanUsername}`, []);

  const token = createToken(cleanUsername);
  res.status(200).json({ token, username: cleanUsername });
};
