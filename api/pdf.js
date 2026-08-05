const { kv } = require('@vercel/kv');
const { verifyToken } = require('./_lib/auth');

const MAX_BYTES = 3 * 1024 * 1024;
const CHUNK_SIZE = 700000;

function pdfMetaKey(username, setId){
  return `pdf:${username}:${setId}:meta`;
}
function pdfChunkKey(username, setId, index){
  return `pdf:${username}:${setId}:c${index}`;
}

async function readPdf(username, setId){
  const meta = await kv.get(pdfMetaKey(username, setId));
  if(!meta || !meta.chunks) return null;
  const parts = [];
  for(let i = 0; i < meta.chunks; i++){
    parts.push(await kv.get(pdfChunkKey(username, setId, i)) || '');
  }
  return { name: meta.name, size: meta.size, data: parts.join('') };
}

async function writePdf(username, setId, pdf){
  const data = String(pdf.data || '');
  const size = Math.min(Number(pdf.size) || 0, MAX_BYTES);
  if(size > MAX_BYTES) throw new Error('File too large');
  if(!data) throw new Error('Missing pdf data');

  const chunks = Math.ceil(data.length / CHUNK_SIZE) || 1;
  const pipeline = kv.pipeline();
  pipeline.set(pdfMetaKey(username, setId), {
    name: String(pdf.name || 'dokumen.pdf').slice(0, 200),
    size,
    chunks,
    updatedAt: Date.now()
  });
  for(let i = 0; i < chunks; i++){
    pipeline.set(pdfChunkKey(username, setId, i), data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
  await pipeline.exec();
}

async function removePdf(username, setId){
  const meta = await kv.get(pdfMetaKey(username, setId));
  const pipeline = kv.pipeline();
  pipeline.del(pdfMetaKey(username, setId));
  if(meta && meta.chunks){
    for(let i = 0; i < meta.chunks; i++) pipeline.del(pdfChunkKey(username, setId, i));
  }
  await pipeline.exec();
}

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const username = verifyToken(token);
  if(!username){
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if(req.method === 'GET'){
    const setId = req.query.setId;
    if(!setId){
      res.status(400).json({ error: 'Missing setId' });
      return;
    }
    const pdf = await readPdf(username, setId);
    if(!pdf){
      res.status(404).json({ error: 'PDF not found' });
      return;
    }
    res.status(200).json({ pdf });
    return;
  }

  if(req.method === 'PUT'){
    let body = req.body;
    if(typeof body === 'string'){
      try{ body = JSON.parse(body); }catch(e){ body = {}; }
    }
    const setId = body && body.setId;
    const pdf = body && body.pdf;
    if(!setId || !pdf || !pdf.data){
      res.status(400).json({ error: 'Missing setId or pdf data' });
      return;
    }
    if((Number(pdf.size) || 0) > MAX_BYTES){
      res.status(413).json({ error: 'File too large (max 3 MB)' });
      return;
    }

    const sets = (await kv.get(`sets:${username}`)) || [];
    if(!sets.some(s => s.id === setId)){
      res.status(404).json({ error: 'Set not found' });
      return;
    }

    try{
      await writePdf(username, setId, pdf);
      res.status(200).json({ ok: true });
    }catch(e){
      res.status(500).json({ error: e.message || 'Failed to save PDF' });
    }
    return;
  }

  if(req.method === 'DELETE'){
    const setId = req.query.setId;
    if(!setId){
      res.status(400).json({ error: 'Missing setId' });
      return;
    }
    await removePdf(username, setId);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
