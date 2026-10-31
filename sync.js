'use strict';
// Firebase (Google bilan kirish + Firestore) orqali ixtiyoriy bulutli sinxronlash.
// Firebase sozlanmasa hech qanday tarmoq so'rovi yuborilmaydi; ilova avvalgidek lokal ishlaydi.
// Strategiya: butun holat bitta hujjat (gymtrack/{uid}); eng oxirgi o'zgargan nusxa yutadi,
// ikkala tomonda sinxronlanmagan o'zgarish bo'lsa foydalanuvchidan so'raladi.
const Sync = (() => {
  const VER = '10.14.1';
  const SDK = ['app', 'auth', 'firestore'].map(n => `https://www.gstatic.com/firebasejs/${VER}/firebase-${n}-compat.js`);
  const KEYS_SYNC = () => Object.keys(DEFAULTS).filter(k => k !== 'active');
  let user = null, db = null, auth = null, ready = false, busy = false, timer = null, status = '', err = '';

  // Ochiq web-konfiguratsiya (maxfiy emas); xavfsizlik Firestore qoidalari bilan ta'minlanadi
  const DEFAULT_CFG = {
    apiKey: 'AIzaSyCM6n6zd8fg4EkBH73Q7zbWqE4vQ6tBQ2A', authDomain: 'gymtrack-e4a28.firebaseapp.com', projectId: 'gymtrack-e4a28',
    storageBucket: 'gymtrack-e4a28.firebasestorage.app', messagingSenderId: '155397610247', appId: '1:155397610247:web:6e9fe766dc897fdadb83a2',
  };
  const cfg = () => store.get('fbcfg', null) || DEFAULT_CFG;

  // JSON yoki Firebase konsolidagi JS ob'ekt ko'rinishini qabul qiladi (eval ishlatilmaydi)
  function parseCfg(txt) {
    const m = String(txt || '').match(/\{[\s\S]*\}/); if (!m) return null;
    let o = null;
    try { o = JSON.parse(m[0]); } catch {
      try { o = JSON.parse(m[0].replace(/\/\/.*$/gm, '').replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"').replace(/,\s*}/g, '}')); } catch { return null; }
    }
    return o && typeof o === 'object' && o.apiKey && o.projectId && o.appId ? o : null;
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.async = false;
      s.onload = res; s.onerror = () => rej(new Error('SDK yuklanmadi: ' + src));
      document.head.appendChild(s);
    });
  }

  function refresh() { const b = document.getElementById('syncBox'); if (b && sheetKind === 'settings') b.innerHTML = inner(); }
  function setStatus(s, e = '') { status = s; err = e; refresh(); }

  async function init() {
    const c = cfg(); if (!c || ready || !navigator.onLine) return;
    try {
      if (!window.firebase) for (const src of SDK) await loadScript(src);
      if (!firebase.apps.length) firebase.initializeApp(c);
      auth = firebase.auth(); db = firebase.firestore(); ready = true;
      auth.getRedirectResult().catch(e => setStatus('', friendly(e)));
      auth.onAuthStateChanged(u => { user = u; refresh(); if (u) syncNow(true); });
    } catch (e) { setStatus('', 'Firebase ishga tushmadi: ' + (e.message || e)); }
  }

  function friendly(e) {
    const c = e && e.code || '';
    if (c === 'auth/unauthorized-domain') return 'Bu domen Firebase → Authentication → Settings → Authorized domains ro\'yxatida yo\'q.';
    if (c === 'auth/operation-not-allowed') return 'Firebase → Authentication → Sign-in method da Google yoqilmagan.';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if (c === 'permission-denied' || c === 'firestore/permission-denied') return 'Firestore qoidalari ruxsat bermadi (README dagi qoidalarni qo\'ying).';
    if (c === 'auth/network-request-failed') return 'Tarmoq xatosi.';
    return (e && e.message) || String(e);
  }

  async function login() {
    if (!ready) await init();
    if (!auth) return;
    try {
      const p = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(p);
    } catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
        try { await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); } catch (e2) { setStatus('', friendly(e2)); }
      } else setStatus('', friendly(e));
    }
  }
  async function logout() { try { await auth.signOut(); } catch { /* e'tibor bermaymiz */ } user = null; store.set('synced', 0); setStatus(''); }

  const isEmptyLocal = () => !S.workouts.length && !S.log.length && !S.bw.length && !S.meals.length && !S.custom.length && !S.meas.length && !S.myprogs.length && !S.xp;
  function payload() { const d = {}; KEYS_SYNC().forEach(k => { d[k] = S[k]; }); return d; }

  async function push(ref) {
    const now = Date.now();
    await ref.set({ data: JSON.stringify(payload()), updated: now, v: 1 });
    store.set('synced', now);
  }
  function pull(r) {
    let clean = null;
    try { clean = sanitizeData(JSON.parse(r.data)); } catch { /* buzilgan */ }
    if (!clean) throw new Error('Bulutdagi ma\'lumot o\'qilmadi');
    applyData(clean);
    store.set('synced', r.updated); store.set('mod', r.updated);
    renderAll();
  }

  async function syncNow(silent) {
    if (!user || !db || busy) return;
    if (!navigator.onLine) { if (!silent) toast('Internet yo\'q', '📡'); return; }
    busy = true; setStatus('Sinxronlanmoqda…');
    try {
      const ref = db.collection('gymtrack').doc(user.uid), snap = await ref.get();
      const mod = store.get('mod', 0), synced = store.get('synced', 0);
      let msg = 'Hammasi yangilangan';
      if (snap.exists) {
        const r = snap.data(), remoteNew = r.updated > synced, localNew = mod > synced;
        if (remoteNew && localNew && !isEmptyLocal()) {
          const takeCloud = await ask('Bulutdagi ma\'lumot ham, bu qurilmadagi ham o\'zgargan. Qaysi biri qolsin? "Bulutdagi" — shu qurilmadagi o\'zgarishlar yo\'qoladi; "Yo\'q" — bu qurilmadagi bulutni almashtiradi.', 'Bulutdagi');
          if (takeCloud) { pull(r); msg = 'Bulutdan olindi'; } else { await push(ref); msg = 'Bulutga yuborildi'; }
        } else if (remoteNew) { pull(r); msg = 'Bulutdan olindi'; }
        else if (localNew) { await push(ref); msg = 'Bulutga yuborildi'; }
      } else { await push(ref); msg = 'Bulutga yuborildi'; }
      setStatus('✓ ' + msg + ' · ' + new Date().toTimeString().slice(0, 5));
      if (!silent) toast(msg, '☁️');
    } catch (e) { setStatus('', friendly(e)); if (!silent) toast('Sinxronlash xatosi', '⚠️'); }
    busy = false; refresh();
  }

  // save() har o'zgarishda chaqiradi: 4 soniya kutib bitta marta yuboramiz
  function touch() {
    if (!user) return;
    clearTimeout(timer); timer = setTimeout(() => syncNow(true), 4000);
  }

  function saveCfg(txt) {
    const o = parseCfg(txt);
    if (!o) { toast('Sozlama noto\'g\'ri: apiKey, projectId va appId kerak', '⚠️'); return; }
    store.set('fbcfg', o); ready = false; setStatus(''); init();
    toast('Firebase sozlandi. Endi Google bilan kiring', '☁️');
  }
  function clearCfg() {
    if (user && auth) try { auth.signOut(); } catch { /* */ }
    store.set('fbcfg', null); store.set('synced', 0); user = null; ready = false; setStatus('');
  }

  const html = () => `<div id="syncBox">${inner()}</div>`;
  function inner() {
    const c = cfg();
    const e = err ? `<p class="warn-t">${esc(err)}</p>` : '';
    if (!c) {
      return `<h4>Bulutli sinxronlash (Firebase)</h4>
        <p class="mute small">Telefon va kompyuter ma'lumotlarini bir xil qilish uchun. O'z Firebase loyihangiz kerak (bepul Spark tarif yetadi). Batafsil: README.md.</p>
        <form id="syncCfgForm" class="stack"><textarea name="cfg" rows="5" placeholder='Firebase "firebaseConfig" ni shu yerga qo&apos;ying: { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." }' aria-label="Firebase sozlamasi" required></textarea>
        <button class="btn ghost">Sozlamani saqlash</button></form>${e}`;
    }
    if (!user) {
      return `<h4>Bulutli sinxronlash</h4><p class="mute small">Loyiha: <b>${esc(c.projectId)}</b></p>${e}
        <div class="row wrap"><button class="btn" data-act="sync-login">Google bilan kirish</button></div>`;
    }
    return `<h4>Bulutli sinxronlash</h4>
      <p class="small">Kirgan: <b>${esc(user.email || user.displayName || '')}</b></p><p class="mute small">${esc(status || 'Tayyor')}</p>${e}
      <div class="row wrap"><button class="btn" data-act="sync-now">Hozir sinxronlash</button><button class="btn ghost" data-act="sync-logout">Chiqish</button></div>`;
  }

  window.addEventListener('online', () => { if (user) syncNow(true); else init(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && user) syncNow(true); });

  return { init, html, login, logout, syncNow, touch, saveCfg, clearCfg, get user() { return user; } };
})();

window.Sync = Sync;
Sync.init();
