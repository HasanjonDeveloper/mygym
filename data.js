'use strict';

const GROUPS = ['Ko\'krak', 'Orqa', 'Oyoq', 'Yelka', 'Biceps', 'Triceps', 'Press', 'Kardio'];
const GROUP_META = {
  'Ko\'krak': { c: '#ff5d73', i: '🦍' }, 'Orqa': { c: '#4da3ff', i: '🦅' }, 'Oyoq': { c: '#34d399', i: '🦵' },
  'Yelka': { c: '#fbbf24', i: '🏔️' }, 'Biceps': { c: '#c084fc', i: '💪' }, 'Triceps': { c: '#fb923c', i: '🔱' },
  'Press': { c: '#2dd4bf', i: '🧱' }, 'Kardio': { c: '#f472b6', i: '❤️‍🔥' },
};
const LEVELS = ['', 'Boshlang\'ich', 'O\'rta', 'Ilg\'or'];

// [id, nom, guruh, jihoz, daraja, qo'shimcha mushaklar, texnika (| bilan), maslahat]
const EX_RAW = [
  ['bench', 'Yotib shtanga siqish', 'Ko\'krak', 'Shtanga', 2, ['Triceps', 'Yelka'], 'Skameykaga yoting, oyoqlar polda, kurak suyaklarini birlashtiring|Shtangani yelka kengligidan sal kengroq ushlang|Ko\'krak o\'rtasiga sekin tushiring|Tirsaklarni tanadan ~45° ushlab yuqoriga itaring', 'Dumbangizni skameykadan ko\'tarmang, bilak doim to\'g\'ri tursin.'],
  ['incdb', 'Qiya skameykada gantel siqish', 'Ko\'krak', 'Gantel', 2, ['Yelka', 'Triceps'], 'Skameykani 30° ga o\'rnating|Gantellarni ko\'krak yuqorisi ustida ushlang|Sekin pastga tushiring, tirsaklar 45° da|Yuqorida ko\'krakni siqing', 'Burchak 45° dan oshsa, yuk yelkaga o\'tib ketadi.'],
  ['dbpress', 'Gantel bilan yotib siqish', 'Ko\'krak', 'Gantel', 1, ['Triceps', 'Yelka'], 'Gantellar bilan skameykaga yoting|Ko\'krak ustida qo\'llarni to\'g\'rilang|Ko\'krak chetigacha tushiring|Kuch bilan yuqoriga itaring', 'Shtangaga qaraganda harakat amplitudasi kengroq, yengil vazndan boshlang.'],
  ['pushup', 'Otjimaniya', 'Ko\'krak', 'Tana vazni', 1, ['Triceps', 'Yelka', 'Press'], 'Qo\'llar yelkadan sal kengroq|Tana boshdan tovongacha to\'g\'ri chiziq|Ko\'krak polga yaqinlashguncha tushing|Kuch bilan itaring', 'Qiyin bo\'lsa tizzada yoki baland yuzada boshlang.'],
  ['dips', 'Brusyada otjimaniya', 'Ko\'krak', 'Brusya', 2, ['Triceps', 'Yelka'], 'Brusyada qo\'llarni to\'g\'rilab turing|Tanani oldinga sal egib tushing|Yelka tirsak bilan teng bo\'lguncha tushing|Yuqoriga itaring', 'Oldinga egilsangiz ko\'krak, tik tursangiz triceps ko\'proq ishlaydi.'],
  ['fly', 'Gantel yoyish', 'Ko\'krak', 'Gantel', 2, ['Yelka'], 'Yotib gantellarni yuqorida ushlang|Tirsaklarni sal bukib yon tomonga yoying|Ko\'krakda cho\'zilishni his qiling|Yoy shaklida qaytaring', 'Og\'ir emas, nazorat muhim.'],
  ['cable', 'Kabel krossover', 'Ko\'krak', 'Blok', 2, ['Yelka'], 'Bloklarni yuqoriga o\'rnating|Bir oyoq oldinda turing|Qo\'llarni pastga-oldinga yig\'ing|Ko\'krakni 1 soniya siqib turing', 'Tanani bukmang, faqat qo\'l harakatlansin.'],

  ['pullup', 'Turnikda tortilish', 'Orqa', 'Turnik', 3, ['Biceps'], 'Turnikni yelkadan kengroq ushlang|Kurakni pastga tortib boshlang|Iyak turnikdan o\'tguncha torting|Sekin pastga tushing', 'Qiyin bo\'lsa rezina yoki salbiy (sekin tushish) tortilishdan boshlang.'],
  ['latpd', 'Yuqori blokni tortish', 'Orqa', 'Blok', 1, ['Biceps'], 'Tizzalarni valikka mahkamlang|Dastani ko\'krak yuqorisigacha torting|Tirsaklarni pastga-orqaga yo\'naltiring|Sekin qaytaring', 'Boshingiz orqasiga tortmang.'],
  ['brow', 'Shtanga tortish (egilib)', 'Orqa', 'Shtanga', 2, ['Biceps', 'Yelka'], 'Tizzalar sal bukilgan, bel to\'g\'ri|Tana ~45° egilgan|Shtangani kindik tomon torting|Kurakni siqing', 'Belni yumaloq qilmang, yuk og\'ir bo\'lsa kamaytiring.'],
  ['dbrow', 'Bir qo\'l bilan gantel tortish', 'Orqa', 'Gantel', 1, ['Biceps'], 'Bir qo\'l va tizza bilan skameykaga tayaning|Gantelni belga qarab torting|Yuqorida orqani siqing|Sekin tushiring', 'Tanani burmang.'],
  ['seatrow', 'Pastki blokni tortish', 'Orqa', 'Blok', 1, ['Biceps'], 'Tik o\'tirib dastani ushlang|Dastani qorin tomon torting|Kurakni birlashtiring|Sekin qaytaring', 'Orqaga ortiqcha engashmang.'],
  ['deadlift', 'Deadlift (tortish)', 'Orqa', 'Shtanga', 3, ['Oyoq'], 'Shtanga oyoq o\'rtasi ustida|Bel to\'g\'ri, ko\'krak ko\'tarilgan|Oyoq bilan yerni itaring, shtanga oyoqqa yaqin|Yuqorida dumbani siqing', 'Eng qiyin mashq: texnikani yengil vaznda mashq qiling.'],
  ['hyper', 'Giperekstenziya', 'Orqa', 'Skameyka', 1, ['Oyoq'], 'Son tayanchda, oyoqlar mahkam|Tanani belgacha pastga tushiring|Dumba va belni siqib ko\'taring|Yuqorida ortiqcha egilmang', 'Tezlik emas, nazorat.'],

  ['squat', 'Shtanga bilan o\'tirib turish', 'Oyoq', 'Shtanga', 3, ['Press'], 'Shtanga trapetsiyada, oyoqlar yelka kengligida|Dumbani orqaga tortib o\'tiring|Sonlar polga parallel bo\'lguncha|Tovon bilan itarib turing', 'Tizzalar oyoq uchi yo\'nalishida bo\'lsin.'],
  ['legpress', 'Oyoq pressi', 'Oyoq', 'Trenajyor', 1, [], 'Orqani to\'liq suyang|Oyoqlar platformada yelka kengligida|Tizzalar 90° gacha tushiring|Tovon bilan itaring', 'Tizzalarni oxirigacha qulflab yubormang.'],
  ['rdl', 'Rumin deadlift', 'Oyoq', 'Shtanga', 2, ['Orqa'], 'Tizzalar sal bukilgan|Dumbani orqaga cho\'zib engashing|Shtanga oyoq bo\'ylab tushsin|Son orqasida cho\'zilishni his qilib turing', 'Bel doim to\'g\'ri.'],
  ['lunge', 'Lunj', 'Oyoq', 'Gantel', 1, ['Press'], 'Katta qadam tashlang|Orqa tizza polga yaqinlashguncha tushing|Old tovon bilan itarib qayting|Oyoqlarni almashtiring', 'Old tizza oyoq uchidan oshmasin.'],
  ['legext', 'Oyoq yozish', 'Oyoq', 'Trenajyor', 1, [], 'Tizza o\'qini mashina o\'qiga to\'g\'rilang|Oyoqlarni to\'liq yozing|Yuqorida 1 soniya ushlang|Sekin tushiring', 'Zarbasiz harakat qiling.'],
  ['legcurl', 'Oyoq bukish', 'Oyoq', 'Trenajyor', 1, [], 'Yotib yostiqni tovon ustiga qo\'ying|Tovonni dumbaga qarab torting|Siqib turing|Sekin qaytaring', 'Dumbani ko\'tarmang.'],
  ['calf', 'Boldir ko\'tarish', 'Oyoq', 'Trenajyor', 1, [], 'Oyoq uchida turing, tovon bo\'sh|Eng yuqoriga ko\'tariling|1 soniya ushlang|To\'liq cho\'zilguncha tushing', 'Boldir sekin javob beradi: ko\'p takror va to\'liq amplituda.'],
  ['goblet', 'Goblet skvat', 'Oyoq', 'Gantel', 1, ['Press'], 'Gantelni ko\'krak oldida ushlang|Oyoqlar yelkadan kengroq|Tik tanani saqlab chuqur o\'tiring|Tovon bilan itaring', 'Boshlovchilar uchun eng yaxshi skvat varianti.'],
  ['hipthrust', 'Dumba ko\'prigi (hip thrust)', 'Oyoq', 'Shtanga', 2, ['Press'], 'Kurakni skameykaga tirang|Shtangani son ustiga qo\'ying|Tovon bilan itarib dumbani ko\'taring|Yuqorida siqing', 'Iyakni ko\'kragaga tortib turing.'],
  ['airsquat', 'Vaznsiz skvat', 'Oyoq', 'Tana vazni', 1, [], 'Oyoqlar yelka kengligida|Dumbani orqaga tortib o\'tiring|Ko\'krakni ko\'tarib turing|Tovon bilan turing', 'Uyda sonlarni qizdirish uchun yaxshi.'],
  ['glutebr', 'Dumba ko\'prigi (yerdan)', 'Oyoq', 'Tana vazni', 1, ['Press'], 'Yerda yotib tizzalarni buking|Tovon bilan itarib dumbani ko\'taring|Yuqorida siqing|Sekin tushiring', 'Bir oyoqda qilsangiz qiyinlashadi.'],
  ['bulg', 'Bolgar split-skvat', 'Oyoq', 'Gantel', 2, ['Press'], 'Orqa oyoqni skameykaga qo\'ying|Old oyoqda pastga tushing|Tik tanani saqlang|Old tovon bilan itaring', 'Muvozanat qiyin: avval vaznsiz urining.'],

  ['ohp', 'Armiya pressi', 'Yelka', 'Shtanga', 2, ['Triceps', 'Press'], 'Shtanga o\'mrov ustida|Qorin va dumbani tarang tuting|Boshingiz orqali shtangani tepaga itaring|Sekin tushiring', 'Belni egmang, qorin tarang bo\'lsin.'],
  ['latraise', 'Gantel yon ko\'tarish', 'Yelka', 'Gantel', 1, [], 'Gantellar yon tomonda|Tirsak sal bukilgan|Yelka balandligigacha ko\'taring|Sekin tushiring', 'Yengil vazn, toza texnika. Silkitmang.'],
  ['reardelt', 'Orqa delta (reverse fly)', 'Yelka', 'Gantel', 1, ['Orqa'], 'Oldinga engashing|Gantellarni yonga yoying|Kurakni siqing|Sekin qaytaring', 'Yengil vazndan boshlang.'],
  ['facepull', 'Face pull', 'Yelka', 'Blok', 1, ['Orqa'], 'Arqonni yuz balandligiga o\'rnating|Yuzga qarab torting|Tirsaklar yuqorida|Orqa deltani siqing', 'Yelka sog\'lig\'i uchun juda foydali.'],
  ['shrug', 'Trapetsiya (shrug)', 'Yelka', 'Gantel', 1, ['Orqa'], 'Gantellar yon tomonda|Yelkani quloqqa qarab ko\'taring|1 soniya ushlang|Sekin tushiring', 'Aylantirmang, faqat tepaga.'],
  ['pike', 'Pike otjimaniya', 'Yelka', 'Tana vazni', 2, ['Triceps'], 'Tanani teskari V shaklga keltiring|Boshingizni polga tushiring|Yelkalar bilan itaring|Takrorlang', 'Oyoqlarni stulga qo\'ysangiz qiyinlashadi.'],

  ['barcurl', 'Shtanga biceps', 'Biceps', 'Shtanga', 1, [], 'Tirsaklar tanaga yopishgan|Shtangani yelkaga qarab ko\'taring|Yuqorida siqing|Sekin tushiring', 'Tanani silkitmang.'],
  ['hammer', 'Bolg\'a (hammer) curl', 'Biceps', 'Gantel', 1, [], 'Gantellarni neytral ushlang|Navbat bilan ko\'taring|Tirsakni qimirlatmang|Sekin tushiring', 'Bilak va brachialisni ham ishlatadi.'],
  ['inclcurl', 'Qiya skameykada biceps', 'Biceps', 'Gantel', 2, [], 'Skameykani 60° ga qo\'ying|Qo\'llar orqada osilib tursin|Gantelni ko\'taring|Cho\'zilishni his qiling', 'Eng yaxshi cho\'zilish beradi.'],
  ['preacher', 'Skott skameykasida biceps', 'Biceps', 'Shtanga', 1, [], 'Qo\'llar yostiqda|Shtangani ko\'taring|Yuqorida siqing|Sekin tushiring', 'Pastda tirsakni to\'liq yozmang.'],

  ['skull', 'Frantsuz pressi', 'Triceps', 'Shtanga', 2, [], 'Yotib shtangani tepaga ushlang|Tirsaklarni qimirlatmay peshonaga tushiring|Tricepsni siqib yozing|Takrorlang', 'Tirsaklar yon tomonga ochilmasin.'],
  ['pushdown', 'Blokda triceps', 'Triceps', 'Blok', 1, [], 'Yuqori blokka yuzlanib turing|Tirsaklarni yonga mahkamlang|Pastga to\'liq yozing|Sekin qaytaring', 'Tirsak faqat bukiladi, yelka qimirlamaydi.'],
  ['closegrip', 'Tor ushlab siqish', 'Triceps', 'Shtanga', 2, ['Ko\'krak', 'Yelka'], 'Yelka kengligida ushlang|Tirsaklarni tanaga yaqin tuting|Pastki ko\'krakka tushiring|Tricepsni ishlatib itaring', 'Juda tor ushlamang (bilakka zarar).'],
  ['ohext', 'Bosh ustida triceps', 'Triceps', 'Gantel', 1, [], 'Gantelni bosh ustida ushlang|Tirsaklarni tepaga qaratib bosh orqasiga tushiring|Yuqoriga yozing|Takrorlang', 'Cho\'zilish uchun eng yaxshilaridan.'],
  ['benchdip', 'Skameykada dips', 'Triceps', 'Tana vazni', 1, ['Yelka'], 'Qo\'llar orqada skameykada|Oyoqlar oldinda|Tirsaklarni bukib tushing|Itarib ko\'tariling', 'Yelka og\'rigan bo\'lsa amplituda kamaytiring.'],

  ['plank', 'Plank', 'Press', 'Tana vazni', 1, ['Yelka'], 'Tirsaklarda tayaning|Tana to\'g\'ri chiziq|Qorin va dumbani siqing|Nafas oling va ushlab turing', 'Belni pastga tushirmang.'],
  ['legraise', 'Oyoq ko\'tarish', 'Press', 'Turnik', 2, [], 'Turnikda osiling|Oyoqlarni to\'g\'ri ko\'taring|Belni burab, tos suyagini ko\'taring|Sekin tushiring', 'Qiyin bo\'lsa tizzani bukib ko\'taring.'],
  ['crunch', 'Crunch', 'Press', 'Tana vazni', 1, [], 'Yotib tizzalarni buking|Kurakni yerdan uzing|Qorinni siqing|Sekin qaytaring', 'Bo\'ynini tortmang.'],
  ['russian', 'Russian twist', 'Press', 'Tana vazni', 1, [], 'O\'tirib orqani suyaning|Oyoqlarni ko\'taring|Tanani chapga-o\'ngga buring|Qo\'llar bilan yerga teging', 'Og\'irlik ushlab qiyinlashtirish mumkin.'],
  ['abwheel', 'G\'ildirak bilan press', 'Press', 'G\'ildirak', 3, ['Yelka'], 'Tizzada turib g\'ildirakni ushlang|Oldinga yuring, bel to\'g\'ri|Qorin tarang|Qaytib keling', 'Belni egilib ketishidan saqlaning.'],
  ['mountain', 'Mountain climber', 'Press', 'Tana vazni', 1, ['Kardio'], 'Otjimaniya holatida turing|Tizzalarni navbat bilan ko\'kragaga torting|Tez harakatlaning|Tana barqaror', 'Kardio + press birga.'],

  ['treadmill', 'Yugurish yo\'lakchasi', 'Kardio', 'Trenajyor', 1, ['Oyoq'], 'Yengil tezlikdan boshlang|Oyoqni to\'g\'ri qo\'ying|Qo\'llar erkin|Tezlikni asta oshiring', 'Isitish sifatida 5 daqiqa.'],
  ['bike', 'Velotrenajyor', 'Kardio', 'Trenajyor', 1, ['Oyoq'], 'O\'rindiqni belga moslang|Tekis aylantiring|Qarshilikni oshirib boring|Nafasni nazorat qiling', 'Tizzaga yengil kardio.'],
  ['rope', 'Arqon sakrash', 'Kardio', 'Arqon', 2, ['Oyoq'], 'Tirsaklar yonda|Bilak bilan aylantiring|Yengil sakrang|Ritm saqlang', 'Eng samarali kardio.'],
  ['rowing', 'Eshkak trenajyori', 'Kardio', 'Trenajyor', 2, ['Orqa', 'Oyoq'], 'Oyoq bilan itaring|Keyin tanani orqaga yoying|Qo\'llarni torting|Teskari tartibda qayting', 'Avval oyoq, keyin tana, keyin qo\'l.'],
  ['burpee', 'Burpee', 'Kardio', 'Tana vazni', 2, ['Ko\'krak', 'Oyoq'], 'Cho\'kka tushing|Oyoqlarni orqaga tashlang|Otjimaniya qiling|Sakrab turing', 'Ritmni saqlang, shoshmang.'],
];

