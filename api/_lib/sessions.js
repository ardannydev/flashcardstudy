const { kv } = require('@vercel/kv');

const MAX_SESSIONS = 20;

function sessionsKey(username){
  return `sess:${username}`;
}

async function getSessions(username){
  const list = (await kv.get(sessionsKey(username))) || [];
  return Array.isArray(list) ? list : [];
}

async function saveSessions(username, list){
  await kv.set(sessionsKey(username), list);
}

/* Tambah perangkat baru atau perbarui perangkat yang sudah tercatat (tanpa mengubah createdAt/ip awal). */
async function upsertSession(username, session){
  let list = await getSessions(username);
  list = list.filter(s => !s.revoked);
  const idx = list.findIndex(s => s.deviceId === session.deviceId);
  if(idx >= 0){
    list[idx] = Object.assign({}, list[idx], session, {
      createdAt: list[idx].createdAt || session.createdAt,
      ip: list[idx].ip || session.ip
    });
  } else {
    list.push(Object.assign({}, session, { revoked: false }));
  }
  if(list.length > MAX_SESSIONS) list = list.slice(list.length - MAX_SESSIONS);
  await saveSessions(username, list);
  return list;
}

async function touchSession(username, deviceId){
  if(!deviceId) return;
  const list = await getSessions(username);
  const idx = list.findIndex(s => s.deviceId === deviceId);
  if(idx >= 0 && !list[idx].revoked){
    list[idx].lastSeen = Date.now();
    await saveSessions(username, list);
  }
}

async function revokeSession(username, deviceId){
  const list = await getSessions(username);
  const idx = list.findIndex(s => s.deviceId === deviceId);
  if(idx >= 0) list[idx].revoked = true;
  await saveSessions(username, list);
  return list.filter(s => !s.revoked);
}

async function revokeOtherSessions(username, keepDeviceId){
  const list = await getSessions(username);
  list.forEach(s => { if(s.deviceId !== keepDeviceId) s.revoked = true; });
  await saveSessions(username, list);
  return list.filter(s => !s.revoked);
}

module.exports = {
  getSessions,
  saveSessions,
  upsertSession,
  touchSession,
  revokeSession,
  revokeOtherSessions
};