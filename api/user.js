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

  if(req.method === 'GET'){
    const key = `user:${username}`;
    const user = await kv.get(key);
    if(!user){
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt
    });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