const EXERCISES = EX_RAW.map(([id, name, group, equip, level, sec, steps, tip]) =>
  ({ id, name, group, equip, level, sec, steps: steps.split('|'), tip }));

// Animatsiya: free-exercise-db (ommaviy domen) rasmlari img/ papkasida, har mashq uchun 2 ta holat
const ANIM_BASE = 'img/';
const ANIM = {
  bench: 'Barbell_Bench_Press_-_Medium_Grip', incdb: 'Incline_Dumbbell_Press', dbpress: 'Dumbbell_Bench_Press', pushup: 'Pushups',
  dips: 'Dips_-_Chest_Version', fly: 'Dumbbell_Flyes', cable: 'Cable_Crossover',
  pullup: 'Pullups', latpd: 'Wide-Grip_Lat_Pulldown', brow: 'Bent_Over_Barbell_Row', dbrow: 'One-Arm_Dumbbell_Row',
  seatrow: 'Seated_Cable_Rows', deadlift: 'Barbell_Deadlift', hyper: 'Hyperextensions_Back_Extensions',
  squat: 'Barbell_Squat', legpress: 'Leg_Press', rdl: 'Romanian_Deadlift', lunge: 'Dumbbell_Lunges', legext: 'Leg_Extensions',
  legcurl: 'Lying_Leg_Curls', calf: 'Standing_Calf_Raises', goblet: 'Goblet_Squat', hipthrust: 'Barbell_Hip_Thrust',
  airsquat: 'Bodyweight_Squat', glutebr: 'Butt_Lift_Bridge', bulg: 'Split_Squats',
  ohp: 'Standing_Military_Press', latraise: 'Side_Lateral_Raise', reardelt: 'Reverse_Flyes', facepull: 'Face_Pull', shrug: 'Dumbbell_Shrug',
  barcurl: 'Barbell_Curl', hammer: 'Hammer_Curls', inclcurl: 'Incline_Dumbbell_Curl', preacher: 'Preacher_Curl',
  skull: 'EZ-Bar_Skullcrusher', pushdown: 'Triceps_Pushdown', closegrip: 'Close-Grip_Barbell_Bench_Press',
  ohext: 'Standing_Dumbbell_Triceps_Extension', benchdip: 'Bench_Dips',
  plank: 'Plank', legraise: 'Hanging_Leg_Raise', crunch: 'Crunches', russian: 'Russian_Twist', abwheel: 'Ab_Roller', mountain: 'Mountain_Climbers',
  treadmill: 'Running_Treadmill', bike: 'Bicycling_Stationary', rope: 'Rope_Jumping', rowing: 'Rowing_Stationary',
};

