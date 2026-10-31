# GymTrack

Backendsiz PWA: mashg'ulot, dieta, progress. Ma'lumot `localStorage`da; ixtiyoriy Firebase sinxronlash.

## Netlify'ga joylash
1. **Eng oson:** https://app.netlify.com/drop ga shu papkani (zip emas, papkaning o'zini) sudrab tashlang.
2. **CLI:** `npx netlify-cli deploy --prod --dir=.` (birinchi marta `netlify login` so'raydi).
3. **Git:** repoga yuklab, Netlify'da "Import from Git" → build command bo'sh, publish directory `.`.

Domen HTTPS bo'lgani uchun PWA o'rnatish, service worker va bildirishnomalar ishlaydi.

## Firebase sinxronlashni yoqish (ixtiyoriy)
1. https://console.firebase.google.com → yangi loyiha (Analytics shart emas).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Authentication → Settings → Authorized domains → Add domain:** Netlify domeningiz (masalan `gymtrack.netlify.app`).
4. **Build → Firestore Database → Create database** (production mode).
5. **Firestore → Rules** ga quyidagini qo'ying va Publish qiling:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gymtrack/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
6. **Project settings → Your apps → Web (</>)** → ro'yxatdan o'tkazing, `firebaseConfig` ni nusxalang.
7. Ilovada **⚙️ Sozlamalar → Bulutli sinxronlash** ga `firebaseConfig` ni qo'ying → **Google bilan kirish**.

Qanday ishlaydi: butun holat bitta hujjatda saqlanadi, eng oxirgi o'zgargan nusxa yutadi. Ikkala qurilmada ham sinxronlanmagan o'zgarish bo'lsa, ilova qaysi biri qolishini so'raydi. Hujjat hajmi 1 MB bilan cheklangan (minglab set uchun yetarli). `firebaseConfig` maxfiy kalit emas; xavfsizlikni Firestore qoidalari ta'minlaydi.

## Eslatmalar
Brauzer yopiq ilovaga o'zi push yubora olmaydi: eslatma ilova ochiq yoki fonda ishlab turganda chiqadi. Yopiq holatda ishlashi uchun FCM + server (Cloud Functions) kerak.
