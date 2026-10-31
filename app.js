'use strict';

// ====================== yordamchi ======================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const z2 = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;
const today = () => dayKey();
const dayNum = k => Math.round(new Date(k + 'T00:00:00').getTime() / 864e5);
const fmtDate = k => k.split('-').reverse().join('.');
const shortDate = k => k.slice(8) + '.' + k.slice(5, 7);
const fmtTime = s => `${z2(Math.floor(s / 60))}:${z2(s % 60)}`;
const round1 = n => Math.round(n * 10) / 10;
const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const WATER_GOAL = 8;

const store = {
  get(key, def) {
    try { const v = localStorage.getItem('gt2.' + key); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('gt2.' + key, JSON.stringify(val)); } catch { /* storage mavjud emas */ }
  },
};

const DEFAULTS = {
  profile: {
    name: '', weeklyGoal: 4, program: 'ppl', dayIdx: 0, planGoal: 'massa', planVar: 0, theme: 'dark', onboarded: false,
    voice: false, voiceLang: 'auto',                          // ovozli yordamchi
    pPerKg: 2, fatPct: 25,                                   // dieta: oqsil g/kg va yog' % (kaloriyadan)
    remindOn: false, remindTime: '18:00', remindDays: [1, 3, 5], remindLast: '',   // eslatma
  },
  workouts: [], log: [], bw: [], meals: [], custom: [], meas: [], myprogs: [],
  budget: { amount: 60000, period: 'day', prices: {}, off: ['whey', 'salmon', 'tuna', 'pbutter'] },
  cut: { on: false, sex: 'm', age: 0, height: 0, activity: 1.55, startKg: 0, targetKg: 0, weeks: 12, realWeeks: 12, since: '' },
  goal: { kcal: 2500, p: 150, c: 300, f: 70 },
  xp: 0, ach: {}, water: {}, active: null,
};
const S = {};
Object.keys(DEFAULTS).forEach(k => {
  const v = store.get(k, DEFAULTS[k]);
  S[k] = (v && typeof v === 'object' && !Array.isArray(v) && DEFAULTS[k] && !Array.isArray(DEFAULTS[k]))
    ? { ...DEFAULTS[k], ...v } : v;
});
// 'active' (joriy mashg'ulot) sinxronlanmaydi; qolgan o'zgarishlar vaqti belgilanadi
const save = k => {
  store.set(k, S[k]);
  if (k !== 'active') { store.set('mod', Date.now()); if (window.Sync) Sync.touch(); }
};

const allEx = () => [...EXERCISES, ...S.custom];
const allProgs = () => [...PROGRAMS, ...S.myprogs];
const findProg = id => allProgs().find(p => p.id === id) || PROGRAMS[0];
const LEGACY_EX = { burpee: 'jumpsq', pike: 'inchworm' };   // eski mashq id lari yangilariga yo'naltiriladi
const exById = id => allEx().find(e => e.id === (LEGACY_EX[id] || id));
const gm = g => GROUP_META[g] || { c: '#888', i: '🏋️' };

// ====================== statistika / XP ======================
const levelOf = xp => Math.floor(Math.sqrt(xp / 100)) + 1;
const levelTitle = l => (l < 3 ? 'Boshlovchi' : l < 5 ? 'Havaskor' : l < 8 ? 'Tajribali' : l < 12 ? 'Kuchli' : 'Afsona');

function weekStartKey() {
  const d = new Date(); const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd); return dayKey(d);
}

function calcStreak(days) {
  if (!days.length) return 0;
  let i = days.length - 1;
  if (dayNum(today()) - dayNum(days[i]) > 2) return 0;   // 1 kun dam olishga ruxsat
  let n = 1;
  while (i > 0 && dayNum(days[i]) - dayNum(days[i - 1]) <= 2) { n++; i--; }
  return n;
}

function stats() {
  const days = [...new Set(S.workouts.map(w => w.date))].sort();
  const ws = weekStartKey();
  return {
    ...S, days,
    streak: calcStreak(days),
    volume: S.log.reduce((a, s) => a + s.weight * s.reps, 0),
    groupsDone: new Set(S.log.map(s => exById(s.exId)?.group).filter(Boolean)),
    weekCount: new Set(S.workouts.filter(w => w.date >= ws).map(w => w.date)).size,
    weeklyGoal: S.profile.weeklyGoal,
    prCount: S.workouts.reduce((a, w) => a + (w.prs || 0), 0),
    waterGoalDays: Object.values(S.water).filter(n => n >= WATER_GOAL).length,
    level: levelOf(S.xp),
  };
}

function addXp(n) {
  const before = levelOf(S.xp);
  S.xp += n; save('xp');
  const after = levelOf(S.xp);
  if (after > before) toast(`${after}-daraja! ${levelTitle(after)}`, '🆙');
}

function checkAch() {
  for (let pass = 0; pass < 3; pass++) {
    const st = stats(); let changed = false;
    ACHIEVEMENTS.forEach(a => {
      if (!S.ach[a.id] && a.ok(st)) {
        S.ach[a.id] = today(); changed = true;
        toast(`Yutuq: ${a.n}`, a.i);
        S.xp += 30;
      }
    });
    if (!changed) break;
    save('ach'); save('xp');
  }
}

