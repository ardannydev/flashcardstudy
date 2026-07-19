const { kv } = require('@vercel/kv');
const { verifyPassword, createToken } = require('./_lib/auth');

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
  const userKey = `user:${cleanUsername}`;
  const user = await kv.get(userKey);

  if(!user || !verifyPassword(String(password), user.salt, user.hash)){
    res.status(401).json({ error: 'Username atau password salah.' });
    return;
  }

  const token = createToken(cleanUsername);
  res.status(200).json({ token, username: cleanUsername });
};