// mashq: [id, set, takror, dam olish (s)]
const PROGRAMS = [
  { id: 'ppl', name: 'Push / Pull / Legs', tag: '3–6 kun · O\'rta', desc: 'Itarish, tortish va oyoq kunlari. Massa yig\'ish uchun klassik.', days: [
    { name: 'Push · Ko\'krak, yelka, triceps', ex: [['bench', 4, '6-8', 120], ['incdb', 3, '8-10', 90], ['ohp', 3, '8-10', 90], ['latraise', 3, '12-15', 60], ['pushdown', 3, '10-12', 60], ['ohext', 2, '12', 60]] },
    { name: 'Pull · Orqa, biceps', ex: [['pullup', 4, '6-10', 120], ['brow', 3, '8-10', 90], ['seatrow', 3, '10-12', 90], ['facepull', 3, '12-15', 60], ['barcurl', 3, '8-10', 60], ['hammer', 2, '10-12', 60]] },
    { name: 'Legs · Oyoq', ex: [['squat', 4, '6-8', 150], ['rdl', 3, '8-10', 120], ['legpress', 3, '10-12', 90], ['legcurl', 3, '10-12', 60], ['calf', 4, '12-15', 45], ['plank', 3, '45', 45]] },
  ] },
  { id: 'full', name: 'Full Body', tag: '3 kun · Boshlang\'ich', desc: 'Har mashg\'ulotda butun tana. Yangi boshlovchilar uchun eng yaxshi.', days: [
    { name: 'A kun', ex: [['squat', 3, '8', 120], ['bench', 3, '8', 120], ['brow', 3, '8-10', 90], ['ohp', 2, '10', 90], ['plank', 3, '45', 45]] },
    { name: 'B kun', ex: [['deadlift', 3, '5', 150], ['incdb', 3, '10', 90], ['latpd', 3, '10', 90], ['lunge', 3, '10', 75], ['barcurl', 2, '12', 60], ['pushdown', 2, '12', 60]] },
    { name: 'C kun', ex: [['legpress', 3, '12', 90], ['dips', 3, '8-10', 90], ['dbrow', 3, '10', 75], ['latraise', 3, '15', 60], ['hipthrust', 3, '10', 90], ['crunch', 3, '15', 45]] },
  ] },
  { id: 'ul', name: 'Upper / Lower', tag: '4 kun · O\'rta', desc: 'Tepa va past tana navbatma-navbat. Kuch va hajm muvozanati.', days: [
    { name: 'Upper A · Kuch', ex: [['bench', 4, '6-8', 120], ['brow', 4, '6-8', 120], ['ohp', 3, '8-10', 90], ['latpd', 3, '10', 75], ['barcurl', 2, '10', 60], ['skull', 2, '10', 60]] },
    { name: 'Lower A · Kuch', ex: [['squat', 4, '6-8', 150], ['rdl', 3, '8-10', 120], ['legpress', 3, '12', 90], ['legcurl', 3, '12', 60], ['calf', 4, '12', 45]] },
    { name: 'Upper B · Hajm', ex: [['incdb', 4, '8-10', 90], ['pullup', 4, '6-10', 120], ['latraise', 3, '15', 60], ['seatrow', 3, '10-12', 75], ['hammer', 3, '12', 60], ['pushdown', 3, '12', 60]] },
    { name: 'Lower B · Hajm', ex: [['deadlift', 3, '5', 150], ['bulg', 3, '10', 90], ['legext', 3, '12', 60], ['hipthrust', 3, '10', 90], ['calf', 4, '15', 45], ['legraise', 3, '12', 60]] },
  ] },
  { id: 'bro', name: 'Bro Split', tag: '5 kun · Ilg\'or', desc: 'Har kun bitta mushak guruhi. Yuqori hajm, ko\'p dam olish.', days: [
    { name: 'Ko\'krak', ex: [['bench', 4, '8', 120], ['incdb', 4, '10', 90], ['dips', 3, '10', 90], ['fly', 3, '12', 60], ['cable', 3, '12', 60]] },
    { name: 'Orqa', ex: [['deadlift', 3, '5', 150], ['pullup', 4, '8', 120], ['brow', 4, '8', 90], ['seatrow', 3, '10', 75], ['hyper', 3, '12', 60]] },
    { name: 'Oyoq', ex: [['squat', 4, '8', 150], ['legpress', 4, '12', 90], ['rdl', 3, '10', 90], ['legext', 3, '12', 60], ['legcurl', 3, '12', 60], ['calf', 4, '15', 45]] },
    { name: 'Yelka', ex: [['ohp', 4, '8', 120], ['latraise', 4, '12', 60], ['reardelt', 4, '12', 60], ['shrug', 4, '12', 60], ['facepull', 3, '15', 60]] },
    { name: 'Qo\'l + Press', ex: [['barcurl', 3, '10', 60], ['skull', 3, '10', 60], ['hammer', 3, '12', 60], ['pushdown', 3, '12', 60], ['legraise', 3, '15', 45], ['abwheel', 3, '10', 60]] },
  ] },
  { id: 'home', name: 'Uyda mashg\'ulot', tag: '3 kun · Jihozsiz', desc: 'Zal kerak emas. Faqat tana vazni bilan.', days: [
    { name: 'Uy A · Itarish', ex: [['pushup', 4, '12', 60], ['airsquat', 4, '20', 45], ['pike', 3, '8-10', 60], ['plank', 3, '45', 45]] },
    { name: 'Uy B · Oyoq', ex: [['lunge', 3, '12', 60], ['glutebr', 4, '15', 45], ['benchdip', 3, '12', 60], ['mountain', 3, '30', 45]] },
    { name: 'Uy C · Kondisioner', ex: [['burpee', 4, '10', 60], ['pushup', 3, '12', 60], ['bulg', 3, '10', 60], ['crunch', 3, '20', 45], ['legraise', 3, '12', 45]] },
  ] },
];