// ====================== UI: tasdiqlash, toast, sheet, konfetti ======================
// confirm() ba'zi muhitlarda ko'rsatilmaydi, shuning uchun sahifa ichidagi oyna ishlatiladi
function ask(msg, ok = 'Ha') {
  return new Promise(resolve => {
    const d = $('#dlg');
    d.innerHTML = `<div class="dlg-box" role="alertdialog" aria-modal="true"><p>${esc(msg)}</p><div class="row"><button class="btn ghost grow" data-dlg="0">Yo'q</button><button class="btn grow" data-dlg="1">${esc(ok)}</button></div></div>`;
    d.classList.add('open');
    d.onclick = e => {
      const b = e.target.closest('[data-dlg]');
      if (!b && e.target !== d) return;
      d.classList.remove('open'); d.onclick = null; resolve(!!b && b.dataset.dlg === '1');
    };
  });
}
function toast(msg, icon = '✨') {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = `<span>${icon}</span> ${esc(msg)}`;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

let sheetKind = '', pbDay = null;
function openSheet(html, kind = '') { sheetKind = kind; $('#sheetBody').innerHTML = html; $('#sheet').classList.add('open'); if (kind === 'settings' && window.Sync) Sync.mount(); }
function closeSheet() {
  if (pbDay !== null && PB) { progBuilderSheet(); return; }   // mashq tanlashdan chiqilsa, dastur oynasiga qaytamiz
  if (sheetKind === 'exinfo' && libCtx) { groupSheet(libCtx); return; }   // mashq tafsilotidan guruh ro'yxatiga qaytish
  libCtx = null;
  $('#sheet').classList.remove('open'); sheetKind = '';
}

// ====================== import: tekshirish va tozalash ======================
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string';
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isDate = v => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
// Noto'g'ri elementlar tashlab yuboriladi; butunlay yaroqsiz fayl uchun null qaytadi
function sanitizeData(d) {
  if (!isObj(d)) return null;
  const out = {};
  const arr = (k, ok) => { if (d[k] !== undefined) { if (!Array.isArray(d[k])) throw new Error(k); out[k] = d[k].filter(ok); } };
  try {
    arr('workouts', w => isObj(w) && isStr(w.id) && isDate(w.date) && isNum(w.sets) && isNum(w.volume));
    arr('log', s => isObj(s) && isStr(s.exId) && isDate(s.date) && isNum(s.weight) && isNum(s.reps));
    arr('bw', b => isObj(b) && isDate(b.date) && isNum(b.kg));
    arr('meals', m => isObj(m) && isStr(m.id) && isDate(m.date) && isNum(m.kcal));
    arr('custom', e => isObj(e) && isStr(e.id) && isStr(e.name) && isStr(e.group));
    arr('meas', m => isObj(m) && isDate(m.date));
    arr('myprogs', p => isObj(p) && isStr(p.id) && isStr(p.name) && Array.isArray(p.days) && p.days.every(dd => isObj(dd) && Array.isArray(dd.ex)));
    ['profile', 'goal', 'ach', 'water', 'budget', 'cut'].forEach(k => { if (d[k] !== undefined) { if (!isObj(d[k])) throw new Error(k); out[k] = d[k]; } });
    if (d.xp !== undefined) { if (!isNum(d.xp) || d.xp < 0) throw new Error('xp'); out.xp = d.xp; }
    if (d.active !== undefined) out.active = (d.active === null || (isObj(d.active) && Array.isArray(d.active.exs))) ? d.active : null;
    if (out.goal && !['kcal', 'p', 'c', 'f'].every(k => isNum(out.goal[k]))) delete out.goal;
  } catch { return null; }
  return Object.keys(out).length ? out : null;
}
// Tozalangan ma'lumotni holatga qo'llash (defaults bilan birlashtirib)
function applyData(clean) {
  Object.keys(clean).forEach(k => {
    const v = clean[k];
    S[k] = (isObj(v) && isObj(DEFAULTS[k])) ? { ...DEFAULTS[k], ...v } : v;
    store.set(k, S[k]);
  });
  applyTheme();
}

function confetti() {
  const box = document.createElement('div'); box.className = 'confetti';
  const colors = ['#ff7a2f', '#ff3d6e', '#29d3c4', '#fbbf24', '#8b5cf6'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % 5]};animation-delay:${Math.random() * 0.4}s;--dx:${(Math.random() - 0.5) * 200}px;--rot:${Math.random() * 720}deg`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}

function ring(pct, label, sub, color = 'var(--accent)') {
  const r = 38, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return `<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" class="rb"/>
    <circle cx="50" cy="50" r="${r}" class="rf" style="stroke:${color};stroke-dasharray:${(c * p).toFixed(1)} ${c.toFixed(1)}"/></svg>
    <div class="rl"><b>${label}</b><small>${sub}</small></div></div>`;
}

// Mushak xaritasi: chap yarim shakllar markaz (x=60) bo'yicha aks ettiriladi
const MUSCLE_SHAPES = {
  trap: 'M59 33 Q50 40 38 46 Q46 56 59 70 Z',
  delt: 'M31 46 Q22 47 20 60 Q20 68 24 72 Q30 70 34 62 Q38 54 40 48 Q36 45 31 46 Z',
  pec: 'M42 49 Q52 47 59 52 L59 70 Q50 74 40 68 Q36 60 42 49 Z',
  biceps: 'M23 74 Q19 84 21 94 Q26 96 30 93 Q33 84 32 73 Q27 71 23 74 Z',
  triceps: 'M22 74 Q18 84 20 96 Q26 98 31 94 Q34 84 32 73 Q27 70 22 74 Z',
  fore: 'M20 98 Q17 112 18 124 Q22 126 26 124 Q29 112 29 98 Q24 95 20 98 Z',
  obl: 'M40 74 Q36 90 40 106 L48 104 Q46 90 47 76 Z',
  abs: 'M51 77 H59 V85 H51 Z M51 87 H59 V95 H51 Z M52 97 H59 V105 H52 Z M53 107 H59 V114 H53 Z',
  quad: 'M41 122 Q36 140 38 164 Q42 172 52 168 Q58 150 59 124 Q50 118 41 122 Z',
  shin: 'M39 173 Q36 190 40 212 Q45 214 50 210 Q54 192 52 173 Q45 169 39 173 Z',
  lat: 'M38 50 Q34 70 42 90 Q50 98 59 96 L59 72 Q48 62 38 50 Z',
  glute: 'M41 108 Q38 122 46 130 Q56 132 59 122 L59 110 Q50 104 41 108 Z',
  ham: 'M40 134 Q37 152 40 170 Q47 174 55 168 Q58 152 58 134 Q48 138 40 134 Z',
  calf: 'M39 174 Q35 188 40 206 Q46 210 53 204 Q56 190 52 174 Q46 170 39 174 Z',
};

function muscleSvg(group, sec = []) {
  const K = group === 'Kardio';
  const cls = g => (g === group || (K && (g === 'Oyoq' || g === 'Press'))) ? 'p' : sec.includes(g) ? 's' : '';
  const sym = d => `<path d="${d}"/><path d="${d}" transform="matrix(-1 0 0 1 120 0)"/>`;
  const mus = (g, ...keys) => `<g class="m ${cls(g)}">${keys.map(k => sym(MUSCLE_SHAPES[k])).join('')}</g>`;
  const bk = (d, w) => `<path d="${d}" stroke-width="${w}"/><path d="${d}" stroke-width="${w}" transform="matrix(-1 0 0 1 120 0)"/>`;
  const base = `<g class="bk"><path d="M40 48 L80 48 L76 112 L44 112 Z" stroke-width="6"/>${bk('M27 52 L22 96 L20 128', 15)}${bk('M48 112 L44 170 L45 226', 22)}</g>
    <ellipse class="head" cx="60" cy="17" rx="11" ry="13"/><rect class="head" x="54" y="26" width="12" height="14" rx="4"/>`;
  const front = base + mus('Yelka', 'trap', 'delt') + mus('Ko\'krak', 'pec') + mus('Biceps', 'biceps') + `<g class="m">${sym(MUSCLE_SHAPES.fore)}</g>`
    + mus('Press', 'obl', 'abs') + mus('Oyoq', 'quad', 'shin');
  const back = base + mus('Orqa', 'lat') + mus('Yelka', 'delt', 'trap') + mus('Triceps', 'triceps') + `<g class="m">${sym(MUSCLE_SHAPES.fore)}</g>`
    + mus('Oyoq', 'glute', 'ham', 'calf');
  return `<svg class="muscle" viewBox="0 0 250 240" aria-label="Mushak xaritasi">
    <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa24a"/><stop offset="1" stop-color="#ff3d6e"/></linearGradient></defs>
    <g>${front}</g><g transform="translate(130,0)">${back}</g>
    <text x="60" y="238" text-anchor="middle">OLD</text><text x="190" y="238" text-anchor="middle">ORQA</text></svg>`;
}

// ====================== TAB: BOSH SAHIFA ======================
function programDay() {
  const P = findProg(S.profile.program);
  const idx = S.profile.dayIdx % P.days.length;
  return { P, idx, day: P.days[idx] };
}

function renderHome() {
  const st = stats(), lv = st.level;
  const base = 100 * (lv - 1) ** 2, next = 100 * lv ** 2;
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'Xayrli tun' : hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  const ws = weekStartKey(), wsN = dayNum(ws);
  const doneDays = new Set(S.workouts.map(w => w.date));
  const strip = WEEKDAYS.map((d, i) => {
    const key = dayKey(new Date((wsN + i) * 864e5 + 12 * 36e5));
    const cls = doneDays.has(key) ? 'done' : key === today() ? 'now' : '';
    return `<div class="wd ${cls}"><span>${d}</span><i>${doneDays.has(key) ? '✓' : ''}</i></div>`;
  }).join('');

  const { P, idx, day } = programDay();
  const sets = day.ex.reduce((a, e) => a + e[1], 0);
  const meals = S.meals.filter(m => m.date === today());
  const kcal = meals.reduce((a, m) => a + m.kcal, 0);
  const water = S.water[today()] || 0;
  const lastAch = Object.entries(S.ach).sort((a, b) => b[1].localeCompare(a[1]))[0];
  const la = lastAch && ACHIEVEMENTS.find(a => a.id === lastAch[0]);

  const [title, ...rest] = day.name.split(' · '), sub = rest.join(', ');
  const kcalPct = S.goal.kcal ? Math.min(100, kcal / S.goal.kcal * 100) : 0;

  $('#tab-home').innerHTML = `
    <div class="greet"><small>${greet}</small><h2>${esc(S.profile.name || 'Chempion')}</h2></div>
    ${window.Cut ? Cut.homeCard() : ''}

    <section class="hero today">
      <div class="hero-meta">${esc(P.name)}, ${idx + 1}-kun (${P.days.length} tadan)</div>
      <h2 class="hero-title">${esc(title)}</h2>
      ${sub ? `<p class="hero-sub">${esc(sub)}</p>` : ''}
      <p class="hero-facts">${day.ex.length} mashq, ${sets} set, taxminan ${Math.round(sets * 2.8)} daqiqa</p>
      <button class="btn lg block" data-act="${S.active ? 'wk-open' : 'start-day'}">${S.active ? 'Davom etish' : 'Boshlash'}</button>
      ${S.active ? `<span class="hero-resume">${esc(S.active.name)} hozir davom etmoqda</span>` : ''}
    </section>

    <section class="week">
      <div class="week-head"><h3>Bu hafta</h3><b>${st.weekCount} / ${st.weeklyGoal}</b></div>
      <div class="weekstrip">${strip}</div>
    </section>

    <div class="duo">
      <div class="kv"><span class="num ${st.streak ? 'hot' : ''}">${st.streak}</span><small>kun ketma-ket</small></div>
      <div class="kv"><span class="num">${lv}</span><small>${levelTitle(lv)}, ${S.xp - base} / ${next - base} XP</small>
        <div class="bar"><div style="width:${((S.xp - base) / (next - base)) * 100}%"></div></div></div>
    </div>

    <div class="daylog">
      <div class="dl" data-go="diet"><div class="grow"><b>Kaloriya</b><small>${Math.round(kcal)} / ${S.goal.kcal} kkal</small><div class="bar"><div class="${kcal > S.goal.kcal ? 'over' : ''}" style="width:${kcalPct}%"></div></div></div></div>
      <div class="dl"><div class="grow"><b>Suv</b><small>${water * 250} ml, maqsad ${WATER_GOAL} stakan</small></div>
        <div class="stepper"><button data-act="water-" aria-label="Kamaytirish">−</button><b>${water}</b><button class="plus" data-act="water+" aria-label="Qo'shish">+</button></div></div>
    </div>
    ${la ? `<div class="card ach-last"><span class="ai">${la.i}</span><div><small>Oxirgi yutuq</small><b>${esc(la.n)}</b><small>${esc(la.d)}</small></div></div>` : ''}`;
}

// ====================== TAB: MASHG'ULOT ======================
// Yig'iladigan bo'limlar: ochiq/yopiq holat qayta chizilganda ham saqlanadi
const FOLD = {};
const foldAttr = k => `data-fold="${k}"${FOLD[k] ? ' open' : ''}`;
document.addEventListener('toggle', e => { const k = e.target && e.target.dataset && e.target.dataset.fold; if (k) FOLD[k] = e.target.open; }, true);

function renderTrain() {
  const cur = findProg(S.profile.program);
  const next = S.profile.dayIdx % cur.days.length;
  const recent = [...S.workouts].reverse().slice(0, 6);
  $('#tab-train').innerHTML = `
    ${S.active ? `<div class="card resume" data-act="wk-open"><b>Mashg'ulot davom etmoqda</b><small>${esc(S.active.name)} — ochish uchun bosing</small></div>` : ''}
    <h3 class="sec">Dastur tanlang</h3>
    <div class="hscroll">${allProgs().map(p => `<button class="pcard ${p.id === cur.id ? 'on' : ''}" data-act="pick-prog" data-id="${p.id}">
      <b>${p.custom ? '⭐ ' : ''}${esc(p.name)}</b><small>${esc(p.tag)}</small><span>${esc(p.desc)}</span></button>`).join('')}
      <button class="pcard add" data-act="pb-new"><b>＋ O'z dasturim</b><span>Kunlar va mashqlarni o'zingiz tuzing</span></button></div>
    <div class="sec-row"><h3 class="sec">${esc(cur.name)} kunlari</h3>${cur.custom ? `<span class="row"><button class="btn sm ghost" data-act="pb-edit" data-id="${esc(cur.id)}">✏️ Tahrirlash</button><button class="btn sm ghost danger" data-act="pb-del" data-id="${esc(cur.id)}" aria-label="Dasturni o'chirish">🗑</button></span>` : ''}</div>
    <div class="list">${cur.days.map((d, i) => `<div class="card day ${i === next ? 'next' : ''}">
      <div class="dh"><div><b>${esc(d.name)}</b><small class="mute">${d.ex.length} mashq · ${d.ex.reduce((a, e) => a + e[1], 0)} set</small></div>
      ${i === next ? '<span class="pill">Navbatdagi</span>' : ''}</div>
      ${(() => { const ol = `<ol class="exl">${d.ex.map(e => `<li data-act="ex-info" data-ex="${e[0]}"><span>${esc(exById(e[0])?.name || e[0])}</span><em>${e[1]}×${e[2]}</em></li>`).join('')}</ol>`;
        return i === next ? ol : `<details class="exfold" ${foldAttr('day' + i)}><summary>Mashqlar ro'yxati</summary>${ol}</details>`; })()}
      <button class="btn ${i === next ? '' : 'ghost'} block" data-act="start-day" data-idx="${i}">Boshlash</button></div>`).join('')}</div>
    <button class="btn ghost block" data-act="start-empty">+ Bo'sh mashg'ulot</button>
    <h3 class="sec">So'nggi mashg'ulotlar</h3>
    <div class="list">${recent.length ? recent.map(w => `<div class="item"><div><b>${esc(w.name)}</b><small>${fmtDate(w.date)} · ${w.sets} set · ${fmtTime(w.dur).replace(/^00:/, '')} daq</small></div>
      <div class="r"><b>${(w.volume / 1000).toFixed(1)} t</b>${w.prs ? `<small>🏆 ${w.prs} rekord</small>` : ''}</div>
      <button class="x" data-act="del-workout" data-id="${w.id}" aria-label="O'chirish">✕</button></div>`).join('') : '<div class="empty">Hali mashg\'ulot yo\'q. Birinchisini boshlang!</div>'}</div>`;
}

// ====================== FAOL MASHG'ULOT ======================
let wkOpen = false, wkTimer = null;

function lastSets(exId) {
  const rows = S.log.filter(s => s.exId === exId);
  if (!rows.length) return [];
  const d = rows.reduce((m, s) => (s.date > m ? s.date : m), '');
  return rows.filter(s => s.date === d);
}

function makeEx(exId, nSets, target, rest) {
  const last = lastSets(exId), first = parseInt(target, 10) || 10;
  const sets = Array.from({ length: nSets }, (_, i) => {
    const l = last[i] || last[last.length - 1];
    return { w: l ? l.weight : '', r: l ? l.reps : first, done: false };
  });
  return { exId, target, rest, sets };
}

function startWk(name, items, prog, dayIdx) {
  S.active = { id: uid(), name, start: Date.now(), prog, dayIdx, exs: items.map(i => makeEx(...i)) };
  save('active'); wkOpen = true; renderWk();
}

function renderWk() {
  const a = S.active, el = $('#wk');
  if (!a || !wkOpen) { el.classList.remove('open'); clearInterval(wkTimer); wkTimer = null; wakeOff(); renderResumeBar(); return; }
  el.classList.add('open'); renderResumeBar(); wakeOn();
  const keep = $('#wkScroll') ? $('#wkScroll').scrollTop : 0;
  const total = a.exs.reduce((n, e) => n + e.sets.length, 0);
  const done = a.exs.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  el.innerHTML = `
    <div class="wk-head"><button class="ico" data-act="wk-min" aria-label="Kichraytirish">⌄</button>
      <div class="grow"><b>${esc(a.name)}</b><small><span id="wkTime"></span> · <span id="wkCount">${done}/${total} set</span></small></div>
      ${window.Voice && Voice.supported ? `<button class="ico ${S.profile.voice ? 'on' : ''}" data-act="voice-toggle" aria-label="Ovozli yordamchi" aria-pressed="${!!S.profile.voice}">${S.profile.voice ? '🔊' : '🔈'}</button>` : ''}
      <button class="btn sm" data-act="wk-finish">Tugatish</button></div>
    <div class="bar thin"><div id="wkBar" style="width:${total ? (done / total) * 100 : 0}%"></div></div>
    <div id="wkScroll" class="wk-scroll">
      ${a.exs.map((e, xi) => {
        const ex = exById(e.exId), last = lastSets(e.exId);
        return `<div class="excard"><div class="exh">${ANIM[e.exId]
          ? `<img class="thumb" src="${ANIM_BASE}${ANIM[e.exId]}/0.jpg" alt="" loading="lazy" data-act="ex-info" data-ex="${esc(e.exId)}" onerror="this.outerHTML='<span class=&quot;gdot&quot; style=&quot;background:${gm(ex?.group).c}&quot;></span>'">`
          : `<span class="gdot" style="background:${gm(ex?.group).c}"></span>`}
          <div class="grow"><b>${esc(ex ? ex.name : 'Noma\'lum')}</b><small>Maqsad ${e.sets.length}×${esc(e.target)} · dam ${e.rest}s</small></div>
          <button class="ico" data-act="ex-info" data-ex="${e.exId}" aria-label="Ma'lumot">ⓘ</button>
          <button class="ico" data-act="ex-del" data-xi="${xi}" aria-label="Olib tashlash">✕</button></div>
          <div class="sethead"><span>SET</span><span>OLDIN</span><span>KG</span><span>TAKROR</span><span></span></div>
          ${e.sets.map((s, si) => `<div class="setrow ${s.done ? 'done' : ''}"><span class="sn">${si + 1}</span>
            <span class="prev">${last[si] ? `${last[si].weight}×${last[si].reps}` : '–'}</span>
            <input type="number" inputmode="decimal" step="0.5" min="0" value="${esc(s.w)}" data-xi="${xi}" data-si="${si}" data-f="w" aria-label="Vazn">
            <input type="number" inputmode="numeric" min="0" value="${esc(s.r)}" data-xi="${xi}" data-si="${si}" data-f="r" aria-label="Takror">
            <button class="chk" data-act="set-done" data-xi="${xi}" data-si="${si}" aria-label="Bajarildi">✓</button></div>`).join('')}
          <button class="link" data-act="set-add" data-xi="${xi}">+ Set qo'shish</button></div>`;
      }).join('')}
      <button class="btn ghost block" data-act="wk-add">+ Mashq qo'shish</button>
      <button class="link danger" data-act="wk-cancel">Mashg'ulotni bekor qilish</button>
    </div>`;
  $('#wkScroll').scrollTop = keep;
  tickWk();
  if (!wkTimer) wkTimer = setInterval(tickWk, 1000);
}

// Set belgilanganda ro'yxatni qayta chizmasdan faqat hisoblagichni yangilaydi (fokus va scroll saqlanadi)
function updateWkProgress() {
  const a = S.active; if (!a) return;
  const total = a.exs.reduce((n, e) => n + e.sets.length, 0);
  const done = a.exs.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  const c = $('#wkCount'), b = $('#wkBar');
  if (c) c.textContent = `${done}/${total} set`;
  if (b) b.style.width = (total ? (done / total) * 100 : 0) + '%';
}

function tickWk() {
  const t = $('#wkTime');
  if (t && S.active) t.textContent = fmtTime(Math.floor((Date.now() - S.active.start) / 1000));
}

function renderResumeBar() {
  const bar = $('#resumeBar');
  bar.classList.toggle('on', !!S.active && !wkOpen);
  if (S.active) $('#resumeName').textContent = S.active.name;
}

async function finishWk() {
  const a = S.active;
  const sets = [];
  a.exs.forEach(e => e.sets.filter(s => s.done).forEach(s => sets.push({ exId: e.exId, weight: +s.w || 0, reps: +s.r || 0 })));
  if (!sets.length) {
    if (await ask('Hech qanday set belgilanmagan. Mashg\'ulotni bekor qilamizmi?', 'Bekor qilish')) cancelWk();
    return;
  }
  const best = {};
  S.log.forEach(s => { best[s.exId] = Math.max(best[s.exId] ?? 0, s.weight); });
  const prSet = new Set();
  sets.forEach(s => { if (best[s.exId] !== undefined && s.weight > best[s.exId]) prSet.add(s.exId); });

  const wid = a.id, date = today();
  const volume = sets.reduce((n, s) => n + s.weight * s.reps, 0);
  const dur = Math.round((Date.now() - a.start) / 1000);
  const xp = sets.length * 10 + 50 + prSet.size * 25;
  sets.forEach(s => S.log.push({ id: uid(), wid, date, ...s }));
  S.workouts.push({ id: wid, date, name: a.name, dur, sets: sets.length, volume, prs: prSet.size, prog: a.prog, xp });

  if (a.prog && a.prog === S.profile.program) {
    const P = findProg(a.prog);
    S.profile.dayIdx = ((a.dayIdx ?? S.profile.dayIdx) + 1) % P.days.length;
    save('profile');
  }
  S.active = null; wkOpen = false;
  save('active'); save('log'); save('workouts');
  stopRest(); addXp(xp); checkAch();
  renderWk(); renderAll(); confetti();

  openSheet(`<div class="summary"><div class="big-emoji">🎉</div><h2>Ajoyib mashg'ulot!</h2>
    <div class="stats3"><div><b>${fmtTime(dur).replace(/^00:/, '')}</b><small>daqiqa</small></div><div><b>${sets.length}</b><small>set</small></div><div><b>${Math.round(volume)}</b><small>kg hajm</small></div></div>
    <p class="xpgain">+${xp} XP</p>${prSet.size ? `<p>🏆 ${prSet.size} ta yangi shaxsiy rekord!</p>` : ''}
    <button class="btn block" data-act="close-sheet">Yopish</button></div>`);
}

function cancelWk() {
  S.active = null; wkOpen = false; save('active'); stopRest(); renderWk(); renderAll();
}

function exPickerSheet(forWorkout) {
  openSheet(`<h2>Mashq tanlang</h2><input id="pickSearch" type="search" placeholder="Qidirish..." autocomplete="off">
    <div id="pickList" class="list pick"></div>`);
  const draw = () => {
    const q = $('#pickSearch').value.trim().toLowerCase();
    $('#pickList').innerHTML = allEx().filter(e => e.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q))
      .map(e => `<button class="item btnrow" data-act="pick-ex" data-ex="${e.id}"><span class="gdot" style="background:${gm(e.group).c}"></span><span class="grow">${esc(e.name)}</span><span class="tag">${esc(e.group)}</span></button>`).join('')
      || '<div class="empty">Topilmadi</div>';
  };
  $('#pickSearch').addEventListener('input', draw); draw();
}

// ====================== O'Z DASTURINI TUZISH ======================
let PB = null;   // tahrirlanayotgan dastur nusxasi

function pbNew() {
  PB = { id: null, name: '', days: [{ name: 'Kun 1', ex: [] }] };
  progBuilderSheet();
}
function pbEdit(id) {
  const p = S.myprogs.find(x => x.id === id); if (!p) return;
  PB = { id: p.id, name: p.name, days: JSON.parse(JSON.stringify(p.days)) };
  progBuilderSheet();
}
function progBuilderSheet() {
  pbDay = null;
  const keep = $('#sheet .sheet-panel') ? $('#sheet .sheet-panel').scrollTop : 0;
  openSheet(`<h2>${PB.id ? 'Dasturni tahrirlash' : 'Yangi dastur'}</h2><div class="stack">
    <label>Dastur nomi<input data-pb="name" value="${esc(PB.name)}" maxlength="40" placeholder="Masalan: Mening split"></label>
    ${PB.days.map((d, di) => `<div class="card pbday">
      <div class="row"><input data-pb="dname" data-di="${di}" value="${esc(d.name)}" maxlength="40" placeholder="Kun nomi" aria-label="Kun nomi">
        ${PB.days.length > 1 ? `<button class="x" data-act="pb-day-del" data-di="${di}" aria-label="Kunni o'chirish">🗑</button>` : ''}</div>
      ${d.ex.length ? `<div class="pbhead"><span class="grow">Mashq</span><span>Set</span><span>Takror</span><span>Dam s</span><span></span></div>` : ''}
      ${d.ex.map((e, xi) => `<div class="pbex"><span class="grow">${esc(exById(e[0])?.name || e[0])}</span>
        <input type="number" inputmode="numeric" min="1" max="12" value="${e[1]}" data-pb="sets" data-di="${di}" data-xi="${xi}" aria-label="Set">
        <input value="${esc(e[2])}" maxlength="8" data-pb="reps" data-di="${di}" data-xi="${xi}" aria-label="Takror">
        <input type="number" inputmode="numeric" min="10" max="600" step="5" value="${e[3]}" data-pb="rest" data-di="${di}" data-xi="${xi}" aria-label="Dam olish (soniya)">
        <button class="x" data-act="pb-ex-del" data-di="${di}" data-xi="${xi}" aria-label="Mashqni olib tashlash">✕</button></div>`).join('')}
      <button class="link" data-act="pb-ex-add" data-di="${di}">+ Mashq qo'shish</button></div>`).join('')}
    <button class="btn ghost" data-act="pb-day-add">+ Kun qo'shish</button>
    <button class="btn" data-act="pb-save">Saqlash</button></div>`, 'pb');
  $('#sheet .sheet-panel').scrollTop = keep;
}
function pbSave() {
  PB.name = PB.name.trim();
  if (!PB.name) { toast('Dastur nomini kiriting', '⚠️'); return; }
  const bad = PB.days.findIndex(d => !d.ex.length);
  if (bad >= 0) { toast(`"${PB.days[bad].name || 'Kun ' + (bad + 1)}" kunida mashq yo'q`, '⚠️'); return; }
  const days = PB.days.map((d, i) => ({
    name: d.name.trim() || `Kun ${i + 1}`,
    ex: d.ex.map(([id, n, r, rs]) => [id, Math.min(12, Math.max(1, +n || 3)), String(r || '10').trim() || '10', Math.min(600, Math.max(10, +rs || 90))]),
  }));
  const prog = { id: PB.id || 'u' + uid(), name: PB.name, tag: `${days.length} kun · Maxsus`, desc: `${days.reduce((a, d) => a + d.ex.length, 0)} ta mashq · sizning dasturingiz`, days, custom: true };
  const i = S.myprogs.findIndex(p => p.id === prog.id);
  if (i >= 0) S.myprogs[i] = prog; else S.myprogs.push(prog);
  save('myprogs');
  if (i < 0 || S.profile.program === prog.id) { S.profile.program = prog.id; S.profile.dayIdx = 0; save('profile'); }
  PB = null; closeSheet(); renderAll(); toast('Dastur saqlandi', '⭐');
}

