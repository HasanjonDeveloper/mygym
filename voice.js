'use strict';
// Mashg'ulotdagi ovozli yordamchi: brauzerning o'rnatilgan nutq sintezi (speechSynthesis), internet va kalit kerak emas.
// O'zbek ovozi qurilmada bo'lsa o'zbekcha, bo'lmasa rus yoki ingliz ovoziga o'tadi.
const Voice = (() => {
  const T = {
    uz: { lang: 'uz-UZ',
      start: (n, k) => `Mashg'ulot boshlandi. Birinchi mashq: ${n}, ${k} set.`,
      done: (i, s) => `${i}-set bajarildi. ${s} soniya dam oling.`,
      ten: () => 'O\'n soniya qoldi.',
      next: (n, i, r) => `Dam tugadi. ${n}, ${i}-set${r ? ', ' + r + ' takror' : ''}.`,
      all: () => 'Hamma setlar tayyor. Mashg\'ulotni tugatishingiz mumkin.',
      finish: () => 'Mashg\'ulot tugadi. Barakalla!',
      test: () => 'Salom! Men sizning mashg\'ulot yordamchingizman.' },
    ru: { lang: 'ru-RU',
      start: (n, k) => `Тренировка началась. Первое упражнение: ${n}, ${k} подхода.`,
      done: (i, s) => `${i}-й подход выполнен. Отдыхайте ${s} секунд.`,
      ten: () => 'Осталось десять секунд.',
      next: (n, i, r) => `Отдых закончен. ${n}, ${i}-й подход${r ? ', ' + r + ' повторений' : ''}.`,
      all: () => 'Все подходы выполнены. Можно завершать тренировку.',
      finish: () => 'Тренировка окончена. Молодец!',
      test: () => 'Привет! Я ваш помощник по тренировкам.' },
    en: { lang: 'en-US',
      start: (n, k) => `Workout started. First exercise: ${n}, ${k} sets.`,
      done: (i, s) => `Set ${i} done. Rest for ${s} seconds.`,
      ten: () => 'Ten seconds left.',
      next: (n, i, r) => `Rest is over. ${n}, set ${i}${r ? ', ' + r + ' reps' : ''}.`,
      all: () => 'All sets done. You can finish the workout.',
      finish: () => 'Workout finished. Great job!',
      test: () => 'Hello! I am your workout assistant.' },
  };
  const syn = window.speechSynthesis;
  const on = () => !!(S.profile.voice && syn);
  let voices = [], lastTick = 0;
  const load = () => { try { voices = syn.getVoices() || []; } catch { voices = []; } };
  if (syn) { load(); if (syn.addEventListener) syn.addEventListener('voiceschanged', load); }

  // Til tanlash: auto = o'zbek > rus > ingliz (qurilmada qaysi ovoz bor bo'lsa)
  function pick() {
    const want = S.profile.voiceLang || 'auto', order = want === 'auto' ? ['uz', 'ru', 'en'] : [want];
    for (const k of order) { const v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith(k)); if (v) return { k, v }; }
    const k = want === 'auto' ? 'en' : want; return { k, v: null };
  }
  function say(fn, ...a) {
    if (!on()) return;
    try {
      const { k, v } = pick(), u = new SpeechSynthesisUtterance(T[k][fn](...a));
      u.lang = T[k].lang; if (v) u.voice = v; u.rate = 1.0; u.volume = 1;
      syn.cancel(); syn.speak(u);
    } catch { /* ovoz mavjud emas */ }
  }

  // Joriy mashg'ulotdagi keyingi bajarilmagan set
  function nextSet() {
    const a = S.active; if (!a) return null;
    for (const e of a.exs) { const si = e.sets.findIndex(s => !s.done); if (si >= 0) { const ex = exById(e.exId); return { name: ex ? ex.name : 'mashq', i: si + 1, reps: String(e.sets[si].r || e.target || '').trim() }; } }
    return null;
  }
  const restEnd = () => { const n = nextSet(); setTimeout(() => (n ? say('next', n.name, n.i, n.reps) : say('all')), 900); };
  const tick = left => { if (left === 10 && lastTick !== rest.end) { lastTick = rest.end; say('ten'); } };

  const wrap = (name, fn) => { const o = ACTIONS[name]; if (!o) return; ACTIONS[name] = (...a) => { const r = o(...a); fn(r, ...a); return r; }; };
  wrap('start-day', () => { const a = S.active; if (a && a.exs.length) { const ex = exById(a.exs[0].exId); say('start', ex ? ex.name : '', a.exs[0].sets.length); } });
  wrap('start-empty', () => {});
  wrap('set-done', (r, el) => {
    const e = S.active && S.active.exs[+el.dataset.xi]; if (!e) return;
    const si = +el.dataset.si, s = e.sets[si]; if (s && s.done) say('done', si + 1, e.rest || 90);
  });
  wrap('wk-finish', r => Promise.resolve(r).then(() => { if (!S.active) say('finish'); }));
  Object.assign(ACTIONS, {
    'voice-toggle': () => {
      if (!syn) { toast('Bu muhitda (Telegram ichida) ovoz ishlamaydi. Saytni Chrome\'da oching.', '🔇'); return; } S.profile.voice = !S.profile.voice; save('profile'); renderWk(); if (S.profile.voice) say('test'); else if (syn) syn.cancel(); },
    'voice-test': () => { const was = S.profile.voice; S.profile.voice = true; say('test'); S.profile.voice = was; },
  });
  document.addEventListener('change', e => {
    if (e.target.matches('[data-voice-on]')) { S.profile.voice = e.target.checked; save('profile'); }
    if (e.target.matches('[data-voice-lang]')) { S.profile.voiceLang = e.target.value; save('profile'); }
  });
  return { on, say, restEnd, tick, supported: !!syn };
})();
window.Voice = Voice;
