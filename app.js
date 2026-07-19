/* ---------- penyimpanan data (localStorage) ---------- */
const STORE_KEY = 'qz_sets_v1';

function getSets(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch(e){ return []; }
}
function saveSets(sets){
  localStorage.setItem(STORE_KEY, JSON.stringify(sets));
  return pushSetsToServer(sets);
}

/* ---------- Autentikasi & sinkronisasi akun (Vercel KV) ---------- */
const AUTH_TOKEN_KEY = 'qz_auth_token';
const AUTH_USER_KEY = 'qz_auth_user';

function getToken(){
  return localStorage.getItem(AUTH_TOKEN_KEY);
}
function getCurrentUser(){
  return localStorage.getItem(AUTH_USER_KEY);
}
function setAuth(token, username){
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, username);
}
function clearAuth(){
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(STORE_KEY);
}
// Panggil di awal tiap halaman yang butuh login. Mengarahkan ke login.html jika belum login.
function requireLogin(){
  if(!getToken()){
    location.href = 'login.html';
    return false;
  }
  return true;
}
function logout(){
  clearAuth();
  location.href = 'login.html';
}

async function apiFetch(path, options={}){
  const token = getToken();
  const headers = Object.assign({'Content-Type':'application/json'}, options.headers||{});
  if(token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, Object.assign({}, options, {headers}));
  if(res.status === 401){
    clearAuth();
    location.href = 'login.html';
    throw new Error('Unauthorized');
  }
  return res;
}

// Ambil data set milik akun dari server lalu simpan ke localStorage.
// Dipanggil sekali di awal tiap halaman (setelah requireLogin) sebelum data dibaca.
async function syncSetsFromServer(){
  try{
    const res = await apiFetch('/api/sets');
    if(!res.ok) return getSets();
    const data = await res.json();
    localStorage.setItem(STORE_KEY, JSON.stringify(data.sets || []));
    return data.sets || [];
  }catch(e){
    console.warn('Gagal sinkronisasi dari server, memakai data lokal sementara.', e);
    return getSets();
  }
}

// Kirim seluruh data set ke server (dipanggil otomatis tiap kali saveSets() dipanggil).
async function pushSetsToServer(sets){
  if(!getToken()) return; // belum login, biarkan lokal saja (mis. saat di login.html)
  const res = await apiFetch('/api/sets', { method:'PUT', body: JSON.stringify({ sets }) });
  if(!res.ok){
    const msg = await res.text().catch(() => '');
    throw new Error('Gagal menyimpan ke server: ' + res.status + ' ' + msg);
  }
}
function getSet(id){
  return getSets().find(s => s.id === id);
}
function upsertSet(set){
  const sets = getSets();
  const i = sets.findIndex(s => s.id === set.id);
  if(i >= 0) sets[i] = set; else sets.unshift(set);
  return saveSets(sets);
}
function deleteSet(id){
  return saveSets(getSets().filter(s => s.id !== id));
}
function uid(prefix='id'){
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function qs(name){
  return new URLSearchParams(location.search).get(name);
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// Accessibility: aria-live announcer for screen readers (shared utility)
function announce(text){
  let lr = document.getElementById('a11yLive');
  if(!lr){
    lr = document.createElement('div');
    lr.id = 'a11yLive';
    lr.setAttribute('aria-live','polite');
    lr.style.position = 'absolute';
    lr.style.left = '-9999px';
    document.body.appendChild(lr);
  }
  lr.textContent = text;
}

function createNotification(message, type = 'info', duration = 4500) {
  let host = document.getElementById('notificationHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'notificationHost';
    host.className = 'notification-host';
    document.body.appendChild(host);
  }

  const existing = host.querySelector('.notification.visible');
  if(existing){
    existing.classList.remove('visible');
    existing.addEventListener('transitionend', () => existing.remove(), {once:true});
  }

  const note = document.createElement('div');
  note.className = `notification ${type}`;
  note.textContent = message;
  host.appendChild(note);

  requestAnimationFrame(() => note.classList.add('visible'));

  const close = () => {
    note.classList.remove('visible');
    note.addEventListener('transitionend', () => note.remove(), {once:true});
  };

  note.addEventListener('click', close);
  if(duration > 0) setTimeout(close, duration);
  return note;
}

function showConfirm(message, options = {}) {
  const {confirmText = 'Hapus', cancelText = 'Batal'} = options;
  return new Promise(resolve => {
    let overlay = document.getElementById('confirmOverlay');
    if(overlay){
      overlay.remove();
    }
    overlay = document.createElement('div');
    overlay.id = 'confirmOverlay';
    overlay.className = 'confirm-overlay';

    const safeMessage = message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    overlay.innerHTML = `
      <div class="confirm-card">
        <p class="confirm-message">${safeMessage}</p>
        <div class="confirm-actions">
          <button type="button" class="btn btn-ghost confirm-cancel">${cancelText}</button>
          <button type="button" class="btn btn-primary confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    overlay.querySelector('.confirm-ok').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
  });
}

/* Spaced Repetition (SM-2) helpers
   Each term will get a _review object stored on the term: {
     reps: number,
     ease: number,
     interval: number (days),
     last: timestamp,
     due: timestamp
   }
*/
function ensureReviewMeta(term){
  if(!term._review){
    const now = Date.now();
    term._review = {
      reps: 0,
      ease: 2.5,
      interval: 0,
      last: null,
      due: now // due immediately
    };
  }
  return term._review;
}

// SM-2 algorithm: quality 0-5 (5 = perfect). We'll map isCorrect -> quality 5, wrong -> 2.
function sm2Update(meta, quality){
  const now = Date.now();
  if(quality < 3){
    // failed recall
    meta.reps = 0;
    meta.interval = 1;
    meta.due = now + 24*60*60*1000; // 1 day
  } else {
    meta.reps = (meta.reps || 0) + 1;
    // ease factor adjustment
    meta.ease = Math.max(1.3, (meta.ease || 2.5) + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if(meta.reps === 1){
      meta.interval = 1;
    } else if(meta.reps === 2){
      meta.interval = 6;
    } else {
      meta.interval = Math.round((meta.interval || 6) * meta.ease);
    }
    meta.due = now + meta.interval * 24*60*60*1000;
  }
  meta.last = now;
  return meta;
}

// Update a term's review metadata and persist the parent set
function updateReviewForTerm(setId, termId, quality){
  const set = getSet(setId);
  if(!set) return;
  const term = set.terms.find(t => t.id === termId);
  if(!term) return;
  ensureReviewMeta(term);
  sm2Update(term._review, quality);
  upsertSet(set).catch(e => console.warn('Gagal menyimpan progres review ke server (tersimpan lokal).', e));
}