// ====================== TAB: MASHQLAR ======================
let libCtx = null;   // ochiq guruh oynasi (mashq tafsilotidan keyin shu yerga qaytamiz)
function renderLib() {
  const keepQ = $('#libSearch') ? $('#libSearch').value : '';
  const hadFocus = document.activeElement && document.activeElement.id === 'libSearch';
  const all = allEx();
  $('#tab-lib').innerHTML = `
    <input id="libSearch" type="search" placeholder="Qidirish · ${all.length} ta mashq" value="${esc(keepQ)}" autocomplete="off">
    <div id="libGrid"></div>
    <div id="libTiles" class="gtiles">${GROUPS.map(g => { const n = all.filter(e => e.group === g).length; return `<button class="gtile" data-act="lib-open" data-g="${esc(g)}" style="--c:${gm(g).c}"><i class="gd" style="background:${gm(g).c}"></i><b>${esc(g)}</b><small>${n} ta mashq</small></button>`; }).join('')}</div>
    <details class="card"><summary>+ O'z mashqingizni qo'shish</summary>
      <form id="customForm" class="stack"><input name="name" placeholder="Mashq nomi" required maxlength="60">
        <select name="group">${GROUPS.map(g => `<option>${esc(g)}</option>`).join('')}</select>
        <button class="btn">Qo'shish</button></form></details>`;
  drawLibGrid();
  if (hadFocus) { const i = $('#libSearch'); i.focus(); i.setSelectionRange(keepQ.length, keepQ.length); }
}

