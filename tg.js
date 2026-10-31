'use strict';
// Telegram Mini App integratsiyasi. Oddiy brauzerda hech narsa qilmaydi (SDK yuklanmaydi).
// Telegram appends #tgWebAppData=... to the URL when it opens a Mini App.
(() => {
  let inTg = false;
  try { inTg = /tgWebAppData=/.test(location.hash) || !!sessionStorage.getItem('__telegram__initParams'); } catch { /* */ }
  window.IN_TG = inTg;
  if (!inTg) return;
  document.documentElement.classList.add('tg');

  const s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.onload = init;
  s.onerror = () => { window.IN_TG = false; document.documentElement.classList.remove('tg'); };
  document.head.appendChild(s);

  function init() {
    const W = window.Telegram && Telegram.WebApp;
    if (!W) return;
    const safe = (f, ...a) => { try { return f && f.apply(W, a); } catch { /* eski versiya */ } };
    W.ready();
    safe(W.expand);
    safe(W.disableVerticalSwipes);          // pastga tortib yopib yuborishning oldini oladi (ro'yxatlarni aylantirishga xalaqit bermasin)

    // Telegram sarlavhasi va fonini ilova mavzusiga moslash
    const paint = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if (/^#[0-9a-f]{6}$/i.test(bg)) { safe(W.setHeaderColor, bg); safe(W.setBackgroundColor, bg); safe(W.setBottomBarColor, bg); }
    };
    paint();
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Orqaga tugmasi: ochiq oyna yoki mashg'ulot ekranini yopadi
    const sheet = document.getElementById('sheet'), wk = document.getElementById('wk');
    const sync = () => {
      const open = sheet.classList.contains('open') || wk.classList.contains('open');
      safe(open ? W.BackButton.show : W.BackButton.hide);
    };
    safe(W.BackButton.onClick, () => {
      if (sheet.classList.contains('open')) closeSheet();
      else if (wk.classList.contains('open')) ACTIONS['wk-min']();
    });
    const mo = new MutationObserver(sync);
    mo.observe(sheet, { attributes: true, attributeFilter: ['class'] });
    mo.observe(wk, { attributes: true, attributeFilter: ['class'] });

    // Tebranish (haptic): set belgilanganda va mashg'ulot tugaganda
    const hap = (kind, v) => safe(() => W.HapticFeedback[kind](v));
    const setDone = ACTIONS['set-done'];
    ACTIONS['set-done'] = (el, e) => { setDone(el, e); hap('impactOccurred', 'light'); };
    const finish = ACTIONS['wk-finish'];
    ACTIONS['wk-finish'] = (el, e) => { const r = finish(el, e); Promise.resolve(r).then(() => hap('notificationOccurred', 'success')); return r; };
  }
})();