// 100 g (yoki ml) uchun: kkal, oqsil, uglevod, yog'; piece = 1 dona gramm
const FOODS = {
  chicken: { n: 'Tovuq ko\'kragi', k: 165, p: 31, c: 0, f: 3.6 },
  turkey: { n: 'Kurka go\'shti', k: 135, p: 29, c: 0, f: 2 },
  beef: { n: 'Mol go\'shti (yog\'siz)', k: 187, p: 26, c: 0, f: 9 },
  egg: { n: 'Tuxum', k: 155, p: 13, c: 1.1, f: 11, piece: 50 },
  tvorog: { n: 'Tvorog 5%', k: 121, p: 17, c: 3, f: 5 },
  yogurt: { n: 'Yogurt (shakarsiz)', k: 60, p: 3.5, c: 5, f: 3 },
  kefir: { n: 'Kefir / qatiq', k: 41, p: 3.4, c: 4, f: 1 },
  milk: { n: 'Sut 2.5%', k: 52, p: 2.8, c: 4.7, f: 2.5 },
  cheese: { n: 'Pishloq', k: 350, p: 25, c: 1, f: 27 },
  oats: { n: 'Jo\'xori yormasi (quruq)', k: 370, p: 13, c: 62, f: 7 },
  buckwheat: { n: 'Grechka (quruq)', k: 340, p: 12, c: 66, f: 3 },
  rice: { n: 'Guruch (quruq)', k: 350, p: 7, c: 78, f: 0.7 },
  pasta: { n: 'Makaron (quruq)', k: 350, p: 12, c: 72, f: 1.5 },
  lentil: { n: 'Yasmiq (quruq)', k: 350, p: 25, c: 60, f: 1.5 },
  bread: { n: 'Non', k: 250, p: 8, c: 50, f: 1.5 },
  potato: { n: 'Kartoshka', k: 77, p: 2, c: 17, f: 0.1 },
  plov: { n: 'Osh (palov)', k: 180, p: 6, c: 25, f: 7 },
  banana: { n: 'Banan', k: 89, p: 1.1, c: 23, f: 0.3, piece: 120 },
  apple: { n: 'Olma', k: 52, p: 0.3, c: 14, f: 0.2, piece: 150 },
  dates: { n: 'Xurmo (quritilgan)', k: 280, p: 2.5, c: 75, f: 0.4 },
  walnut: { n: 'Yong\'oq', k: 654, p: 15, c: 14, f: 65 },
  almond: { n: 'Bodom', k: 579, p: 21, c: 22, f: 50 },
  pbutter: { n: 'Yeryong\'oq pastasi', k: 588, p: 25, c: 20, f: 50 },
  oil: { n: 'O\'simlik / zaytun moyi', k: 884, p: 0, c: 0, f: 100 },
  honey: { n: 'Asal', k: 304, p: 0.3, c: 82, f: 0 },
  salmon: { n: 'Losos baliq', k: 208, p: 20, c: 0, f: 13 },
  tuna: { n: 'Tuna (konserva)', k: 116, p: 26, c: 0, f: 1 },
  whey: { n: 'Protein kukuni', k: 380, p: 80, c: 6, f: 5 },
  broccoli: { n: 'Brokkoli', k: 34, p: 2.8, c: 7, f: 0.4 },
  carrot: { n: 'Sabzi', k: 41, p: 1, c: 10, f: 0.2 },
  cucumber: { n: 'Bodring', k: 15, p: 0.7, c: 3.6, f: 0.1 },
  tomato: { n: 'Pomidor', k: 18, p: 0.9, c: 3.9, f: 0.2 },
};