const exRow = e => `<button class="exrow" data-act="ex-info" data-ex="${esc(e.id)}" style="--c:${gm(e.group).c}">
  ${ANIM[e.id] ? `<img class="thumb" src="${ANIM_BASE}${ANIM[e.id]}/0.jpg" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="thumb ph"><i class="gd" style="background:${gm(e.group).c}"></i></span>`}
  <span class="grow"><b>${esc(e.name)}</b><small>${esc(e.equip || 'Maxsus')}${e.level ? ' · ' + esc(LEVELS[e.level]) : ''}</small></span><span class="chev">›</span></button>`;

// Qidiruv: natijalar ro'yxat bo'lib chiqadi, bo'sh bo'lsa guruh kartalari ko'rinadi
function drawLibGrid() {
  const q = $('#libSearch').value.trim().toLowerCase();
  $('#libTiles').hidden = !!q;
  $('#libGrid').innerHTML = !q ? '' : (() => {
    const list = allEx().filter(e => e.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q));
    return list.length ? `<div class="exlist">${list.map(exRow).join('')}</div>` : '<div class="empty">Hech narsa topilmadi</div>';
  })();
}
function groupSheet(g) {
  libCtx = g;
  const list = allEx().filter(e => e.group === g);
  openSheet(`<h2><i class="gd" style="background:${gm(g).c};margin-right:8px"></i>${esc(g)}</h2><p class="mute small">${list.length} ta mashq</p><div class="exlist">${list.map(exRow).join('')}</div>`, 'libgroup');
}

