const crypto = require('crypto');

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

function createToken(username){
  const payload = Buffer.from(JSON.stringify({ u: username, t: Date.now(), exp: Date.now() + 30*24*60*60*1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token){
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
    return data.u;
  }catch(e){ return null; }
}

module.exports = { hashPassword, verifyPassword, createToken, verifyToken };