// reja: [ovqat nomi, [[oziq, gramm], ...]]
const MEAL_PLANS = {
  massa: { name: 'Massa yig\'ish', icon: '📈', variants: [
    [['Nonushta', [['oats', 90], ['milk', 250], ['banana', 120], ['egg', 150], ['honey', 15]]], ['Snack 1', [['tvorog', 200], ['walnut', 25], ['apple', 150]]],
      ['Tushlik', [['chicken', 200], ['rice', 120], ['tomato', 100], ['cucumber', 100], ['oil', 10]]], ['Mashqdan keyin', [['banana', 120], ['whey', 30], ['bread', 60], ['pbutter', 25]]],
      ['Kechki ovqat', [['beef', 180], ['potato', 300], ['broccoli', 150], ['oil', 10]]]],
    [['Nonushta', [['egg', 200], ['bread', 100], ['cheese', 40], ['tomato', 100]]], ['Snack 1', [['yogurt', 300], ['oats', 50], ['almond', 30]]],
      ['Tushlik', [['plov', 350], ['chicken', 120], ['cucumber', 150]]], ['Snack 2', [['kefir', 300], ['dates', 50], ['walnut', 20]]],
      ['Kechki ovqat', [['salmon', 180], ['pasta', 100], ['broccoli', 150], ['oil', 10]]]],
  ] },
  saqlash: { name: 'Vaznni saqlash', icon: '⚖️', variants: [
    [['Nonushta', [['oats', 70], ['milk', 200], ['egg', 100], ['apple', 150]]], ['Snack 1', [['yogurt', 200], ['almond', 20]]],
      ['Tushlik', [['chicken', 180], ['buckwheat', 80], ['cucumber', 150], ['tomato', 100], ['oil', 8]]], ['Snack 2', [['tvorog', 150], ['banana', 100]]],
      ['Kechki ovqat', [['beef', 150], ['potato', 200], ['broccoli', 150], ['oil', 8]]]],
    [['Nonushta', [['egg', 150], ['bread', 70], ['cucumber', 100]]], ['Snack 1', [['kefir', 250], ['walnut', 20], ['apple', 150]]],
      ['Tushlik', [['turkey', 180], ['rice', 80], ['carrot', 100], ['oil', 8]]], ['Snack 2', [['whey', 30], ['banana', 100]]],
      ['Kechki ovqat', [['salmon', 150], ['potato', 200], ['tomato', 150]]]],
  ] },
  kesish: { name: 'Vazn tashlash', icon: '🔥', variants: [
    [['Nonushta', [['oats', 50], ['milk', 200], ['egg', 100]]], ['Snack 1', [['apple', 150], ['tvorog', 150]]],
      ['Tushlik', [['chicken', 180], ['buckwheat', 60], ['cucumber', 200], ['tomato', 150], ['oil', 5]]], ['Snack 2', [['yogurt', 150], ['almond', 15]]],
      ['Kechki ovqat', [['tuna', 120], ['broccoli', 250], ['potato', 150]]]],
    [['Nonushta', [['egg', 150], ['tomato', 150], ['bread', 40]]], ['Snack 1', [['kefir', 250], ['apple', 150]]],
      ['Tushlik', [['turkey', 180], ['lentil', 60], ['cucumber', 200], ['oil', 5]]], ['Snack 2', [['tvorog', 200]]],
      ['Kechki ovqat', [['salmon', 130], ['broccoli', 250], ['carrot', 100]]]],
  ] },
};

