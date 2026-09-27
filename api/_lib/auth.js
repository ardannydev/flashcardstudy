const crypto = require('crypto');
const { getSessions } = require('./sessions');

const SECRET = process.env.AUTH_SECRET;
if(!SECRET) console.warn('AUTH_SECRET not set — using fallback. Set AUTH_SECRET in production!');

function hashPassword(password, salt){
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash){
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(check, 'hex');
  const b = Buffer.from(hash, 'hex');
  if(a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createToken(username, deviceId){
  const payload = Buffer.from(JSON.stringify({ u: username, t: Date.now(), exp: Date.now() + 30*24*60*60*1000, d: deviceId || '' })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function parseTokenPayload(token){
  if(!token) return null;
  const parts = token.split('.');
  if(parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig, 'base64url');
  const expBuf = Buffer.from(expected, 'base64url');
  if(sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try{
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if(data.exp && Date.now() > data.exp) return null;
    return data;
  }catch(e){ return null; }
}

function verifyToken(token){
  const data = parseTokenPayload(token);
  return data ? data.u : null;
}

/* Mengembalikan { u, d, t, exp } — dipakai saat butuh device id pembuat token. */
function verifyTokenFull(token){
  const data = parseTokenPayload(token);
  return data ? { u: data.u, d: data.d || null, t: data.t, exp: data.exp } : null;
}

function parseAuthToken(req){
  const authHeader = (req && req.headers && req.headers.authorization) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return verifyTokenFull(token);
}

/* Verifikasi token DAN pastikan sesi perangkat milik token tidak dicabut (logout perangkat). */
async function requireAuth(req){
  const info = parseAuthToken(req);
  if(!info || !info.u) return null;
  if(info.d){
    try{
      const list = await getSessions(info.u);
      const sess = (list || []).find(s => s.deviceId === info.d);
      if(!sess || sess.revoked) return null;
    }catch(e){
      /* gagal baca sesi → tolak demi keamanan */
      return null;
    }
  }
  return { user: info.u, device: info.d };
}

module.exports = { hashPassword, verifyPassword, createToken, verifyToken, verifyTokenFull, parseAuthToken, requireAuth };
