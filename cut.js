'use strict';
// Ozish rejimi: maqsad vazn va muddat -> kaloriya taqchilligi, haftalik dinamika va prognoz.
// Hisob-kitoblar umumiy ma'lumot uchun, tibbiy tavsiya emas.
const Cut = (() => {
  const KCAL_KG = 7700;                       // 1 kg yog'ga taxminan teng kaloriya
  const FLOOR = { m: 1500, f: 1200 };         // xavfsiz minimal kunlik kaloriya
  const kgs = () => [...S.bw].sort((a, b) => a.date.localeCompare(b.date));
  const curKg = () => { const b = kgs(); return b.length ? b[b.length - 1].kg : (S.cut.startKg || 0); };

  // 3 ta oxirgi o'lchovning o'rtachasi: kundalik tebranishni yumshatadi
  const smooth = () => { const b = kgs().slice(-3); return b.length ? b.reduce((a, x) => a + x.kg, 0) / b.length : curKg(); };

  // Oxirgi 21 kun bo'yicha haftalik o'zgarish (kg/hafta), chiziqli regressiya
  function weeklyRate() {
    const t = dayNum(today()), pts = kgs().filter(b => t - dayNum(b.date) <= 21);
    if (pts.length < 3) return null;
    const xs = pts.map(b => dayNum(b.date)), ys = pts.map(b => b.kg), n = pts.length;
    if (Math.max(...xs) - Math.min(...xs) < 6) return null;
    const mx = xs.reduce((a, v) => a + v, 0) / n, my = ys.reduce((a, v) => a + v, 0) / n;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    return den ? num / den * 7 : null;
  }

  // Maqsad: muddat va vazn bo'yicha kaloriya taqchilligi (xavfsizlik chegaralari bilan)
  function plan(c) {
    const w = c.startKg, bmr = 10 * w + 6.25 * c.height - 5 * c.age + (c.sex === 'm' ? 5 : -161);
    const tdee = Math.round(bmr * c.activity), toLose = Math.max(0, w - c.targetKg);
    const days = Math.max(7, c.weeks * 7), need = toLose * KCAL_KG / days;
    const cap = Math.max(200, Math.min(tdee * 0.25, w * 11, tdee - FLOOR[c.sex]));   // kuniga ko'pi bilan ~1% vazn/hafta yoki 25% TDEE
    const deficit = Math.round(Math.min(need, cap) / 10) * 10;
    const realWeeks = need > cap ? Math.ceil(toLose * KCAL_KG / cap / 7) : c.weeks;
    const kcal = Math.max(FLOOR[c.sex], Math.round((tdee - deficit) / 10) * 10);
    return { bmr: Math.round(bmr), tdee, deficit, kcal, need: Math.round(need), cap: Math.round(cap), capped: need > cap, realWeeks, toLose, perWeek: toLose / Math.max(1, realWeeks) };
  }

  function status() {
    const c = S.cut; if (!c.on) return null;
    const now = smooth(), total = Math.max(0.1, c.startKg - c.targetKg), lost = c.startKg - now;
    const pct = Math.max(0, Math.min(100, lost / total * 100)), left = Math.max(0, now - c.targetKg), rate = weeklyRate();
    const planned = (c.startKg - c.targetKg) / Math.max(1, c.realWeeks || c.weeks);
    let eta = null, tone = 'ok', msg = 'Yangi o\'lchovlar qo\'shing: 3 ta va undan ko\'p o\'lchovdan keyin prognoz chiqadi.';
    if (left <= 0) { tone = 'ok'; msg = 'Maqsadga erishdingiz. Endi "Saqlash" rejimiga o\'tishingiz mumkin.'; }
    else if (rate !== null) {
      const loss = -rate;                                   // musbat = vazn tushyapti
      if (loss > 0.05) { eta = new Date(Date.now() + left / loss * 7 * 864e5); }
      if (loss < 0.1) { tone = 'bad'; msg = 'Vazn tushmayapti. Kaloriya hisobini, o\'lchamlarni va uyquni tekshiring. Kerak bo\'lsa, kunlik kaloriyani 100–150 ga kamaytiring.'; }
      else if (loss < planned * 0.6) { tone = 'warn'; msg = `Reja haftasiga ${round1(planned)} kg, haqiqatda ${round1(loss)} kg. Biroz sekinroq, sabr qiling yoki qadamni oshiring.`; }
      else if (loss > Math.max(planned * 1.6, now * 0.012)) { tone = 'warn'; msg = `Haftasiga ${round1(loss)} kg juda tez. Mushak yo'qolmasligi uchun kaloriyani biroz oshiring.`; }
      else { tone = 'ok'; msg = `Rejada: haftasiga ${round1(loss)} kg tushyapti.`; }
    }
    return { now, lost, left, pct, rate, planned, eta, tone, msg };
  }

  const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
  const fmtDate = d => `${d.getDate()}-${MONTHS[d.getMonth()]}`;

  function todayBalance() {
    const eaten = S.meals.filter(m => m.date === today()).reduce((a, m) => ({ k: a.k + m.kcal, p: a.p + m.p }), { k: 0, p: 0 });
    return { eaten, left: S.goal.kcal - eaten.k, pLeft: Math.max(0, S.goal.p - eaten.p) };
  }

  function homeCard() {
    const c = S.cut;
    if (!c.on) return `<section class="cutcta"><div><b>Ozishni boshlaymizmi?</b><small>Maqsad vazn va muddatni kiriting, kunlik kaloriya va dasturni hisoblab beraman.</small></div><button class="btn" data-act="cut-open">Boshlash</button></section>`;
    const s = status(), b = todayBalance(), over = b.left < 0;
    return `<section class="cutcard tone-${s.tone}">
      <div class="cut-top"><div><small>Hozirgi vazn</small><div class="cut-kg"><b>${round1(curKg())}</b><span>kg</span></div></div>
        <div class="cut-left"><b>${s.left > 0 ? round1(s.left) : 0}</b><small>kg qoldi · maqsad ${c.targetKg} kg</small></div></div>
      <div class="cut-bar"><i style="width:${s.pct}%"></i></div>
      <div class="cut-meta"><span>${c.startKg} kg</span><span>${round1(s.lost > 0 ? s.lost : 0)} kg tushdi</span><span>${c.targetKg} kg</span></div>
      <p class="cut-msg">${esc(s.msg)}${s.eta ? ` Prognoz: <b>${esc(fmtDate(s.eta))}</b>.` : ''}</p>
      <div class="cut-day ${over ? 'over' : ''}"><div><b>${over ? '+' + Math.abs(Math.round(b.left)) : Math.round(b.left)}</b><small>${over ? 'kkal me\'yordan oshdi' : 'kkal qoldi'}</small></div>
        <div><b>${Math.round(b.pLeft)} g</b><small>oqsil kerak</small></div></div>
      <form id="bwForm" class="row"><input name="kg" type="number" inputmode="decimal" step="0.1" min="20" max="400" placeholder="Bugungi vazn (kg)" required aria-label="Bugungi vazn"><button class="btn">Yozish</button></form>
      <button class="btn ghost block sm" data-act="cut-open">Ozish rejasi</button>
    </section>`;
  }

  function dietCard() {
    const c = S.cut; if (!c.on) return '';
    const b = todayBalance(), p = plan({ ...c, startKg: c.startKg }), over = b.left < 0;
    // oxirgi 7 kunda maqsad atrofida (±10%) bo'lgan kunlar
    let ok = 0, logged = 0; for (let i = 1; i <= 7; i++) { const d = dayKey(new Date(Date.now() - i * 864e5)), k = S.meals.filter(m => m.date === d).reduce((a, m) => a + m.kcal, 0); if (k) { logged++; if (k <= S.goal.kcal * 1.1 && k >= S.goal.kcal * 0.7) ok++; } }
    return `<div class="card cutdiet"><h3>Ozish balansi</h3>
      <div class="cut-day ${over ? 'over' : ''}"><div><b>${over ? '+' + Math.abs(Math.round(b.left)) : Math.round(b.left)}</b><small>${over ? 'kkal oshdi' : 'kkal qoldi'}</small></div><div><b>${Math.round(b.pLeft)} g</b><small>oqsil kerak</small></div><div><b>${ok}/${logged || 7}</b><small>kun maqsadda (7 kun)</small></div></div>
      <small class="mute">Kunlik me'yor ${S.goal.kcal} kkal. Sarf ~${p.tdee} kkal, taqchillik ~${p.deficit} kkal/kun.</small></div>`;
  }

  function progCard() {
    const c = S.cut; if (!c.on) return '';
    const s = status();
    return `<div class="card"><h3>Ozish dinamikasi</h3><div class="stats3"><div><b>${round1(s.lost > 0 ? s.lost : 0)} kg</b><small>Tushdi</small></div><div><b>${s.rate === null ? '—' : round1(-s.rate) + ' kg'}</b><small>Haftasiga</small></div><div><b>${s.left > 0 ? round1(s.left) + ' kg' : '✓'}</b><small>Qoldi</small></div></div>
      <p class="cut-msg">${esc(s.msg)}${s.eta ? ` Prognoz: <b>${esc(fmtDate(s.eta))}</b>.` : ''}</p></div>`;
  }

  function open() {
    const c = S.cut, bw = curKg();
    const summary = c.on ? (() => { const p = plan({ ...c }), s = status();
      return `<div class="cutsum"><div class="stats3"><div><b>${S.goal.kcal}</b><small>kkal / kun</small></div><div><b>${p.deficit}</b><small>taqchillik</small></div><div><b>${p.tdee}</b><small>sarf (TDEE)</small></div></div>
      <p class="mute small">Oqsil ${S.goal.p} g · uglevod ${S.goal.c} g · yog' ${S.goal.f} g. ${p.capped ? `Maqsad muddati xavfsiz tezlikdan tez edi, shuning uchun reja <b>${p.realWeeks} hafta</b>ga cho'zildi.` : ''}</p>
      <div class="row wrap"><button class="btn" data-act="cut-prog">Ozish dasturini tanlash</button><button class="btn ghost danger" data-act="cut-off">Rejimni o'chirish</button></div></div><h4>Qayta hisoblash</h4>`; })() : '<p class="mute small">Maqsadingizni kiriting. Men kunlik kaloriya, oqsil va dastur taklif qilaman.</p>';
    openSheet(`<h2>Ozish rejasi</h2>${summary}
      <form id="cutForm" class="grid2f">
        <select name="sex" aria-label="Jins"><option value="m" ${c.sex === 'm' ? 'selected' : ''}>Erkak</option><option value="f" ${c.sex === 'f' ? 'selected' : ''}>Ayol</option></select>
        <label>Yosh<input name="age" type="number" inputmode="numeric" placeholder="Yosh" min="14" max="90" value="${c.age || ''}" required></label>
        <label>Bo'y (sm)<input name="height" type="number" inputmode="numeric" placeholder="Bo'y (sm)" min="120" max="230" value="${c.height || ''}" required></label>
        <label>Hozirgi vazn (kg)<input name="weight" type="number" inputmode="decimal" step="0.1" placeholder="Hozirgi vazn (kg)" min="35" max="250" value="${bw || ''}" required></label>
        <label>Maqsad vazn (kg)<input name="target" type="number" inputmode="decimal" step="0.1" placeholder="Maqsad vazn (kg)" min="35" max="250" value="${c.targetKg || ''}" required></label>
        <label>Muddat (hafta)<input name="weeks" type="number" inputmode="numeric" min="4" max="60" value="${c.weeks || 12}" required></label>
        <select name="activity" class="full" aria-label="Faollik"><option value="1.375" ${c.activity === 1.375 ? 'selected' : ''}>Kam faol (1–3 mashg'ulot)</option><option value="1.55" ${c.activity === 1.55 ? 'selected' : ''}>O'rtacha (3–5)</option><option value="1.725" ${c.activity === 1.725 ? 'selected' : ''}>Juda faol (6–7)</option></select>
        <small class="full mute">Xavfsiz tezlik: haftasiga vaznning ~0.5–1%. Juda tez ozish mushakni yo'qotadi, shuning uchun reja avtomatik cheklanadi.</small>
        <button class="btn full">${c.on ? 'Qayta hisoblash' : 'Rejani yaratish'}</button></form>`, 'cut');
  }

  function apply(f) {
    const c = { sex: f.get('sex'), age: +f.get('age'), height: +f.get('height'), activity: +f.get('activity'), startKg: +f.get('weight'), targetKg: +f.get('target'), weeks: Math.round(+f.get('weeks')) };
    if (c.targetKg >= c.startKg) { toast('Maqsad vazn hozirgidan past bo\'lishi kerak', '⚠️'); return false; }
    if (c.targetKg < c.startKg * 0.6) { toast('Maqsad haddan tashqari past ko\'rinadi, shifokor bilan maslahatlashing', '⚠️'); return false; }
    const p = plan(c), pk = 2.0, fp = 25;
    const prot = Math.round(c.startKg * pk), fat = Math.round(p.kcal * fp / 100 / 9), carb = Math.max(0, Math.round((p.kcal - prot * 4 - fat * 9) / 4));
    S.cut = { ...c, on: true, realWeeks: p.realWeeks, since: today() }; save('cut');
    S.goal = { kcal: p.kcal, p: prot, c: carb, f: fat }; save('goal');
    S.profile.pPerKg = pk; S.profile.fatPct = fp; S.profile.planGoal = 'kesish'; S.profile.planVar = 0; save('profile');
    if (!S.bw.some(b => b.date === today())) { S.bw.push({ date: today(), kg: c.startKg }); save('bw'); }
    renderAll(); open(); toast(`Maqsad: ${p.kcal} kkal/kun`, '🎯');
    return true;
  }

  document.addEventListener('submit', e => {
    if (e.target.id !== 'cutForm') return; e.preventDefault(); apply(new FormData(e.target));
  });
  Object.assign(ACTIONS, {
    'cut-open': () => open(),
    'cut-prog': () => { S.profile.program = 'cut'; S.profile.dayIdx = 0; save('profile'); closeSheet(); renderAll(); toast('Ozish dasturi tanlandi', '💪'); },
    'cut-off': async () => { if (await ask('Ozish rejimi o\'chirilsinmi? (Vazn tarixi va maqsadlar saqlanadi)', 'O\'chirish')) { S.cut.on = false; save('cut'); closeSheet(); renderAll(); } },
  });
  return { homeCard, dietCard, progCard, open, status };
})();
window.Cut = Cut;
renderAll();   // app.js dastlabki chizish cut.js dan oldin bo'lgan: kartani qayta chizamiz