function exInfoSheet(id) {
  const e = exById(id); if (!e) return;
  const sets = S.log.filter(s => s.exId === id);
  const best = sets.reduce((m, s) => (s.weight > m ? s.weight : m), 0);
  const e1 = sets.reduce((m, s) => Math.max(m, s.weight * (1 + s.reps / 30)), 0);
  const stepsHtml = e.steps ? `<h4>Texnika</h4><ol class="steps">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '';
  openSheet(`<div class="exinfo" style="--c:${gm(e.group).c}">
    <h2>${esc(e.name)}</h2>
    <div class="badges"><span class="tag" style="--c:${gm(e.group).c}"><i class="gd" style="background:${gm(e.group).c};margin-right:6px"></i>${esc(e.group)}</span><span class="tag">${esc(e.equip || 'Maxsus')}</span>${e.level ? `<span class="tag">${LEVELS[e.level]}</span>` : ''}</div>
    ${ANIM[id] ? `<div class="animwrap"><div class="anim" data-act="anim-toggle" title="To'xtatish / davom ettirish">
      <img src="${ANIM_BASE}${ANIM[id]}/0.jpg" alt="${esc(e.name)} — boshlang'ich holat" loading="lazy" onerror="this.closest('.animwrap').remove()">
      <img class="b" src="${ANIM_BASE}${ANIM[id]}/1.jpg" alt="${esc(e.name)} — oxirgi holat" loading="lazy" onerror="this.closest('.animwrap').remove()">
      <span class="play">⏸</span></div><small class="center">Boshlang'ich ↔ oxirgi holat · to'xtatish uchun bosing</small></div>` : ''}
    ${muscleSvg(e.group, e.sec || [])}
    <p class="legend"><i class="p"></i> Asosiy <i class="s"></i> Yordamchi${e.sec?.length ? ': ' + esc(e.sec.join(', ')) : ''}</p>
    ${stepsHtml}${e.tip ? `<div class="tip">💡 ${esc(e.tip)}</div>` : ''}
    ${sets.length ? `<div class="stats3"><div><b>${best} kg</b><small>Eng og'ir</small></div><div><b>${Math.round(e1)} kg</b><small>Taxm. 1RM</small></div><div><b>${sets.length}</b><small>Jami set</small></div></div>` : ''}
    ${S.active ? `<button class="btn block" data-act="pick-ex" data-ex="${esc(e.id)}">Mashg'ulotga qo'shish</button>` : ''}
    ${e.custom ? `<button class="btn ghost block danger" data-act="del-custom" data-ex="${esc(e.id)}">O'chirish</button>` : ''}
  </div>`, 'exinfo');
}

// ====================== TAB: DIETA ======================
const round5 = n => Math.max(5, Math.round(n / 5) * 5);
const macroOf = (food, g) => ({ k: food.k * g / 100, p: food.p * g / 100, c: food.c * g / 100, f: food.f * g / 100 });
const sumM = list => list.reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 });

function buildPlan() {
  const plan = MEAL_PLANS[S.profile.planGoal] || MEAL_PLANS.massa;
  const variant = plan.variants[S.profile.planVar % plan.variants.length];
  const baseTotal = sumM(variant.flatMap(([, items]) => items.map(([id, g]) => macroOf(FOODS[id], g)))).k;
  const factor = Math.max(0.5, Math.min(2, S.goal.kcal / baseTotal));
  return variant.map(([name, items]) => {
    const rows = items.map(([id, g]) => { const gr = round5(g * factor); return { id, food: FOODS[id], g: gr, m: macroOf(FOODS[id], gr) }; });
    return { name, rows, t: sumM(rows.map(r => r.m)) };
  });
}

function renderDiet() {
  const g = S.goal, meals = S.meals.filter(m => m.date === today());
  const tot = meals.reduce((a, m) => ({ k: a.k + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 });
  const water = S.water[today()] || 0;
  const bar = (label, v, goal, unit) => `<div class="macro"><div class="lbl"><span>${label}</span><span>${Math.round(v)} / ${goal} ${unit}</span></div>
    <div class="bar"><div class="${v > goal ? 'over' : ''}" style="width:${goal ? Math.min(100, v / goal * 100) : 0}%"></div></div></div>`;
  const plan = buildPlan(), pg = MEAL_PLANS[S.profile.planGoal] ? S.profile.planGoal : 'massa';
  const planTot = sumM(plan.map(m => m.t));

  $('#tab-diet').innerHTML = `
    ${window.Cut ? Cut.dietCard() : ''}
    <div class="card fade"><div class="dsum">${ring(g.kcal ? tot.k / g.kcal : 0, Math.round(tot.k), `/ ${g.kcal} kkal`, 'var(--ok)')}
      <div class="grow">${bar('Oqsil', tot.p, g.p, 'g')}${bar('Uglevod', tot.c, g.c, 'g')}${bar('Yog\'', tot.f, g.f, 'g')}</div></div>
      <div class="water"><span>Suv</span><div class="glasses">${Array.from({ length: WATER_GOAL }, (_, i) => `<button class="${i < water ? 'on' : ''}" data-act="water-set" data-n="${i + 1}" aria-label="${i + 1}-stakan"></button>`).join('')}</div><small>${water * 250} ml</small></div></div>

    <h3 class="sec">Bugungi ovqatlar</h3>
    <div class="list">${meals.length ? meals.map(m => `<div class="item"><div><b>${esc(m.name)}</b><small>${Math.round(m.kcal)} kkal · O ${Math.round(m.p)} · U ${Math.round(m.c)} · Y ${Math.round(m.f)}</small></div>
      <button class="x" data-act="del-meal" data-id="${m.id}" aria-label="O'chirish">✕</button></div>`).join('') : '<div class="empty">Bugun hali ovqat kiritilmagan</div>'}</div>
    <h3 class="sec">Tez qo'shish</h3>
    <form id="foodForm" class="card stack"><select name="food" id="foodSel">${[['🇺🇿 Milliy taomlar va mevalar', e => e[1].uz], ['Boshqa mahsulotlar', e => !e[1].uz]].map(([lbl, fn]) => `<optgroup label="${lbl}">${Object.entries(FOODS).filter(fn).map(([id, f]) => `<option value="${id}">${esc(f.n)}</option>`).join('')}</optgroup>`).join('')}</select>
      <div class="row"><input name="g" id="foodG" type="number" inputmode="numeric" min="1" value="100" aria-label="Gramm"><span class="unit">gramm</span><button class="btn">Qo'shish</button></div>
      <small class="mute" id="foodPrev"></small><small class="mute">Milliy taomlar qiymatlari taxminiy: retsept va porsiyaga qarab farq qiladi.</small></form>
    <details class="card"><summary>Qo'lda kiritish</summary><form id="mealForm" class="grid2f">
      <input class="full" name="name" placeholder="Ovqat nomi" required maxlength="60"><input name="kcal" type="number" min="0" placeholder="kkal" required>
      <input name="p" type="number" min="0" placeholder="Oqsil g"><input name="c" type="number" min="0" placeholder="Uglevod g"><input name="f" type="number" min="0" placeholder="Yog' g">
      <button class="btn full">Qo'shish</button></form></details>

    <details class="fold" ${foldAttr('plan')}><summary>Ovqatlanish rejasi</summary>
    <div class="seg">${Object.entries(MEAL_PLANS).map(([k, p]) => `<button class="${k === pg ? 'on' : ''}" data-act="plan-goal" data-k="${k}">${esc(p.name)}</button>`).join('')}</div>
    <div class="seg small">${MEAL_PLANS[pg].variants.map((_, i) => `<button class="${i === S.profile.planVar % MEAL_PLANS[pg].variants.length ? 'on' : ''}" data-act="plan-var" data-i="${i}">Variant ${'AB'[i]}</button>`).join('')}</div>
    <p class="mute small">Reja ${g.kcal} kkal maqsadingizga moslashtirildi: ${Math.round(planTot.k)} kkal · O ${Math.round(planTot.p)} · U ${Math.round(planTot.c)} · Y ${Math.round(planTot.f)}</p>
    <div class="list">${plan.map((m, mi) => `<div class="card meal"><div class="dh"><div><b>${esc(m.name)}</b><small class="mute">${Math.round(m.t.k)} kkal · O ${Math.round(m.t.p)} · U ${Math.round(m.t.c)} · Y ${Math.round(m.t.f)}</small></div>
      <button class="btn sm" data-act="plan-add" data-mi="${mi}">+ Qo'shish</button></div>
      <ul class="foods">${m.rows.map(r => `<li><span>${esc(r.food.n)}</span><em>${r.g} g${r.food.piece ? ` (~${round1(r.g / r.food.piece)} dona)` : ''}</em></li>`).join('')}</ul></div>`).join('')}
      <button class="btn ghost block" data-act="plan-add-all">Butun rejani bugunga qo'shish</button></div></details>
    ${window.Budget ? Budget.html() : ''}

    <details class="card fold" ${foldAttr('calc')}><summary>Kunlik maqsadni hisoblash</summary>
      <form id="calcForm" class="grid2f">
        <select name="sex"><option value="m">Erkak</option><option value="f">Ayol</option></select>
        <input name="age" type="number" inputmode="numeric" placeholder="Yosh" min="12" max="90" required>
        <input name="height" type="number" inputmode="numeric" placeholder="Bo'y (sm)" min="120" max="230" required>
        <input name="weight" type="number" inputmode="decimal" step="0.1" placeholder="Vazn (kg)" min="30" max="250" required>
        <select name="activity"><option value="1.375">Kam faol (1–3 mashg'ulot)</option><option value="1.55" selected>O'rtacha (3–5)</option><option value="1.725">Juda faol (6–7)</option></select>
        <select name="aim"><option value="-450">Vazn tashlash</option><option value="0">Saqlash</option><option value="350" selected>Massa yig'ish</option></select>
        <label>Oqsil (g / kg vazn)<input name="pPerKg" type="number" inputmode="decimal" step="0.1" min="0.8" max="3.5" value="${S.profile.pPerKg}" required></label>
        <label>Yog' (% kaloriyadan)<input name="fatPct" type="number" inputmode="numeric" step="1" min="15" max="45" value="${S.profile.fatPct}" required></label>
        <small class="full mute">Uglevod qolgan kaloriyadan avtomatik hisoblanadi. Odatda: oqsil 1.6–2.2 g/kg, yog' 20–30%.</small>
        <button class="btn full">Hisoblash va saqlash</button></form>
      <form id="goalForm" class="grid2f"><small class="full mute">Yoki qo'lda kiriting:</small>
        <input name="kcal" type="number" value="${g.kcal}" aria-label="Kaloriya"><input name="p" type="number" value="${g.p}" aria-label="Oqsil">
        <input name="c" type="number" value="${g.c}" aria-label="Uglevod"><input name="f" type="number" value="${g.f}" aria-label="Yog'">
        <button class="btn ghost full">Saqlash</button></form></details>`;
  updateFoodPreview();
}

function updateFoodPreview() {
  const sel = $('#foodSel'); if (!sel) return;
  const m = macroOf(FOODS[sel.value], +$('#foodG').value || 0);
  $('#foodPrev').textContent = `${Math.round(m.k)} kkal · O ${round1(m.p)} · U ${round1(m.c)} · Y ${round1(m.f)}`;
}

function addMeal(name, m) {
  S.meals.push({ id: uid(), date: today(), name, kcal: Math.round(m.k), p: round1(m.p), c: round1(m.c), f: round1(m.f) });
  save('meals');
}

// ====================== TAB: PROGRESS ======================
let progEx = null;

function lineChart(points, unit) {
  if (points.length < 2) return '<div class="empty">Grafik uchun kamida 2 ta yozuv kerak</div>';
  const W = 320, H = 160, P = 30;
  const ys = points.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const x = i => P + (i * (W - P - 10)) / (points.length - 1);
  const y = v => H - P - ((v - min) / (max - min)) * (H - P * 2);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik"><defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <line x1="${P}" y1="${H - P}" x2="${W - 6}" y2="${H - P}" class="axis"/>
    <text x="2" y="${y(max) + 4}" class="ax">${round1(max)}</text><text x="2" y="${y(min) + 4}" class="ax">${round1(min)}</text>
    <text x="${P}" y="${H - 10}" class="ax">${esc(points[0].label)}</text><text x="${W - 6}" y="${H - 10}" class="ax" text-anchor="end">${esc(points.at(-1).label)}</text>
    <path d="${area}" fill="url(#gA)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3.5" fill="var(--accent)"><title>${esc(p.label)}: ${p.y} ${unit}</title></circle>`).join('')}</svg>`;
}


// ====================== PROGRESS RASMLARI (faqat shu qurilmada, IndexedDB) ======================
const PHOTO_KINDS = [['front', 'Old'], ['side', 'Yon'], ['back', 'Orqa']];
let photoSel = [], photoList = [], photoUrls = {};

const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('gymtrack-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' });
      r.onsuccess = () => { this.db = r.result; res(r.result); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction('p', mode), q = fn(t.objectStore('p')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); });
  },
  all() { return this.tx('readonly', s => s.getAll()); },
  put(v) { return this.tx('readwrite', s => s.put(v)); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); },
};

// Rasmni 1080 px gacha kichraytirib JPEG ga o'giradi (telefon rasmlari 5–10 MB bo'ladi)
async function shrinkPhoto(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, 1080 / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.8));
}

function photoCard() {
  return `<details class="card fold" ${foldAttr('photo')}><summary>Progress rasmlari <small>faqat shu qurilmada</small></summary>
    <div class="row"><select id="photoKind" aria-label="Rasm turi">${PHOTO_KINDS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
      <label class="btn ghost filebtn grow center">📷 Rasm qo'shish<input type="file" id="photoFile" accept="image/*" hidden></label></div>
    <div id="photoBox"><div class="empty">Yuklanmoqda…</div></div>
    <p class="mute small">Taqqoslash uchun ikkita rasmni belgilang. Rasmlar bulutga yuborilmaydi va eksportga kirmaydi; brauzer ma'lumotlari tozalansa yo'qoladi.</p></details>`;
}

async function loadPhotos() {
  const box = $('#photoBox'); if (!box) return;
  try { photoList = (await idb.all()).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)); }
  catch { box.innerHTML = '<div class="empty">Bu brauzerda rasm saqlash imkoni yo\'q</div>'; return; }
  Object.values(photoUrls).forEach(u => URL.revokeObjectURL(u)); photoUrls = {};
  photoList.forEach(p => { photoUrls[p.id] = URL.createObjectURL(p.blob); });
  photoSel = photoSel.filter(id => photoList.some(p => p.id === id));
  drawPhotos();
}

function nearestBw(date) {
  const t = dayNum(date); let best = null;
  S.bw.forEach(b => { const d = Math.abs(dayNum(b.date) - t); if (d <= 7 && (!best || d < best.d)) best = { d, kg: b.kg }; });
  return best ? best.kg : null;
}

function drawPhotos() {
  const box = $('#photoBox'); if (!box) return;
  if (!photoList.length) { box.innerHTML = '<div class="empty">Hali rasm yo\'q. Birinchi "oldin" rasmini qo\'shing</div>'; return; }
  const kind = k => (PHOTO_KINDS.find(x => x[0] === k) || [0, ''])[1];
  let cmp = '';
  if (photoSel.length === 2) {
    const [a, b] = photoSel.map(id => photoList.find(p => p.id === id)).sort((x, y) => x.date.localeCompare(y.date));
    const days = dayNum(b.date) - dayNum(a.date), wa = nearestBw(a.date), wb = nearestBw(b.date);
    cmp = `<div class="photocmp"><figure><img src="${photoUrls[a.id]}" alt="Oldin"><figcaption>${fmtDate(a.date)} · ${kind(a.kind)}${wa ? ` · ${wa} kg` : ''}</figcaption></figure>
      <figure><img src="${photoUrls[b.id]}" alt="Keyin"><figcaption>${fmtDate(b.date)} · ${kind(b.kind)}${wb ? ` · ${wb} kg` : ''}</figcaption></figure></div>
      <p class="center"><b>${days} kun</b>${wa && wb ? ` · ${round1(wb - wa) > 0 ? '+' : ''}${round1(wb - wa)} kg` : ''}</p>`;
  }
  box.innerHTML = `${cmp}<div class="photogrid">${photoList.map(p => `<button class="ph ${photoSel.includes(p.id) ? 'on' : ''}" data-act="photo-sel" data-id="${esc(p.id)}" aria-label="${fmtDate(p.date)} ${kind(p.kind)}">
      <img src="${photoUrls[p.id]}" alt="" loading="lazy"><span>${shortDate(p.date)} · ${kind(p.kind)}</span></button>`).join('')}</div>
    ${photoSel.length ? `<div class="row"><button class="btn ghost sm grow" data-act="photo-clear">Belgini bekor qilish</button><button class="btn ghost sm danger" data-act="photo-del">🗑 O'chirish (${photoSel.length})</button></div>` : ''}`;
}

async function addPhoto(file, kind) {
  try {
    if (!file.type.startsWith('image/')) { toast('Bu rasm emas', '⚠️'); return; }
    const blob = await shrinkPhoto(file);
    await idb.put({ id: uid(), date: today(), kind, blob });
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* */ }
    addXp(10); await loadPhotos(); toast('Rasm saqlandi', '📷');
  } catch { toast('Rasm saqlanmadi', '⚠️'); }
}

const MEAS = [['waist', 'Bel'], ['chest', 'Ko\'krak'], ['hips', 'Dumba'], ['thigh', 'Son'], ['biceps', 'Biceps'], ['neck', 'Bo\'yin']];
let measKey = 'waist';

function measCard() {
  const rows = [...S.meas].sort((a, b) => a.date.localeCompare(b.date));
  const pts = rows.filter(m => isNum(m[measKey])).map(m => ({ y: m[measKey], label: shortDate(m.date) }));
  const lastOf = k => [...rows].reverse().find(m => isNum(m[k]));
  const prevOf = k => { const r = rows.filter(m => isNum(m[k])); return r.length > 1 ? r.at(-2) : null; };
  const cells = MEAS.map(([k, n]) => {
    const l = lastOf(k), p = prevOf(k);
    const d = l && p ? round1(l[k] - p[k]) : null;
    return `<div><b>${l ? l[k] : '–'}</b><small>${n}${d ? ` <span class="${d > 0 ? 'up' : 'down'}t">${d > 0 ? '+' : ''}${d}</span>` : ''}</small></div>`;
  }).join('');
  return `<details class="card fold" ${foldAttr('meas')}><summary>Tana o'lchamlari <small>sm</small></summary>
    <div class="measgrid">${cells}</div>
    <form id="measForm" class="grid2f">${MEAS.map(([k, n]) => `<input name="${k}" type="number" inputmode="decimal" step="0.1" min="5" max="250" placeholder="${n} (sm)" aria-label="${n}">`).join('')}
      <button class="btn full">Bugungi o'lchovni saqlash</button></form>
    ${rows.length ? `<select id="measSel" aria-label="O'lchov turi">${MEAS.map(([k, n]) => `<option value="${k}" ${k === measKey ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <div class="chart">${lineChart(pts, 'sm')}</div>
      <button class="link danger" data-act="meas-del">Oxirgi yozuvni o'chirish</button>` : ''}</details>`;
}

function renderProg() {
  const st = stats();
  const exercisesDone = [...new Set(S.log.map(s => s.exId))].filter(id => exById(id));
  if (!progEx || !exercisesDone.includes(progEx)) progEx = exercisesDone[0] || null;
  const bw = [...S.bw].sort((a, b) => a.date.localeCompare(b.date));
  const bwDelta = bw.length > 1 ? round1(bw.at(-1).kg - bw[0].kg) : null;

  let exHtml = '<div class="empty">Mashg\'ulot bajargach bu yerda progress ko\'rinadi</div>';
  if (progEx) {
    const sets = S.log.filter(s => s.exId === progEx), byDay = {};
    sets.forEach(s => { byDay[s.date] = Math.max(byDay[s.date] || 0, s.weight); });
    const best = sets.reduce((m, s) => (s.weight > m ? s.weight : m), 0);
    const e1 = sets.reduce((m, s) => Math.max(m, s.weight * (1 + s.reps / 30)), 0);
    exHtml = `<select id="progSel" aria-label="Mashq">${exercisesDone.map(id => `<option value="${esc(id)}" ${id === progEx ? 'selected' : ''}>${esc(exById(id).name)}</option>`).join('')}</select>
      <div class="chart">${lineChart(Object.keys(byDay).sort().map(d => ({ y: byDay[d], label: shortDate(d) })), 'kg')}</div>
      <div class="stats3"><div><b>${best} kg</b><small>Eng og'ir</small></div><div><b>${Math.round(e1)} kg</b><small>Taxm. 1RM</small></div><div><b>${sets.length}</b><small>Jami set</small></div></div>`;
  }

  // heatmap: oxirgi 16 hafta
  const counts = {}; S.workouts.forEach(w => { counts[w.date] = (counts[w.date] || 0) + w.sets; });
  const wsN = dayNum(weekStartKey()), cells = [];
  for (let wk = 15; wk >= 0; wk--) for (let d = 0; d < 7; d++) {
    const n = wsN - wk * 7 + d, key = dayKey(new Date(n * 864e5 + 12 * 36e5));
    const c = counts[key] || 0, lvl = key > today() ? 'f' : c === 0 ? 0 : c < 10 ? 1 : c < 20 ? 2 : 3;
    cells.push(`<i class="h${lvl}" title="${fmtDate(key)}: ${c} set"></i>`);
  }

  // mushak taqsimoti (30 kun)
  const cut = dayKey(new Date(Date.now() - 30 * 864e5)), gc = {};
  S.log.filter(s => s.date >= cut).forEach(s => { const g = exById(s.exId)?.group; if (g) gc[g] = (gc[g] || 0) + 1; });
  const gmax = Math.max(1, ...Object.values(gc));

  $('#tab-prog').innerHTML = `
    ${window.Cut ? Cut.progCard() : ''}
    <div class="card"><h3>Tana vazni ${bwDelta !== null ? `<span class="delta ${bwDelta > 0 ? 'up' : 'down'}">${bwDelta > 0 ? '+' : ''}${bwDelta} kg</span>` : ''}</h3>
      <form id="bwForm" class="row"><input name="kg" type="number" inputmode="decimal" step="0.1" min="20" max="400" placeholder="Bugungi vazn (kg)" required><button class="btn">Saqlash</button></form>
      <div class="chart">${lineChart(bw.map(b => ({ y: b.kg, label: shortDate(b.date) })), 'kg')}</div></div>
    <div class="stats4 fade"><div><b>${S.workouts.length}</b><small>Mashg'ulot</small></div><div><b>${st.streak}</b><small>Seriya</small></div>
      <div><b>${(st.volume / 1000).toFixed(1)}t</b><small>Hajm</small></div><div><b>${st.prCount}</b><small>Rekord</small></div></div>
    ${measCard()}
    ${photoCard()}
    <div class="card"><h3>Mashq progressi</h3>${exHtml}</div>
    <div class="card"><h3>Faollik (16 hafta)</h3><div class="heat">${cells.join('')}</div></div>
    <div class="card"><h3>Mushaklar taqsimoti (30 kun)</h3>${Object.keys(gc).length ? GROUPS.filter(g => gc[g]).map(g => `<div class="gbar"><span><i class="gd" style="background:${gm(g).c}"></i>${esc(g)}</span><div class="bar"><div style="width:${gc[g] / gmax * 100}%;background:${gm(g).c}"></div></div><em>${gc[g]}</em></div>`).join('') : '<div class="empty">Ma\'lumot yo\'q</div>'}</div>
    <h3 class="sec">Yutuqlar ${Object.keys(S.ach).length}/${ACHIEVEMENTS.length}</h3>
    <div class="achgrid">${ACHIEVEMENTS.map(a => `<div class="ach ${S.ach[a.id] ? 'on' : ''}"><span>${a.i}</span><b>${esc(a.n)}</b><small>${esc(a.d)}</small></div>`).join('')}</div>`;
  loadPhotos();
}

// ====================== sozlamalar ======================
const KEYS = Object.keys(DEFAULTS);

function settingsSheet() {
  openSheet(`<h2>Sozlamalar</h2><form id="setForm" class="stack">
    <label>Ismingiz<input name="name" value="${esc(S.profile.name)}" maxlength="30" placeholder="Ism"></label>
    <label>Haftalik maqsad (mashg'ulot kunlari)<select name="goal">${[2, 3, 4, 5, 6].map(n => `<option ${n === S.profile.weeklyGoal ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Mavzu<select name="theme">${[['dark', 'Qorong\'i'], ['light', 'Yorug\''], ['auto', 'Qurilmaga mos']].map(([v, n]) => `<option value="${v}" ${S.profile.theme === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${window.Voice && Voice.supported ? `<h4>Ovozli yordamchi</h4>
    <label class="check"><input type="checkbox" data-voice-on ${S.profile.voice ? 'checked' : ''}> Mashg'ulotda ovoz bilan aytib turish</label>
    <label>Til<select data-voice-lang>${[['auto', 'Avto (o\'zbek, bo\'lmasa rus yoki ingliz)'], ['uz', 'O\'zbekcha'], ['ru', 'Ruscha'], ['en', 'Inglizcha']].map(([v, n]) => `<option value="${v}" ${(S.profile.voiceLang || 'auto') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <button type="button" class="btn ghost" data-act="voice-test">Ovozni sinash</button>
    <p class="mute small">Set bajarilganda, dam olish tugaganda va keyingi mashqda ovoz bilan xabar beradi. O'zbek ovozi telefonda bo'lmasa, rus yoki ingliz ovozi ishlatiladi.</p>` : ''}
    <h4>Mashg'ulot eslatmasi</h4>
    <label class="check"><input type="checkbox" name="remindOn" ${S.profile.remindOn ? 'checked' : ''}> Eslatmani yoqish</label>
    <label>Vaqt<input type="time" name="remindTime" value="${esc(S.profile.remindTime)}"></label>
    <div class="daypick">${WEEKDAYS.map((d, i) => `<label class="dp"><input type="checkbox" name="rd" value="${(i + 1) % 7}" ${S.profile.remindDays.includes((i + 1) % 7) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
    <p class="mute small">Ovozsiz rejimda oddiy bildirishnoma jim bo'ladi. Eng ishonchli yo'l: telefon budilnigi (pastdagi tugma). Telegram orqali kirgan bo'lsangiz, bot ham shu vaqtda xabar yuboradi (ilova yopiq bo'lsa ham). Dam olish taymeri tugaganda baland signal va uzoq tebranish ishlaydi.</p>
    ${window.IN_TG ? '<button type="button" class="btn ghost" data-act="open-browser">⏰ Budilnik uchun brauzerda ochish</button><p class="mute small">Budilnik tugmasi faqat oddiy brauzerda (Chrome) ishlaydi. Shu tugma saytni brauzerda ochadi.</p>' : ''}
    ${/Android/i.test(navigator.userAgent) && !window.IN_TG ? '<button type="button" class="btn ghost" data-act="alarm-set">⏰ Telefon budilnigini o\'rnatish</button><p class="mute small">Budilnik ilovasi ochiladi, vaqt tayyor turadi. Takrorlanish kunlarini budilnikda belgilab, saqlang. Budilnik ovozsiz rejimda ham jiringlaydi.</p><p class="small" id="alarmHint"></p>' : ''}
    <p class="small" id="notifHelp">${esc(notifHelp(notifState()))}</p>
    <button type="button" class="btn ghost" data-act="notif-test">Bildirishnomani sinash</button>
    <button class="btn">Saqlash</button></form>
    ${window.Sync ? Sync.html() : ''}
    <h4>Ma'lumotlar</h4><div class="row wrap">${installEvt ? '<button class="btn" data-act="install">📲 Ilovani o\'rnatish</button>' : ''}<button class="btn ghost" data-act="export">⬇ Eksport</button>
    <label class="btn ghost filebtn">⬆ Import<input type="file" id="importFile" accept="application/json" hidden></label>
    <button class="btn ghost danger" data-act="reset">🗑 Hammasini o'chirish</button></div>
    <p class="mute small">Ma'lumotlar shu qurilmada saqlanadi. Bulutli sinxronlashni yoqmasangiz, eksport bilan nusxa oling.</p>`, 'settings');
}

// ====================== bildirishnomalar ======================
// Holat: 'granted' | 'denied' | 'default' | 'unsupported'
function notifState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
async function askNotifPermission() {
  try {
    if (notifState() === 'default') await Notification.requestPermission();
  } catch { /* eski brauzerlar */ }
  return notifState() === 'granted';
}
function notifHelp(st) {
  if (window.IN_TG) return 'Telegram ichida brauzer bildirishnomalari ishlamaydi. Eslatmani bot Telegram orqali yuboradi: "Bildirishnomani sinash" bot orqali sinov xabarini jo\'natadi.';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (st === 'unsupported') return ios
    ? 'iPhone/iPad da bildirishnoma faqat ilova bosh ekranga o\'rnatilganda ishlaydi: Safari → Ulashish → "Bosh ekranga qo\'shish", keyin o\'sha ikonadan oching.'
    : 'Bu brauzer bildirishnomani qo\'llamaydi.';
  if (st === 'denied') return 'Bildirishnoma bloklangan. Brauzer sozlamalarida shu sayt uchun "Bildirishnomalar" ni "Ruxsat" qiling (manzil satridagi 🔒 → Sayt sozlamalari), so\'ng qayta urinib ko\'ring.';
  if (st === 'default') return 'Ruxsat hali berilmagan. "Bildirishnomani sinash" ni bosing va ruxsat bering.';
  return 'Ruxsat berilgan ✓';
}
async function notify(title, body, strong) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) await reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: strong ? 'gymtrack-rest' : 'gymtrack-' + Date.now(), renotify: !!strong, requireInteraction: !!strong, vibrate: strong ? [600, 150, 600, 150, 600, 150, 900] : [200, 100, 200] });
      else new Notification(title, { body, icon: 'icon-192.png' });
      return true;
    }
  } catch { /* toast'ga o'tamiz */ }
  toast(body, '🔔'); return false;
}
function checkReminder() {
  const p = S.profile;
  if (!p.remindOn || p.remindLast === today()) return;
  const now = new Date();
  if (!p.remindDays.includes(now.getDay())) return;
  const [h, m] = (p.remindTime || '18:00').split(':').map(Number);
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  if (S.workouts.some(w => w.date === today())) return;
  p.remindLast = today(); save('profile');
  const { day } = programDay();
  beep();   // taymerdagidek baland signal va tebranish
  if (!document.hidden) toast(`Mashg'ulot vaqti! Bugun: ${day.name}`, '💪');
  notify('Mashg\'ulot vaqti! 💪', `Bugun: ${day.name}`, true);
}
setInterval(checkReminder, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkReminder(); });

function timerSheet() {
  openSheet(`<h2>Asboblar</h2>
    <h4>Dam olish taymeri</h4><div class="presets">${[30, 45, 60, 90, 120, 180].map(s => `<button class="btn ghost" data-act="rest-start" data-s="${s}">${s >= 60 ? s / 60 + ' daq' : s + ' s'}</button>`).join('')}</div>
    <form id="timerForm" class="row"><input name="s" type="number" inputmode="numeric" min="5" max="900" placeholder="Soniya"><button class="btn">Boshlash</button></form>
    <h4>Shtanga disklari</h4>
    <div class="row"><input id="plateKg" type="number" inputmode="decimal" step="0.5" min="0" placeholder="Jami vazn (kg)" aria-label="Jami vazn">
      <select id="plateBar" aria-label="Grif vazni"><option value="20">Grif 20 kg</option><option value="15">Grif 15 kg</option><option value="10">Grif 10 kg</option></select></div>
    <div id="plateOut" class="calc-out mute small">Maqsadli vaznni kiriting</div>
    <h4>1RM kalkulyatori</h4>
    <div class="row"><input id="rmKg" type="number" inputmode="decimal" step="0.5" min="0" placeholder="Vazn (kg)" aria-label="Vazn"><input id="rmReps" type="number" inputmode="numeric" min="1" max="30" placeholder="Takror" aria-label="Takror"></div>
    <div id="rmOut" class="calc-out mute small">Vazn va takrorni kiriting</div>`);
}

function updatePlate() {
  const total = parseFloat($('#plateKg').value), bar = +$('#plateBar').value, out = $('#plateOut');
  if (!(total > 0)) { out.innerHTML = 'Maqsadli vaznni kiriting'; return; }
  let side = Math.round((total - bar) * 50) / 100;          // bir tomon, 0.01 aniqlikda
  if (side < 0) { out.innerHTML = `Vazn gridning o'zidan (${bar} kg) kam`; return; }
  const parts = [];
  [25, 20, 15, 10, 5, 2.5, 1.25].forEach(p => {
    const n = Math.floor(side / p + 1e-9);
    if (n) { parts.push(`<span class="plate p${String(p).replace('.', '_')}">${p} kg × ${n}</span>`); side = Math.round((side - n * p) * 100) / 100; }
  });
  out.innerHTML = `<div>Har bir tomonga:</div><div class="plates">${parts.join('') || '<em>disksiz, faqat grif</em>'}</div>`
    + (side > 0 ? `<div class="warn-t">Aniq yig'ib bo'lmaydi: ${round1(side * 2)} kg yetishmaydi</div>` : '');
}

function updateRm() {
  const w = parseFloat($('#rmKg').value), r = parseInt($('#rmReps').value, 10), out = $('#rmOut');
  if (!(w > 0) || !(r > 0)) { out.innerHTML = 'Vazn va takrorni kiriting'; return; }
  const rm = r === 1 ? w : w * (1 + r / 30);                 // Epley
  out.innerHTML = `<div class="rm-big">${Math.round(rm * 10) / 10} kg <small>taxminiy 1RM</small></div>
    <div class="rmtab">${[95, 90, 85, 80, 75, 70, 60].map(p => `<div><b>${Math.round(rm * p / 100 * 2) / 2}</b><small>${p}%</small></div>`).join('')}</div>`;
}

// ====================== mavzu, ekran, o'rnatish ======================
const darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const t = S.profile.theme === 'auto' ? (darkMq && !darkMq.matches ? 'light' : 'dark') : (S.profile.theme || 'dark');
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'light' ? '#f1f2ec' : '#0b0e16';
}
if (darkMq && darkMq.addEventListener) darkMq.addEventListener('change', applyTheme);

