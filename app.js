/* ---------- Global error handler ---------- */
window.onerror = function(msg, url, line, col, err) {
  console.error('[GlobalError]', msg, url, line, col, err);
  if (typeof createNotification === 'function') {
    createNotification('Terjadi kesalahan tak terduga. Coba muat ulang halaman.', 'error', 6000);
  }
  return false;
};
window.addEventListener('unhandledrejection', function(e) {
  console.error('[UnhandledRejection]', e.reason);
  if (typeof createNotification === 'function') {
    createNotification('Gagal menghubungi server. Periksa koneksi internet.', 'error', 6000);
  }
});

/* ---------- penyimpanan data (localStorage) ---------- */
const STORE_KEY = 'qz_sets_v1';
const DB_VERSION_KEY = 'qz_db_version';
const CURRENT_DB_VERSION = 1;
let _setsSynced = false;
let _setsSyncPromise = null;
let _userProfileCache = null;
let _userProfilePromise = null;

function isLocalMode(){
  const hostname = location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || location.port === '5500';
}

function getSets(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch(e){ return []; }
}
function saveSets(sets){
  localStorage.setItem(STORE_KEY, JSON.stringify(sets));
  _setsSynced = true;
  if(!isLocalMode()) return pushSetsToServer(sets);
  return Promise.resolve();
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
  _setsSynced = false;
  _userProfileCache = null;
}
function clearAuth(){
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(STORE_KEY);
  _setsSynced = false;
  _userProfileCache = null;
}
// Helper untuk generate avatar unik per user tanpa request ke layanan eksternal.
function getUserAvatarUrl(){
  const username = getCurrentUser() || 'pengguna';
  let hash = 0;
  for(let i = 0; i < username.length; i++) hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const initial = (username.trim().charAt(0) || 'P').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 78% 58%)"/><stop offset="1" stop-color="hsl(${(hue + 55) % 360} 78% 52%)"/></linearGradient></defs><rect width="120" height="120" rx="24" fill="url(#g)"/><circle cx="60" cy="47" r="22" fill="#fff" fill-opacity=".9"/><path d="M24 106c4-24 18-36 36-36s32 12 36 36" fill="#fff" fill-opacity=".9"/><text x="60" y="116" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700" fill="#fff">${initial}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
// Panggil di awal tiap halaman yang butuh login. Mengarahkan ke login.html jika belum login.
function requireLogin(){
  if(isLocalMode()){
    if(!getToken()) setAuth('local_dev_token', 'dev');
    return true;
  }
  if(!getToken()){
    navigateTo('login.html', { replace: true });
    return false;
  }
  return true;
}
function logout(){
  clearAuth();
  navigateTo('login.html', { replace: true });
}

async function apiFetch(path, options={}){
  const token = getToken();
  const headers = Object.assign({'Content-Type':'application/json'}, options.headers||{});
  if(token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, Object.assign({}, options, {headers}));
  if(res.status === 401){
    clearAuth();
    navigateTo('login.html', { replace: true });
    throw new Error('Unauthorized');
  }
  return res;
}

// Ambil data set milik akun dari server lalu simpan ke localStorage.
// Dipanggil sekali di awal tiap halaman (setelah requireLogin) sebelum data dibaca.
async function syncSetsFromServer(options = {}){
  if(isLocalMode()) return getSets();
  if(_setsSynced && !options.force) return getSets();
  if(_setsSyncPromise) return _setsSyncPromise;
  _setsSyncPromise = (async () => {
    try{
      const res = await apiFetch('/api/sets');
      if(!res.ok) return getSets();
      const data = await res.json();
      localStorage.setItem(STORE_KEY, JSON.stringify(data.sets || []));
      _setsSynced = true;
      return data.sets || [];
    }catch(e){
      console.warn('Gagal sinkronisasi dari server, memakai data lokal sementara.', e);
      return getSets();
    }finally{
      _setsSyncPromise = null;
    }
  })();
  return _setsSyncPromise;
}

async function getUserProfile(options = {}){
  if(_userProfileCache && !options.force) return _userProfileCache;
  if(_userProfilePromise) return _userProfilePromise;
  _userProfilePromise = (async () => {
    try{
      const res = await apiFetch('/api/user');
      if(!res.ok) return null;
      _userProfileCache = await res.json();
      return _userProfileCache;
    }catch(e){
      return null;
    }finally{
      _userProfilePromise = null;
    }
  })();
  return _userProfilePromise;
}

// Kirim seluruh data set ke server (dipanggil otomatis tiap kali saveSets() dipanggil).
let _pushTimer = null;
let _pendingSets = null;
function pushSetsToServer(sets){
  if(isLocalMode()) return Promise.resolve();
  if(!getToken()) return Promise.resolve();
  _pendingSets = sets;
  if(_pushTimer) return;
  return new Promise((resolve, reject) => {
    _pushTimer = setTimeout(async () => {
      _pushTimer = null;
      const toPush = _pendingSets;
      _pendingSets = null;
      try{
        const res = await apiFetch('/api/sets', { method:'PUT', body: JSON.stringify({ sets: toPush }) });
        if(!res.ok) throw new Error('Server error ' + res.status);
        resolve();
      }catch(e){
        console.warn('Gagal push ke server:', e.message);
        reject(e);
      }
    }, 500);
  });
}
function getSet(id){
  return getSets().find(s => s.id === id);
}
function getDueCount(set){
  const now = Date.now();
  return set.terms.filter(t => {
    if(!t._review) return true;
    return t._review.due <= now;
  }).length;
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

const NOTIF_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function createNotification(message, type = 'info', duration = 4000) {
  let host = document.getElementById('notificationHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'notificationHost';
    host.className = 'notification-host';
    document.body.appendChild(host);
  }

  const old = host.querySelector('.notification');
  if(old) old.remove();

  const note = document.createElement('div');
  note.className = `notification ${type}`;

  const icon = document.createElement('span');
  icon.className = 'notification-icon';
  icon.innerHTML = NOTIF_ICONS[type] || NOTIF_ICONS.info;

  note.appendChild(icon);
  note.appendChild(document.createTextNode(message));
  host.appendChild(note);

  if(duration > 0) setTimeout(() => {
    if(note.parentNode){
      note.classList.add('removing');
      setTimeout(() => { if(note.parentNode) note.remove(); }, 200);
    }
  }, duration);
  return note;
}

function showConfirm(message, options = {}) {
  const {confirmText = 'Hapus', cancelText = 'Batal'} = options;
  return new Promise(resolve => {
    let overlay = document.getElementById('confirmOverlay');
    if(overlay) overlay.remove();
    const prevFocus = document.activeElement;
    overlay = document.createElement('div');
    overlay.id = 'confirmOverlay';
    overlay.className = 'confirm-overlay';

    const safeMessage = message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safeConfirm = confirmText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safeCancel = cancelText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    overlay.innerHTML = `
      <div class="confirm-card" role="alertdialog" aria-modal="true">
        <div class="confirm-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <p class="confirm-message">${safeMessage}</p>
        <div class="confirm-actions">
          <button type="button" class="btn confirm-cancel">${safeCancel}</button>
          <button type="button" class="btn confirm-ok">${safeConfirm}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    const okBtn = overlay.querySelector('.confirm-ok');
    const cancelBtn = overlay.querySelector('.confirm-cancel');
    okBtn.focus();

    const close = (result) => {
      overlay.classList.remove('visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), {once:true});
      if(prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(result);
    };
    cancelBtn.addEventListener('click', () => close(false));
    okBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') close(false);
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

/** Format due timestamp to human-readable Indonesian date */
function formatDueDate(dueTs){
  if(!dueTs) return 'Sekarang';
  const now = Date.now();
  const diff = dueTs - now;
  if(diff <= 0) return 'Sekarang';
  const days = Math.ceil(diff / (24*60*60*1000));
  if(days === 1) return 'Besok';
  if(days < 7) return `${days} hari lagi`;
  if(days < 30) return `${Math.ceil(days/7)} minggu lagi`;
  if(days < 365) return `${Math.ceil(days/30)} bulan lagi`;
  return `${Math.ceil(days/365)} tahun lagi`;
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

/* ---------- Navigasi tanpa reload ---------- */
(function(){
  const spaPages = new Set(['index.html','sets.html','create.html','learn.html','profile.html','flashcard.html','share.html','login.html']);
  let navigationBusy = false;

  function isSpaUrl(url){
    return url.origin === location.origin && spaPages.has(url.pathname.split('/').pop() || 'index.html');
  }

  async function navigateTo(url, options = {}){
    const target = new URL(url, location.href);
    if(!isSpaUrl(target)){
      location.href = target.href;
      return;
    }
    if(navigationBusy) return;
    if(target.href === location.href && options.history !== false) return;

    navigationBusy = true;
    document.documentElement.classList.add('spa-loading');
    try{
      const response = await fetch(target.href, { headers: { 'X-SPA-Navigation': '1' } });
      if(!response.ok) throw new Error(`Navigation failed: ${response.status}`);
      const html = await response.text();
      if(!/<html[\s>]/i.test(html)) throw new Error('Invalid HTML response');
      const nextDocument = new DOMParser().parseFromString(html, 'text/html');
      const nextBody = nextDocument.body;
      if(!nextBody) throw new Error('Missing page body');

      if(options.replace) history.replaceState({}, '', target.href);
      else if(options.history !== false) history.pushState({}, '', target.href);

      if(typeof window.__pageCleanup === 'function') window.__pageCleanup();

      const currentHeader = document.querySelector('body > .nh');
      const nextHeader = nextBody.querySelector(':scope > .nh');
      const keepHeader = currentHeader && nextHeader;
      const nextNodes = [...nextBody.childNodes]
        .filter(node => !(node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT'));

      document.title = nextDocument.title;
      document.body.className = nextBody.className;
      document.body.style.cssText = nextBody.getAttribute('style') || '';
      document.body.replaceChildren();

      if(keepHeader){
        const currentDot = currentHeader.querySelector('#navDot');
        currentHeader.className = nextHeader.className;
        currentHeader.classList.add('nh-no-anim');
        currentHeader.innerHTML = nextHeader.innerHTML;
        const nextDot = currentHeader.querySelector('#navDot');
        if(currentDot && nextDot) nextDot.replaceWith(currentDot);
        document.body.appendChild(currentHeader);
        updateActiveNav(target);
      } else if(nextHeader){
        nextHeader.classList.add('nh-no-anim');
      }

      nextNodes.forEach(node => {
        if(keepHeader && node === nextHeader) return;
        const clone = node.cloneNode(true);
        clone.querySelectorAll?.('script').forEach(script => script.remove());
        document.body.appendChild(clone);
      });

      await runPageScripts(nextBody.querySelectorAll('script'));
      sessionStorage.removeItem('navInternal');
      updateNavDot();
      const pageContent = document.querySelector('main');
      if(pageContent){
        pageContent.classList.remove('spa-content-enter');
        requestAnimationFrame(() => pageContent.classList.add('spa-content-enter'));
      }
    }catch(error){
      console.warn('Soft navigation gagal, memuat ulang halaman.', error);
      location.href = target.href;
    }finally{
      navigationBusy = false;
    }
  }

  window.navigateTo = navigateTo;

  function updateActiveNav(target){
    const currentFile = target.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nh .nh-link').forEach(link => {
      const href = link.getAttribute('href');
      if(!href || href.startsWith('#')) return;
      const linkFile = new URL(href, target.href).pathname.split('/').pop() || 'index.html';
      link.classList.toggle('active', linkFile === currentFile);
    });
  }

  async function runPageScripts(scripts){
    window.__pageCleanup = null;
    for(const script of scripts){
      const source = script.getAttribute('src');
      if(source && source.split('/').pop().split('?')[0] === 'app.js') continue;
      if(source) continue;
      const run = new Function(script.textContent);
      run.call(window);
    }
  }

  function updateNavDot(){
    const dot = document.getElementById('navDot');
    const active = document.querySelector('.nh-link.active');
    if(!dot) return;
    if(!active){
      dot.style.opacity = '0';
      return;
    }
    dot.style.opacity = '1';
    dot.style.left = `${active.offsetLeft + active.offsetWidth / 2 - 2.5}px`;
  }
  updateNavDot();

  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href]');
    if(!link || link.target === '_blank' || link.hasAttribute('download')) return;
    if(link.id === 'leaveBtn') return;
    const href = link.getAttribute('href');
    if(!href || href.startsWith('#')) return;
    const target = new URL(href, location.href);
    if(!isSpaUrl(target)) return;
    e.preventDefault();
    navigateTo(target.href);
  }, true);

  window.addEventListener('popstate', function(){
    navigateTo(location.href, { history: false });
  });
})();