const QUOTES = [
  'Bugungi qiyinchilik ertangi kuchingiz.', 'Mukammal emas, izchil bo\'ling.', 'Kichik qadamlar katta natija beradi.',
  'Zalga kelish — yarim g\'alaba.', 'Og\'riq vaqtincha, g\'urur — abadiy.', 'Kecha bahona, bugun harakat.',
  'Tana siz bergan narsani qaytaradi.', 'Natija zalda emas, muntazamlikda.',
];

const ACHIEVEMENTS = [
  { id: 'first', i: '🥇', n: 'Birinchi qadam', d: 'Birinchi mashg\'ulotni tugating', ok: s => s.workouts.length >= 1 },
  { id: 'w10', i: '🔟', n: '10 mashg\'ulot', d: '10 ta mashg\'ulot bajaring', ok: s => s.workouts.length >= 10 },
  { id: 'w50', i: '🏅', n: '50 mashg\'ulot', d: '50 ta mashg\'ulot bajaring', ok: s => s.workouts.length >= 50 },
  { id: 'w100', i: '🏆', n: 'Yuzlik', d: '100 ta mashg\'ulot bajaring', ok: s => s.workouts.length >= 100 },
  { id: 'streak3', i: '🔥', n: '3 ta seriya', d: 'Seriya 3 ga yetsin', ok: s => s.streak >= 3 },
  { id: 'streak7', i: '⚡', n: 'Haftalik seriya', d: 'Seriya 7 ga yetsin', ok: s => s.streak >= 7 },
  { id: 'streak30', i: '🌋', n: 'Temir iroda', d: 'Seriya 30 ga yetsin', ok: s => s.streak >= 30 },
  { id: 'sets100', i: '💯', n: '100 set', d: 'Jami 100 set bajaring', ok: s => s.log.length >= 100 },
  { id: 'sets1000', i: '🚀', n: '1000 set', d: 'Jami 1000 set bajaring', ok: s => s.log.length >= 1000 },
  { id: 'ton1', i: '🏗️', n: '1 tonna', d: 'Umumiy hajm 1 tonnaga yetsin', ok: s => s.volume >= 1000 },
  { id: 'ton20', i: '🚛', n: '20 tonna', d: 'Umumiy hajm 20 tonnaga yetsin', ok: s => s.volume >= 20000 },
  { id: 'allgroups', i: '🧬', n: 'Butun tana', d: 'Barcha mushak guruhlarini ishlating', ok: s => GROUPS.every(g => s.groupsDone.has(g)) },
  { id: 'weekgoal', i: '🎯', n: 'Haftalik maqsad', d: 'Haftalik maqsadni bajaring', ok: s => s.weekCount >= s.weeklyGoal },
  { id: 'pr', i: '📈', n: 'Rekordchi', d: 'Birinchi shaxsiy rekordni o\'rnating', ok: s => s.prCount >= 1 },
  { id: 'bw5', i: '⚖️', n: 'Nazoratchi', d: 'Tana vaznini 5 marta kiriting', ok: s => s.bw.length >= 5 },
  { id: 'diet7', i: '🥗', n: 'Dieta intizomi', d: '7 kun ovqat kiriting', ok: s => new Set(s.meals.map(m => m.date)).size >= 7 },
  { id: 'water', i: '💧', n: 'Suv ustasi', d: 'Bir kunda suv maqsadini bajaring', ok: s => s.waterGoalDays >= 1 },
  { id: 'lvl5', i: '👑', n: '5-daraja', d: '5-darajaga chiqing', ok: s => s.level >= 5 },
];