let wake = null, installEvt = null;
async function wakeOn() {
  try {
    if (!('wakeLock' in navigator) || wake) return;
    wake = await navigator.wakeLock.request('screen');
    wake.addEventListener('release', () => { wake = null; });
  } catch { wake = null; }
}
function wakeOff() { try { if (wake) wake.release(); } catch { /* e'tibor bermaymiz */ } wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.active && wkOpen) wakeOn(); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Ilova o\'rnatildi', '📲'); });

function onboardSheet() {
  openSheet(`<div class="onb"><div class="big-emoji">💪</div><h2>GymTrack'ga xush kelibsiz!</h2>
    <p class="mute">Bir necha soniyada ilovani o'zingizga moslang.</p>
    <form id="onbForm" class="stack"><label>Ismingiz<input name="name" maxlength="30" placeholder="Ism" autocomplete="given-name"></label>
      <label>Haftada nechta mashg'ulot?<select name="goal">${[2, 3, 4, 5, 6].map(n => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Dastur<select name="program">${PROGRAMS.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(p.tag)}</option>`).join('')}</select></label>
      <button class="btn">Boshlaymiz 🚀</button></form></div>`);
}

// ====================== dam olish taymeri ======================
let rest = { end: 0, total: 0 }, restId = null, audioCtx = null;

function beep(rounds = 3) {
  // Baland va uzoq signal: 3 marta 3 ta qisqa "bip" (budilnik ohangi), tebranish ham uzoq
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    for (let r = 0; r < rounds; r++) for (let i = 0; i < 3; i++) {
      const t = t0 + r * 1.1 + i * 0.22, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = i === 2 ? 1320 : 990; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    }
  } catch { /* audio mavjud emas */ }
  if (navigator.vibrate) navigator.vibrate(rounds > 1 ? [600, 150, 600, 150, 600, 150, 900] : [500, 120, 500]);
}
// Birinchi bosishda audio "ochiladi" (brauzerlar ovozni faqat foydalanuvchi harakatidan keyin ruxsat beradi)
function primeAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* */ } }
document.addEventListener('pointerdown', primeAudio, { once: true });

function startRest(sec) {
  rest = { end: Date.now() + sec * 1000, total: sec };
  $('#rest').classList.add('on');
  if (!restId) restId = setInterval(restTick, 250);
  restTick();
}
function restTick() {
  const left = Math.ceil((rest.end - Date.now()) / 1000);
  if (window.Voice) Voice.tick(left);
  if (left <= 0) {
    stopRest(); const vo = window.Voice && Voice.on(); beep(vo ? 1 : 3); if (vo) Voice.restEnd(); toast('Dam olish tugadi — keyingi set!', '⏱️');
    if (document.hidden) notify('Dam olish tugadi ⏱️', 'Keyingi setga tayyormisiz?', true);
    return;
  }
  $('#restT').textContent = fmtTime(left);
  $('#restBar').style.width = ((1 - left / rest.total) * 100) + '%';
}
function stopRest() {
  clearInterval(restId); restId = null; $('#rest').classList.remove('on');
}

// ====================== asosiy render va navigatsiya ======================
const RENDER = { home: renderHome, train: renderTrain, lib: renderLib, diet: renderDiet, prog: renderProg };
let curTab = 'home';

function goTab(t) {
  curTab = t;
  $$('.bottom button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + t));
  RENDER[t](); window.scrollTo(0, 0);
}
function renderAll() { RENDER[curTab](); renderResumeBar(); }

// ====================== hodisalar ======================
const ACTIONS = {
  'close-sheet': () => closeSheet(),
  'start-day': el => {
    const { P } = programDay();
    const idx = el.dataset.idx !== undefined ? +el.dataset.idx : S.profile.dayIdx % P.days.length;
    const day = P.days[idx];
    startWk(day.name, day.ex.map(([id, n, t, r]) => [id, n, t, r]), P.id, idx);
  },
  'start-empty': () => { startWk('Erkin mashg\'ulot', [], null, null); },
  'pick-prog': el => { S.profile.program = el.dataset.id; S.profile.dayIdx = 0; save('profile'); renderTrain(); },
  'wk-open': () => { wkOpen = true; renderWk(); },
  'wk-min': () => { wkOpen = false; renderWk(); },
  'wk-finish': () => finishWk(),
  'wk-cancel': async () => { if (await ask('Mashg\'ulot bekor qilinsinmi? Kiritilgan ma\'lumotlar saqlanmaydi.', 'Bekor qilish')) cancelWk(); },
  'wk-add': () => exPickerSheet(true),
  'pb-new': () => pbNew(),
  'pb-edit': el => pbEdit(el.dataset.id),
  'pb-del': async el => {
    if (!(await ask('Bu dastur o\'chirilsinmi?', 'O\'chirish'))) return;
    S.myprogs = S.myprogs.filter(p => p.id !== el.dataset.id); save('myprogs');
    if (S.profile.program === el.dataset.id) { S.profile.program = 'ppl'; S.profile.dayIdx = 0; save('profile'); }
    renderAll();
  },
  'pb-day-add': () => { PB.days.push({ name: `Kun ${PB.days.length + 1}`, ex: [] }); progBuilderSheet(); },
  'pb-day-del': el => { PB.days.splice(+el.dataset.di, 1); progBuilderSheet(); },
  'pb-ex-add': el => { const di = +el.dataset.di; exPickerSheet(false); pbDay = di; },
  'pb-ex-del': el => { PB.days[+el.dataset.di].ex.splice(+el.dataset.xi, 1); progBuilderSheet(); },
  'pb-save': () => pbSave(),
  'pick-ex': el => {
    if (pbDay !== null && PB) {                       // dastur tuzish rejimi
      PB.days[pbDay].ex.push([el.dataset.ex, 3, '10', 90]); progBuilderSheet(); return;
    }
    if (!S.active) return;
    S.active.exs.push(makeEx(el.dataset.ex, 3, '10', 90));
    save('active'); closeSheet(); wkOpen = true; renderWk(); toast('Mashq qo\'shildi', '➕');
  },
  'ex-del': el => { S.active.exs.splice(+el.dataset.xi, 1); save('active'); renderWk(); },
  'set-add': el => {
    const e = S.active.exs[+el.dataset.xi], l = e.sets.at(-1);
    e.sets.push({ w: l ? l.w : '', r: l ? l.r : 10, done: false }); save('active'); renderWk();
  },
  'set-done': el => {
    const e = S.active.exs[+el.dataset.xi], s = e.sets[+el.dataset.si];
    s.done = !s.done; save('active');
    el.closest('.setrow')?.classList.toggle('done', s.done);
    updateWkProgress();
    if (s.done) startRest(e.rest || 90);
  },
  'ex-info': el => exInfoSheet(el.dataset.ex),
  'anim-toggle': el => {
    const paused = el.classList.toggle('paused');
    $('.play', el).textContent = paused ? '▶' : '⏸';
  },
  'lib-open': el => groupSheet(el.dataset.g),
  'del-custom': el => {
    S.custom = S.custom.filter(e => e.id !== el.dataset.ex); save('custom'); closeSheet(); renderAll();
  },
  'del-workout': async el => {
    if (!(await ask('Bu mashg\'ulot o\'chirilsinmi?', 'O\'chirish'))) return;
    S.workouts = S.workouts.filter(w => w.id !== el.dataset.id);
    S.log = S.log.filter(s => s.wid !== el.dataset.id);
    save('workouts'); save('log'); renderAll();
  },
  'photo-sel': el => {
    const id = el.dataset.id;
    photoSel = photoSel.includes(id) ? photoSel.filter(x => x !== id) : [...photoSel, id].slice(-2);
    drawPhotos();
  },
  'photo-clear': () => { photoSel = []; drawPhotos(); },
  'photo-del': async () => {
    if (!photoSel.length || !(await ask(`${photoSel.length} ta rasm o'chirilsinmi?`, 'O\'chirish'))) return;
    for (const id of photoSel) await idb.del(id);
    photoSel = []; loadPhotos();
  },
  'meas-del': async () => {
    if (!S.meas.length || !(await ask('Oxirgi o\'lchov yozuvi o\'chirilsinmi?', 'O\'chirish'))) return;
    const last = [...S.meas].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    S.meas = S.meas.filter(m => m !== last); save('meas'); renderProg();
  },
  'notif-test': async () => {
    if (window.IN_TG) {
      try {
        const r = await fetch('/.netlify/functions/tg-auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'test', initData: Telegram.WebApp.initData }) });
        toast(r.ok ? 'Bot xabar yubordi. Telegram chatini tekshiring' : 'Yuborilmadi (bot sozlamasini tekshiring)', r.ok ? '🔔' : '⚠️');
      } catch { toast('Tarmoq xatosi', '⚠️'); }
      return;
    }
    const ok = await askNotifPermission();
    if (!ok) { const st = notifState(); toast(notifHelp(st), '⚠️'); const h = $('#notifHelp'); if (h) h.textContent = notifHelp(st); return; }
    beep();
    const shown = await notify('GymTrack', 'Eslatmalar ishlayapti 💪');
    const h = $('#notifHelp'); if (h) h.textContent = shown ? 'Ruxsat berilgan ✓ — bildirishnoma yuborildi (ko\'rinmasa, telefon "Bezovta qilmang" rejimini tekshiring).' : 'Ruxsat bor, lekin bildirishnoma chiqmadi.';
  },
  'sync-login': () => window.Sync && Sync.login(),
  'open-browser': () => { try { Telegram.WebApp.openLink(location.origin + '/'); } catch { window.open(location.origin + '/', '_blank'); } },
  'alarm-set': () => {
    const v = (document.querySelector('#setForm [name=remindTime]') || {}).value || S.profile.remindTime || '18:00';
    const [h, m] = v.split(':').map(Number);
    const msg = encodeURIComponent('GymTrack: mashg\'ulot vaqti');
    const url = `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${h};i.android.intent.extra.alarm.MINUTES=${m};S.android.intent.extra.alarm.MESSAGE=${msg};end`;
    const el = document.createElement('a'); el.href = url; el.style.display = 'none'; document.body.appendChild(el); el.click(); el.remove();
    const hint = $('#alarmHint'); if (hint) hint.textContent = `Budilnik ochilmasa, qo'lda qo'ying: Soat ilovasi → Budilnik → + → ${v}, kunlar: ${S.profile.remindDays.map(d => WEEKDAYS[(d + 6) % 7]).join(', ')}.`;
  },
  'tg-retry': () => window.Sync && Sync.tgLogin(),
  'tg-web': () => window.Sync && Sync.tgWebLogin(),
  'tg-cancel': () => window.Sync && Sync.tgCancel(),
  'sync-now': () => window.Sync && Sync.syncNow(false),
  'sync-logout': () => window.Sync && Sync.logout(),
  'sync-clear': async () => { if (window.Sync && await ask('Firebase sozlamasi o\'chirilsinmi? (Ma\'lumotlar qurilmada qoladi)', 'O\'chirish')) Sync.clearCfg(); },
  'water+': () => { setWater((S.water[today()] || 0) + 1); },
  'water-': () => { setWater(Math.max(0, (S.water[today()] || 0) - 1)); },
  'water-set': el => { const n = +el.dataset.n; setWater((S.water[today()] || 0) === n ? n - 1 : n); },
  'plan-goal': el => { S.profile.planGoal = el.dataset.k; S.profile.planVar = 0; save('profile'); renderDiet(); },
  'plan-var': el => { S.profile.planVar = +el.dataset.i; save('profile'); renderDiet(); },
  'plan-add': el => {
    const m = buildPlan()[+el.dataset.mi]; addMeal(m.name, m.t); addXp(5); renderDiet(); toast(`${m.name} qo'shildi`, '🍽');
    checkAch();
  },
  'plan-add-all': () => {
    buildPlan().forEach(m => addMeal(m.name, m.t)); addXp(15); renderDiet(); toast('Butun reja qo\'shildi', '🥗'); checkAch();
  },
  'del-meal': el => { S.meals = S.meals.filter(m => m.id !== el.dataset.id); save('meals'); renderDiet(); },
  'rest-start': el => { startRest(+el.dataset.s); closeSheet(); },
  'rest+': () => { rest.end += 15000; rest.total += 15; restTick(); },
  'rest-skip': () => stopRest(),
  'settings': () => settingsSheet(),
  'install': async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch { /* e'tibor bermaymiz */ }
    installEvt = null; closeSheet();
  },
  'timer': () => timerSheet(),
  'export': () => {
    const data = {}; KEYS.forEach(k => { data[k] = S[k]; });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `gymtrack-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  },
  'reset': async () => {
    if (!(await ask('Barcha ma\'lumotlar o\'chiriladi. Davom etasizmi?', 'Hammasini o\'chirish'))) return;
    KEYS.forEach(k => { S[k] = JSON.parse(JSON.stringify(DEFAULTS[k])); save(k); });
    closeSheet(); stopRest(); wkOpen = false; renderWk(); renderAll(); toast('Ma\'lumotlar tozalandi', '🗑');
  },
};

function setWater(n) {
  S.water[today()] = Math.min(20, n); save('water');
  if (n === WATER_GOAL) { addXp(10); toast('Suv maqsadi bajarildi!', '💧'); }
  checkAch(); renderAll();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el) { ACTIONS[el.dataset.act]?.(el, e); return; }
  const go = e.target.closest('[data-go]');
  if (go) goTab(go.dataset.go);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.pb && PB) {               // dastur tuzish inputlari (qayta chizilmaydi)
    const k = t.dataset.pb, d = PB.days[+t.dataset.di], x = d && d.ex[+t.dataset.xi];
    if (k === 'name') PB.name = t.value;
    else if (k === 'dname' && d) d.name = t.value;
    else if (x) x[{ sets: 1, reps: 2, rest: 3 }[k]] = t.value;
  } else if (t.dataset.f && S.active) {          // faol mashg'ulot inputlari
    S.active.exs[+t.dataset.xi].sets[+t.dataset.si][t.dataset.f] = t.value; save('active');
  } else if (t.id === 'libSearch') drawLibGrid();
  else if (t.id === 'foodG') updateFoodPreview();
  else if (t.id === 'plateKg') updatePlate();
  else if (t.id === 'rmKg' || t.id === 'rmReps') updateRm();
});

document.addEventListener('change', e => {
  if (e.target.id === 'foodSel') updateFoodPreview();
  else if (e.target.id === 'plateBar') updatePlate();
  else if (e.target.id === 'progSel') { progEx = e.target.value; renderProg(); }
  else if (e.target.id === 'measSel') { measKey = e.target.value; renderProg(); }
  else if (e.target.id === 'photoFile') {
    const input = e.target, f = input.files[0], kind = $('#photoKind') ? $('#photoKind').value : 'front';
    if (f) addPhoto(f, kind).finally(() => { input.value = ''; });
  }
  else if (e.target.id === 'importFile') {
    const input = e.target, file = input.files[0]; if (!file) return;
    if (file.size > 20e6) { toast('Fayl juda katta', '⚠️'); input.value = ''; return; }
    file.text().then(async txt => {
      const clean = sanitizeData(JSON.parse(txt));
      if (!clean) { toast('Fayl GymTrack eksporti emas yoki buzilgan', '⚠️'); return; }
      const info = `${(clean.workouts || []).length} mashg'ulot, ${(clean.meals || []).length} ovqat yozuvi`;
      if (!(await ask(`Import: ${info}. Joriy ma'lumotlar almashtiriladi. Davom etamizmi?`, 'Import qilish'))) return;
      applyData(clean);
      KEYS.forEach(k => { if (clean[k] !== undefined) save(k); });
      closeSheet(); renderAll(); toast('Ma\'lumotlar import qilindi', '⬆');
    }).catch(() => toast('Fayl o\'qilmadi (JSON emas)', '⚠️')).finally(() => { input.value = ''; });
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target), id = e.target.id;
  if (id === 'customForm') {
    S.custom.push({ id: 'c' + uid(), name: f.get('name').trim(), group: f.get('group'), equip: 'Maxsus', custom: true });
    save('custom'); renderLib(); toast('Mashq qo\'shildi', '➕');
  } else if (id === 'bwForm') {
    S.bw = S.bw.filter(b => b.date !== today()); S.bw.push({ date: today(), kg: parseFloat(f.get('kg')) });
    save('bw'); addXp(10); checkAch(); renderAll(); toast('Vazn saqlandi', '⚖️');
  } else if (id === 'measForm') {
    const entry = { date: today() };
    MEAS.forEach(([k]) => { const v = parseFloat(f.get(k)); if (v > 0) entry[k] = v; });
    if (Object.keys(entry).length < 2) { toast('Kamida bitta o\'lchamni kiriting', '⚠️'); return; }
    const old = S.meas.find(m => m.date === entry.date);
    S.meas = S.meas.filter(m => m.date !== entry.date); S.meas.push({ ...old, ...entry });
    save('meas'); addXp(10); renderProg(); toast('O\'lchamlar saqlandi', '📏');
  } else if (id === 'syncCfgForm') {
    window.Sync && Sync.saveCfg(f.get('cfg'));
  } else if (id === 'goalForm') {
    S.goal = { kcal: +f.get('kcal'), p: +f.get('p'), c: +f.get('c'), f: +f.get('f') }; save('goal'); renderDiet(); toast('Maqsad saqlandi', '🎯');
  } else if (id === 'calcForm') {
    const w = +f.get('weight'), h = +f.get('height'), a = +f.get('age'), aim = +f.get('aim');
    const bmr = 10 * w + 6.25 * h - 5 * a + (f.get('sex') === 'm' ? 5 : -161);   // Mifflin–St Jeor
    const kcal = Math.round((bmr * +f.get('activity') + aim) / 10) * 10;
    const pk = Math.min(3.5, Math.max(0.8, +f.get('pPerKg') || 2)), fp = Math.min(45, Math.max(15, +f.get('fatPct') || 25));
    const p = Math.round(w * pk), fat = Math.round(kcal * fp / 100 / 9), c = Math.max(0, Math.round((kcal - p * 4 - fat * 9) / 4));
    S.goal = { kcal, p, c, f: fat }; save('goal');
    S.profile.pPerKg = pk; S.profile.fatPct = fp;
    S.profile.planGoal = aim < 0 ? 'kesish' : aim > 0 ? 'massa' : 'saqlash'; S.profile.planVar = 0; save('profile');
    renderDiet(); toast(`Maqsad: ${kcal} kkal`, '🎯');
  } else if (id === 'mealForm') {
    addMeal(f.get('name').trim(), { k: +f.get('kcal'), p: +f.get('p') || 0, c: +f.get('c') || 0, f: +f.get('f') || 0 });
    addXp(5); checkAch(); renderDiet();
  } else if (id === 'foodForm') {
    const food = FOODS[f.get('food')], g = +f.get('g');
    if (g > 0) { addMeal(`${food.n} ${g} g`, macroOf(food, g)); addXp(5); checkAch(); renderDiet(); }
  } else if (id === 'timerForm') {
    const s = +f.get('s'); if (s >= 5) { startRest(s); closeSheet(); }
  } else if (id === 'setForm') {
    S.profile.name = f.get('name').trim(); S.profile.weeklyGoal = +f.get('goal'); S.profile.theme = f.get('theme');
    S.profile.remindOn = f.get('remindOn') === 'on';
    S.profile.remindTime = /^\d{2}:\d{2}$/.test(f.get('remindTime')) ? f.get('remindTime') : '18:00';
    S.profile.remindDays = f.getAll('rd').map(Number);
    S.profile.remindLast = '';
    save('profile');
    if (S.profile.remindOn) askNotifPermission().then(ok => { if (!ok) toast('Bildirishnoma ruxsati berilmadi, eslatma ilova ichida ko\'rsatiladi', 'ℹ️'); });
    applyTheme(); closeSheet(); renderAll(); toast('Saqlandi', '✅'); checkReminder();
  } else if (id === 'onbForm') {
    S.profile.name = f.get('name').trim(); S.profile.weeklyGoal = +f.get('goal');
    S.profile.program = f.get('program'); S.profile.dayIdx = 0; save('profile');
    closeSheet(); renderAll(); toast('Tayyor! Omad tilaymiz', '🚀');
  }
});

$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
$$('.bottom button').forEach(b => b.addEventListener('click', () => goTab(b.dataset.tab)));

// ====================== boshlash ======================
applyTheme();
goTab('home'); renderWk(); checkReminder();
if (!S.profile.onboarded) {                 // birinchi kirish: bir marta ko'rsatiladi
  S.profile.onboarded = true; save('profile');
  if (!S.workouts.length && !S.profile.name) onboardSheet();
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
