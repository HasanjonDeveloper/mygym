const CACHE = 'gymtrack-v11';
const CORE = ['./', 'index.html', 'style.css', 'data.js', 'app.js', 'sync.js', 'budget.js', 'tg.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const FONTS = ['fonts/big-shoulders-display-latin-ext-wght-normal.woff2', 'fonts/big-shoulders-display-latin-wght-normal.woff2', 'fonts/instrument-sans-latin-ext-wght-normal.woff2', 'fonts/instrument-sans-latin-wght-normal.woff2'];
const IMAGES = ['img/Ab_Roller/0.jpg', 'img/Ab_Roller/1.jpg', 'img/Barbell_Bench_Press_-_Medium_Grip/0.jpg', 'img/Barbell_Bench_Press_-_Medium_Grip/1.jpg', 'img/Barbell_Curl/0.jpg', 'img/Barbell_Curl/1.jpg', 'img/Barbell_Deadlift/0.jpg', 'img/Barbell_Deadlift/1.jpg', 'img/Barbell_Hip_Thrust/0.jpg', 'img/Barbell_Hip_Thrust/1.jpg', 'img/Barbell_Squat/0.jpg', 'img/Barbell_Squat/1.jpg', 'img/Bench_Dips/0.jpg', 'img/Bench_Dips/1.jpg', 'img/Bent_Over_Barbell_Row/0.jpg', 'img/Bent_Over_Barbell_Row/1.jpg', 'img/Bicycling_Stationary/0.jpg', 'img/Bicycling_Stationary/1.jpg', 'img/Bodyweight_Squat/0.jpg', 'img/Bodyweight_Squat/1.jpg', 'img/Butt_Lift_Bridge/0.jpg', 'img/Butt_Lift_Bridge/1.jpg', 'img/Cable_Crossover/0.jpg', 'img/Cable_Crossover/1.jpg', 'img/Close-Grip_Barbell_Bench_Press/0.jpg', 'img/Close-Grip_Barbell_Bench_Press/1.jpg', 'img/Crunches/0.jpg', 'img/Crunches/1.jpg', 'img/Dips_-_Chest_Version/0.jpg', 'img/Dips_-_Chest_Version/1.jpg', 'img/Dumbbell_Bench_Press/0.jpg', 'img/Dumbbell_Bench_Press/1.jpg', 'img/Dumbbell_Flyes/0.jpg', 'img/Dumbbell_Flyes/1.jpg', 'img/Dumbbell_Lunges/0.jpg', 'img/Dumbbell_Lunges/1.jpg', 'img/Dumbbell_Shrug/0.jpg', 'img/Dumbbell_Shrug/1.jpg', 'img/EZ-Bar_Skullcrusher/0.jpg', 'img/EZ-Bar_Skullcrusher/1.jpg', 'img/Face_Pull/0.jpg', 'img/Face_Pull/1.jpg', 'img/Goblet_Squat/0.jpg', 'img/Goblet_Squat/1.jpg', 'img/Hammer_Curls/0.jpg', 'img/Hammer_Curls/1.jpg', 'img/Hanging_Leg_Raise/0.jpg', 'img/Hanging_Leg_Raise/1.jpg', 'img/Hyperextensions_Back_Extensions/0.jpg', 'img/Hyperextensions_Back_Extensions/1.jpg', 'img/Incline_Dumbbell_Curl/0.jpg', 'img/Incline_Dumbbell_Curl/1.jpg', 'img/Incline_Dumbbell_Press/0.jpg', 'img/Incline_Dumbbell_Press/1.jpg', 'img/Leg_Extensions/0.jpg', 'img/Leg_Extensions/1.jpg', 'img/Leg_Press/0.jpg', 'img/Leg_Press/1.jpg', 'img/Lying_Leg_Curls/0.jpg', 'img/Lying_Leg_Curls/1.jpg', 'img/Mountain_Climbers/0.jpg', 'img/Mountain_Climbers/1.jpg', 'img/One-Arm_Dumbbell_Row/0.jpg', 'img/One-Arm_Dumbbell_Row/1.jpg', 'img/Plank/0.jpg', 'img/Plank/1.jpg', 'img/Preacher_Curl/0.jpg', 'img/Preacher_Curl/1.jpg', 'img/Pullups/0.jpg', 'img/Pullups/1.jpg', 'img/Pushups/0.jpg', 'img/Pushups/1.jpg', 'img/Reverse_Flyes/0.jpg', 'img/Reverse_Flyes/1.jpg', 'img/Romanian_Deadlift/0.jpg', 'img/Romanian_Deadlift/1.jpg', 'img/Rope_Jumping/0.jpg', 'img/Rope_Jumping/1.jpg', 'img/Rowing_Stationary/0.jpg', 'img/Rowing_Stationary/1.jpg', 'img/Running_Treadmill/0.jpg', 'img/Running_Treadmill/1.jpg', 'img/Russian_Twist/0.jpg', 'img/Russian_Twist/1.jpg', 'img/Seated_Cable_Rows/0.jpg', 'img/Seated_Cable_Rows/1.jpg', 'img/Side_Lateral_Raise/0.jpg', 'img/Side_Lateral_Raise/1.jpg', 'img/Split_Squats/0.jpg', 'img/Split_Squats/1.jpg', 'img/Standing_Calf_Raises/0.jpg', 'img/Standing_Calf_Raises/1.jpg', 'img/Standing_Dumbbell_Triceps_Extension/0.jpg', 'img/Standing_Dumbbell_Triceps_Extension/1.jpg', 'img/Standing_Military_Press/0.jpg', 'img/Standing_Military_Press/1.jpg', 'img/Triceps_Pushdown/0.jpg', 'img/Triceps_Pushdown/1.jpg', 'img/Wide-Grip_Lat_Pulldown/0.jpg', 'img/Wide-Grip_Lat_Pulldown/1.jpg'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE.concat(FONTS));                                   // asosiy fayllar majburiy
    // rasmlar: bittasi yuklanmasa o'rnatish to'xtamaydi
    await Promise.all(IMAGES.map(u => c.add(u).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).pathname.startsWith('/.netlify/')) return;
  if (new URL(req.url).origin !== location.origin) return;   // Firebase va boshqa tashqi so'rovlarga tegmaymiz
  const isImg = req.url.includes('/img/');
  e.respondWith(isImg
    ? caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; }))
    : fetch(req).then(res => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
