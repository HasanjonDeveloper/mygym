'use strict';
// Byudjet bo'yicha ovqat rejasi. Bu til modeli emas, matematik optimallashtirish:
// kunlik maqsad (kkal, oqsil, uglevod, yog') va byudjet berilganda, tanlangan mahsulotlardan
// maqsadga eng yaqin va byudjetdan oshmaydigan grammlarni topadi (qavariq kvadratik masala,
// koordinatalar bo'yicha tushish + byudjet uchun Lagranj ko'paytuvchisini bissektsiya bilan izlash).
// Narxlar TAXMINIY boshlang'ich qiymatlar; foydalanuvchi o'zgartiradi.
const Budget = (() => {
  // so'm / kg (tayyor taomlar uchun tayyor holdagi kg). Aniq bozor narxi emas: o'zgartiring.
  const PRICE = {
    chicken: 50000, turkey: 70000, beef: 110000, egg: 30000, tvorog: 40000, yogurt: 22000, kefir: 14000, milk: 11000, cheese: 90000,
    oats: 20000, buckwheat: 22000, rice: 18000, pasta: 15000, lentil: 20000, bread: 10000, potato: 6000, plov: 90000, banana: 25000, apple: 15000,
    dates: 60000, walnut: 120000, almond: 150000, pbutter: 80000, oil: 25000, honey: 100000, salmon: 250000, tuna: 100000, whey: 300000,
    broccoli: 25000, carrot: 5000, cucumber: 8000, tomato: 10000,
    lagmon: 65000, lagmong: 75000, somsa: 80000, manti: 60000, chuchvara: 50000, shurva: 35000, mastava: 30000, dimlama: 60000,
    shashlik: 130000, kabob: 90000, norin: 70000, patir: 25000, suzma: 30000, qaymoq: 50000, mayiz: 60000, uryuk: 70000,
    qovun: 5000, tarvuz: 3000, uzum: 20000, anor: 25000,
  };
  // bir kunda ko'pi bilan necha gramm (real porsiya chegarasi)
  const CAP = {
    chicken: 350, turkey: 300, beef: 300, egg: 250, tvorog: 300, yogurt: 400, kefir: 500, milk: 500, cheese: 80, oats: 120, buckwheat: 150, rice: 150,
    pasta: 150, lentil: 100, bread: 250, potato: 400, plov: 450, banana: 360, apple: 450, dates: 60, walnut: 50, almond: 40, pbutter: 40, oil: 30,
    honey: 30, salmon: 250, tuna: 150, whey: 60, broccoli: 300, carrot: 300, cucumber: 300, tomato: 300,
    lagmon: 450, lagmong: 350, somsa: 200, manti: 300, chuchvara: 300, shurva: 400, mastava: 400, dimlama: 400, shashlik: 250, kabob: 250,
    norin: 300, patir: 200, suzma: 200, qaymoq: 40, mayiz: 40, uryuk: 50, qovun: 500, tarvuz: 600, uzum: 300, anor: 250,
  };
  const DEF_OFF = ['whey', 'salmon', 'tuna', 'pbutter'];
  const BREAKFAST = new Set(['egg', 'tvorog', 'yogurt', 'kefir', 'milk', 'oats', 'bread', 'patir', 'honey', 'suzma', 'qaymoq', 'cheese']);
  const SNACK = new Set(['banana', 'apple', 'dates', 'walnut', 'almond', 'pbutter', 'whey', 'mayiz', 'uryuk', 'qovun', 'tarvuz', 'uzum', 'anor']);
  const DAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

  const B = () => S.budget;
  const price = id => { const v = B().prices && B().prices[id]; return v > 0 ? v : (PRICE[id] || 30000); };
  const cap = id => CAP[id] || 300;
  const usable = () => Object.keys(FOODS).filter(id => !(B().off || []).includes(id));
  const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const pieces = (id, g) => (FOODS[id].piece ? ` (~${round1(g / FOODS[id].piece)} dona)` : '');

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Tanlangan mahsulotlar (ids) ichidan grammlarni topadi
  function solveOn(ids, T, budget, ref0) {
    const n = ids.length;
    const A = ids.map(id => { const f = FOODS[id]; return [f.k / 100, f.p / 100, f.c / 100, f.f / 100]; });
    const cost = ids.map(id => price(id) / 1000), cp = ids.map(cap), ref = ids.map((id, i) => cp[i] * ref0[i]);
    const Tm = [T.kcal, T.p, T.c, T.f].map(v => Math.max(1, v)), W = [3, 3, 1.5, 1.5], mu = 0.002;
    const run = lam => {
      const g = ref.slice(), r = [0, 1, 2, 3].map(m => A.reduce((s, a, i) => s + a[m] * g[i], 0) - Tm[m]);
      for (let sweep = 0; sweep < 300; sweep++) {
        let moved = 0;
        for (let i = 0; i < n; i++) {
          let grad = lam * cost[i] + 2 * mu * (g[i] - ref[i]) / (cp[i] * cp[i]), hess = 2 * mu / (cp[i] * cp[i]);
          for (let m = 0; m < 4; m++) { grad += 2 * W[m] * r[m] / (Tm[m] * Tm[m]) * A[i][m]; hess += 2 * W[m] * A[i][m] * A[i][m] / (Tm[m] * Tm[m]); }
          const ng = Math.min(cp[i], Math.max(0, g[i] - grad / hess)), d = ng - g[i];
          if (d) { for (let m = 0; m < 4; m++) r[m] += A[i][m] * d; g[i] = ng; moved = Math.max(moved, Math.abs(d)); }
        }
        if (moved < 0.02) break;
      }
      return g;
    };
    const costOf = g => g.reduce((s, x, i) => s + x * cost[i], 0);
    let g = run(0);
    if (costOf(g) > budget) {                                     // byudjetga sig'dirish: narx jarimasini oshiramiz
      let lo = 1e-8, hi = 1e-2;
      g = run(hi);
      for (let it = 0; it < 26; it++) {
        const mid = Math.sqrt(lo * hi), gm = run(mid);
        if (costOf(gm) > budget) lo = mid; else { hi = mid; g = gm; }
      }
    }
    // 5 g ga pastga yaxlitlash (xarajat byudjetdan oshmasligi uchun), juda kichiklarni tashlash
    const items = ids.map((id, i) => {
      const pc = FOODS[id].piece;   // dona bilan sanaladigan mahsulotlar (tuxum, somsa, banan…) butun dona qilinadi
      return { id, g: pc && pc >= 40 ? Math.floor(g[i] / pc) * pc : Math.floor(g[i] / 5) * 5 };
    }).filter(x => x.g >= 25)
      .map(x => ({ ...x, c: x.g * price(x.id) / 1000, m: macroOf(FOODS[x.id], x.g) }));
    const tot = sumM(items.map(x => x.m));
    return { items, tot, cost: items.reduce((s, x) => s + x.c, 0) };
  }

  // Bir kun uchun reja: avval ~12 ta mahsulotdan iborat "menyu" (har kuni boshqacha) bilan urinadi,
  // maqsadga (kaloriya ≥95%, oqsil ≥90%) yetmasa va byudjet qolgan bo'lsa menyuni kengaytiradi.
  function solve(T, budget, seed) {
    const all = usable(); if (!all.length) return null;
    const rnd = rng(seed);
    const key = {}; all.forEach(id => { key[id] = rnd() * (1 + 1.5 / (1 + price(id) / 30000)); });   // arzonroqlar ko'proq tushadi
    const order = all.slice().sort((a, b) => key[b] - key[a]);
    // oqsilli va kaloriyali mahsulotlar menyuda albatta bo'lsin
    const protein = order.filter(id => FOODS[id].p / Math.max(1, FOODS[id].k) > 0.09).slice(0, 3);
    const dense = order.filter(id => FOODS[id].k >= 250).slice(0, 2);
    const refs = {}; all.forEach(id => { refs[id] = 0.15 + 0.3 * rnd(); });
    let best = null;
    for (let m = Math.min(12, all.length); ; m += 5) {
      const ids = [...new Set([...protein, ...dense, ...order])].slice(0, Math.max(m, protein.length + dense.length));
      const res = solveOn(ids, T, budget, ids.map(id => refs[id]));
      best = res;
      const okK = res.tot.k >= 0.92 * T.kcal, okP = res.tot.p >= 0.88 * T.p;
      if ((okK && okP) || m >= all.length || m >= 27) break;
    }
    return best;
  }

  // Taomlarni nonushta / tushlik / kechki ovqat / yengil ovqatga taqsimlash
  function meals(items) {
    const out = { 'Nonushta': [], 'Tushlik': [], 'Kechki ovqat': [], 'Yengil ovqat': [] };
    const mains = [];
    items.forEach(x => { if (BREAKFAST.has(x.id)) out['Nonushta'].push(x); else if (SNACK.has(x.id)) out['Yengil ovqat'].push(x); else mains.push(x); });
    mains.sort((a, b) => b.m.k - a.m.k).forEach((x, i) => out[i % 2 ? 'Kechki ovqat' : 'Tushlik'].push(x));
    return Object.entries(out).filter(([, l]) => l.length).map(([name, list]) => ({ name, list, t: sumM(list.map(x => x.m)), c: list.reduce((s, x) => s + x.c, 0) }));
  }

  let cur = null;   // { mode, budgetDay, days:[{...}], tab, shop, salt }

  function build(salt) {
    const b = B(), week = b.period === 'week', daily = week ? b.amount / 7 : b.amount;
    const T = S.goal, count = week ? 7 : 1, base = dayNum(today()) * 7 + (salt || 0);
    const days = Array.from({ length: count }, (_, d) => solve(T, daily, base + d * 101 + 1)).filter(Boolean);
    cur = { week, daily, T, days, tab: Math.min(cur ? cur.tab : 0, count - 1), shop: false, salt: salt || 0 };
    return !!days.length;
  }

  function status(day) {
    const T = cur.T, pk = day.tot.k / T.kcal, pp = day.tot.p / Math.max(1, T.p);
    if (pk < 0.9 || pp < 0.85) return `<p class="warn-t">Bu byudjetga maqsadning hammasi sig'maydi: kaloriya ${Math.round(pk * 100)}%, oqsil ${Math.round(pp * 100)}% ga yetdi. Byudjetni oshiring yoki maqsadni kamaytiring.</p>`;
    if (pk > 1.1) return '<p class="warn-t">Kaloriya maqsaddan biroz oshib ketdi (mahsulot chegarasi sabab).</p>';
    return '<p class="okt">✓ Maqsadga mos va byudjetga sig\'di</p>';
  }

  function shopHtml() {
    const agg = {};
    cur.days.forEach(d => d.items.forEach(x => { agg[x.id] = (agg[x.id] || 0) + x.g; }));
    const rows = Object.entries(agg).map(([id, g]) => ({ id, g, c: g * price(id) / 1000 })).sort((a, b) => b.c - a.c);
    const total = rows.reduce((s, r) => s + r.c, 0);
    return `<h4>Haftalik xarid ro'yxati</h4><ul class="foods">${rows.map(r => `<li><span>${esc(FOODS[r.id].n)}</span><em>${r.g >= 1000 ? round1(r.g / 1000) + ' kg' : r.g + ' g'} · ${money(r.c)}</em></li>`).join('')}</ul>
      <p class="center"><b>Jami: ${money(total)} so'm</b></p>`;
  }

  function sheet() {
    const d = cur.days[cur.tab], ms = meals(d.items), T = cur.T;
    openSheet(`<h2>Byudjet rejasi</h2>
      <p class="mute small">Reja sun'iy intellekt modeli bilan emas, optimallashtirish algoritmi bilan hisoblandi. Narxlar taxminiy: Dieta → "Narxlar" bo'limida o'zingizniki bilan almashtiring.</p>
      <div class="stats3"><div><b>${money(d.cost)}</b><small>so'm / kun</small></div><div><b>${Math.round(d.tot.k)}</b><small>kkal (${T.kcal})</small></div><div><b>${Math.round(d.tot.p)}</b><small>oqsil g (${T.p})</small></div></div>
      <p class="small mute center">Uglevod ${Math.round(d.tot.c)} g (${T.c}) · Yog' ${Math.round(d.tot.f)} g (${T.f})${cur.week ? ` · Hafta: ${money(cur.days.reduce((s, x) => s + x.cost, 0))} so'm` : ''}</p>
      ${status(d)}
      ${cur.week ? `<div class="seg small">${cur.days.map((_, i) => `<button class="${i === cur.tab && !cur.shop ? 'on' : ''}" data-act="bud-day" data-i="${i}">${DAYS[i]}</button>`).join('')}</div>` : ''}
      ${cur.shop ? shopHtml() : `<div class="list">${ms.map(m => `<div class="card meal"><div class="dh"><div><b>${m.name}</b><small class="mute">${Math.round(m.t.k)} kkal · O ${Math.round(m.t.p)} · ${money(m.c)} so'm</small></div></div>
        <ul class="foods">${m.list.map(x => `<li><span>${esc(FOODS[x.id].n)}</span><em>${x.g} g${pieces(x.id, x.g)}</em></li>`).join('')}</ul></div>`).join('')}</div>`}
      <div class="stack">
        ${cur.shop ? '' : '<button class="btn" data-act="bud-add">Shu kunni dietaga qo\'shish</button>'}
        ${cur.week ? `<button class="btn ghost" data-act="bud-shop">${cur.shop ? '← Kunlik rejaga qaytish' : 'Xarid ro\'yxati'}</button>` : ''}
        <button class="btn ghost" data-act="bud-again">Boshqa variant</button></div>`, 'budget');
  }

  function html() {
    const b = B(), g = S.goal, off = new Set(b.off || []);
    return `<h3 class="sec">Byudjet bo'yicha reja</h3>
      <form id="budForm" class="card stack">
        <div class="row"><input name="amount" type="number" inputmode="numeric" min="1000" step="1000" value="${b.amount}" required aria-label="Byudjet (so'm)">
          <select name="period" aria-label="Davr" style="width:auto"><option value="day" ${b.period === 'day' ? 'selected' : ''}>so'm / kun</option><option value="week" ${b.period === 'week' ? 'selected' : ''}>so'm / hafta</option></select></div>
        <small class="mute">Maqsad: ${g.kcal} kkal · O ${g.p} · U ${g.c} · Y ${g.f} (yuqoridagi "Kunlik maqsad" dan olinadi)</small>
        <button class="btn">Reja tuzish</button></form>
      <details class="card"><summary>Narxlar va mahsulotlar</summary>
        <p class="mute small">Belgilanganlar rejaga kiradi. Narx so'm/kg (tayyor taomlar uchun tayyor holdagi kg). Boshlang'ich narxlar taxminiy, o'zingizniki bilan almashtiring.</p>
        <div class="bplist">${Object.keys(FOODS).map(id => `<div class="bprow"><label class="check"><input type="checkbox" data-bp="use" data-id="${id}" ${off.has(id) ? '' : 'checked'}><span>${esc(FOODS[id].n)}</span></label>
          <input type="number" inputmode="numeric" min="0" step="500" value="${price(id)}" data-bp="price" data-id="${id}" aria-label="Narx: ${esc(FOODS[id].n)}"></div>`).join('')}</div>
        <button type="button" class="btn ghost sm" data-act="bud-reset">Narxlar va tanlovni tiklash</button></details>`;
  }

  function submit(form) {
    const f = new FormData(form), amount = Math.round(+f.get('amount'));
    if (!(amount >= 1000)) { toast('Byudjetni kiriting', '⚠️'); return; }
    B().amount = amount; B().period = f.get('period') === 'week' ? 'week' : 'day'; save('budget');
    cur = null;
    if (!build(0)) { toast('Kamida bitta mahsulot belgilang', '⚠️'); return; }
    sheet();
  }

  document.addEventListener('submit', e => { if (e.target.id === 'budForm') submit(e.target); });
  document.addEventListener('change', e => {
    const t = e.target, k = t.dataset && t.dataset.bp; if (!k) return;
    const b = B();
    if (k === 'use') { b.off = (b.off || []).filter(x => x !== t.dataset.id); if (!t.checked) b.off.push(t.dataset.id); }
    else if (k === 'price') { b.prices = b.prices || {}; const v = Math.round(+t.value); if (v > 0) b.prices[t.dataset.id] = v; else delete b.prices[t.dataset.id]; t.value = price(t.dataset.id); }
    save('budget');
  });

  Object.assign(ACTIONS, {
    'bud-day': el => { cur.tab = +el.dataset.i; cur.shop = false; sheet(); },
    'bud-shop': () => { cur.shop = !cur.shop; sheet(); },
    'bud-again': () => { build(cur.salt + 1); sheet(); },
    'bud-add': () => {
      const d = cur.days[cur.tab]; meals(d.items).forEach(m => addMeal(m.name, m.t));
      addXp(10); checkAch(); closeSheet(); renderAll(); toast('Reja dietaga qo\'shildi', '🍽');
    },
    'bud-reset': async () => {
      if (!(await ask('Narxlar va mahsulot tanlovi boshlang\'ich holatga qaytarilsinmi?', 'Tiklash'))) return;
      B().prices = {}; B().off = DEF_OFF.slice(); save('budget'); renderDiet();
    },
  });

  return { html, solve, build, meals, price, DEF_OFF, get cur() { return cur; } };
})();
window.Budget = Budget;
