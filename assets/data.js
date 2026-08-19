/* ============================================================================
   trips.kz — демонстрационный набор данных.

   PRODUCT.md прямо запрещает подавать невыверенное как факт: реальных цен,
   отелей, наличия мест и отзывов у проекта нет. Поэтому всё ниже — открыто
   помеченные заглушки, а не «почти правда»: названия отелей вымышлены, цены
   считаются формулой, наличие мест генерируется. География при этом настоящая
   и казахстанская — города вылета и направления по образцу рынка РК.

   Данные строятся под выбранный город вылета: Data.build(cityId) возвращает
   один и тот же результат для одного и того же города (детерминированный
   генератор), поэтому цифры не пляшут между перезагрузками.
   ========================================================================== */
window.Data = (function () {

  /* --- Города вылета. Алматы и Астана первыми — PRODUCT.md ---------------- */
  var CITIES = [
    { id: 'ala', code: 'ALA', main: true,  mul: 1.00, name: { ru: 'Алматы', kk: 'Алматы', en: 'Almaty' } , gen: 'Алматы' },
    { id: 'nqz', code: 'NQZ', main: true,  mul: 1.06, name: { ru: 'Астана', kk: 'Астана', en: 'Astana' } , gen: 'Астаны' },
    { id: 'cit', code: 'CIT', main: false, mul: 0.94, name: { ru: 'Шымкент', kk: 'Шымкент', en: 'Shymkent' } , gen: 'Шымкента' },
    { id: 'kgf', code: 'KGF', main: false, mul: 1.02, name: { ru: 'Караганда', kk: 'Қарағанды', en: 'Karaganda' } , gen: 'Караганды' },
    { id: 'akx', code: 'AKX', main: false, mul: 1.05, name: { ru: 'Актобе', kk: 'Ақтөбе', en: 'Aktobe' } , gen: 'Актобе' },
    { id: 'guw', code: 'GUW', main: false, mul: 1.08, name: { ru: 'Атырау', kk: 'Атырау', en: 'Atyrau' } , gen: 'Атырау' },
    { id: 'sco', code: 'SCO', main: false, mul: 1.03, name: { ru: 'Актау', kk: 'Ақтау', en: 'Aktau' } , gen: 'Актау' },
    { id: 'ksn', code: 'KSN', main: false, mul: 1.07, name: { ru: 'Костанай', kk: 'Қостанай', en: 'Kostanay' } , gen: 'Костаная' },
    { id: 'ppk', code: 'PPK', main: false, mul: 1.09, name: { ru: 'Петропавловск', kk: 'Петропавл', en: 'Petropavl' } , gen: 'Петропавловска' },
    { id: 'plx', code: 'PLX', main: false, mul: 1.06, name: { ru: 'Павлодар', kk: 'Павлодар', en: 'Pavlodar' } , gen: 'Павлодара' },
    { id: 'ukk', code: 'UKK', main: false, mul: 1.08, name: { ru: 'Усть-Каменогорск', kk: 'Өскемен', en: 'Oskemen' } , gen: 'Усть-Каменогорска' },
    { id: 'kzo', code: 'KZO', main: false, mul: 1.05, name: { ru: 'Кызылорда', kk: 'Қызылорда', en: 'Kyzylorda' } , gen: 'Кызылорды' },
    { id: 'ura', code: 'URA', main: false, mul: 1.08, name: { ru: 'Уральск', kk: 'Орал', en: 'Oral' } , gen: 'Уральска' }
  ];

  /* --- Направления. base — тенге на человека за 7 ночей, 3★, BB, из Алматы. */
  var COUNTRIES = [
    { id: 'tr', base: 168000, acc: 'Турцию', visaFree: true,  water: 26, air: 31, flight: 4.5, img: 'tr-antalya',
      name: { ru: 'Турция', kk: 'Түркия', en: 'Türkiye' },
      resorts: [
        { id: 'antalya', name: { ru: 'Анталья', kk: 'Анталья', en: 'Antalya' } },
        { id: 'kemer',   name: { ru: 'Кемер',   kk: 'Кемер',   en: 'Kemer' } },
        { id: 'side',    name: { ru: 'Сиде',    kk: 'Сиде',    en: 'Side' } },
        { id: 'alanya',  name: { ru: 'Аланья',  kk: 'Аланья',  en: 'Alanya' } },
        { id: 'belek',   name: { ru: 'Белек',   kk: 'Белек',   en: 'Belek' } }
      ] },
    { id: 'eg', base: 150000, acc: 'Египет', visaFree: true, water: 27, air: 33, flight: 5.5, img: 'eg-sharm',
      name: { ru: 'Египет', kk: 'Мысыр', en: 'Egypt' },
      resorts: [
        { id: 'hurghada', name: { ru: 'Хургада', kk: 'Хургада', en: 'Hurghada' } },
        { id: 'sharm',    name: { ru: 'Шарм-эль-Шейх', kk: 'Шарм-эш-Шейх', en: 'Sharm El Sheikh' } }
      ] },
    { id: 'ae', base: 175000, acc: 'ОАЭ', visaFree: true, water: 28, air: 34, flight: 4.5, img: 'ae-dubai',
      name: { ru: 'ОАЭ', kk: 'БАӘ', en: 'UAE' },
      resorts: [
        { id: 'dubai',  name: { ru: 'Дубай',  kk: 'Дубай',  en: 'Dubai' } },
        { id: 'sharjah', name: { ru: 'Шарджа', kk: 'Шарджа', en: 'Sharjah' } },
        { id: 'rak',    name: { ru: 'Рас-эль-Хайма', kk: 'Рас-әл-Хайма', en: 'Ras Al Khaimah' } }
      ] },
    { id: 'th', base: 209000, acc: 'Таиланд', visaFree: true, water: 29, air: 32, flight: 7.5, img: 'th-phuket',
      name: { ru: 'Таиланд', kk: 'Тайланд', en: 'Thailand' },
      resorts: [
        { id: 'phuket',  name: { ru: 'Пхукет',  kk: 'Пхукет',  en: 'Phuket' } },
        { id: 'pattaya', name: { ru: 'Паттайя', kk: 'Паттайя', en: 'Pattaya' } }
      ] },
    { id: 'vn', base: 204000, acc: 'Вьетнам', visaFree: true, water: 27, air: 30, flight: 8, img: 'vn-nhatrang',
      name: { ru: 'Вьетнам', kk: 'Вьетнам', en: 'Vietnam' },
      resorts: [ { id: 'nhatrang', name: { ru: 'Нячанг', kk: 'Нячанг', en: 'Nha Trang' } } ] },
    { id: 'cn', base: 110000, acc: 'Китай (о. Хайнань)', visaFree: true, water: 26, air: 29, flight: 6.5, img: 'cn-sanya',
      name: { ru: 'Китай (о. Хайнань)', kk: 'Қытай (Хайнань)', en: 'China (Hainan)' },
      resorts: [ { id: 'sanya', name: { ru: 'Санья', kk: 'Санья', en: 'Sanya' } } ] },
    { id: 'mv', base: 260000, acc: 'Мальдивы', visaFree: true, water: 29, air: 31, flight: 9, img: 'mv-male',
      name: { ru: 'Мальдивы', kk: 'Мальдив аралдары', en: 'Maldives' },
      resorts: [ { id: 'male', name: { ru: 'Северный Мале', kk: 'Солтүстік Мале', en: 'North Malé' } } ] },
    { id: 'lk', base: 222000, acc: 'Шри-Ланку', visaFree: false, water: 28, air: 30, flight: 8.5, img: 'lk-bentota',
      name: { ru: 'Шри-Ланка', kk: 'Шри-Ланка', en: 'Sri Lanka' },
      resorts: [ { id: 'bentota', name: { ru: 'Бентота', kk: 'Бентота', en: 'Bentota' } } ] },
    { id: 'id', base: 261000, acc: 'Индонезию (Бали)', visaFree: true, water: 28, air: 30, flight: 10, img: 'id-kuta',
      name: { ru: 'Индонезия (Бали)', kk: 'Индонезия (Бали)', en: 'Indonesia (Bali)' },
      resorts: [ { id: 'kuta', name: { ru: 'Кута', kk: 'Кута', en: 'Kuta' } } ] },
    { id: 'in', base: 213000, acc: 'Индию (Гоа)', visaFree: false, water: 28, air: 31, flight: 6, img: 'in-goa',
      name: { ru: 'Индия (Гоа)', kk: 'Үндістан (Гоа)', en: 'India (Goa)' },
      resorts: [ { id: 'goa', name: { ru: 'Северный Гоа', kk: 'Солтүстік Гоа', en: 'North Goa' } } ] },
    { id: 'cy', base: 200000, acc: 'Кипр', visaFree: false, water: 25, air: 29, flight: 5.5, img: 'cy-ayia',
      name: { ru: 'Кипр', kk: 'Кипр', en: 'Cyprus' },
      resorts: [ { id: 'ayia', name: { ru: 'Айя-Напа', kk: 'Айя-Напа', en: 'Ayia Napa' } } ] },
    { id: 'ge', base: 145000, acc: 'Грузию', visaFree: true, water: 24, air: 28, flight: 3.5, img: 'ge-batumi',
      name: { ru: 'Грузия', kk: 'Грузия', en: 'Georgia' },
      resorts: [ { id: 'batumi', name: { ru: 'Батуми', kk: 'Батуми', en: 'Batumi' } } ] },
    { id: 'az', base: 140000, acc: 'Азербайджан', visaFree: true, water: 23, air: 27, flight: 3, img: 'az-baku',
      name: { ru: 'Азербайджан', kk: 'Әзірбайжан', en: 'Azerbaijan' },
      resorts: [ { id: 'baku', name: { ru: 'Баку', kk: 'Баку', en: 'Baku' } } ] },
    { id: 'kg', base: 75000, acc: 'Кыргызстан', visaFree: true, water: 21, air: 26, flight: 1, img: 'kg-issyk',
      name: { ru: 'Кыргызстан', kk: 'Қырғызстан', en: 'Kyrgyzstan' },
      resorts: [ { id: 'issyk', name: { ru: 'Иссык-Куль', kk: 'Ыстықкөл', en: 'Issyk-Kul' } } ] },
    { id: 'uz', base: 95000, acc: 'Узбекистан', visaFree: true, water: 0, air: 30, flight: 2, img: 'uz-samarkand',
      name: { ru: 'Узбекистан', kk: 'Өзбекстан', en: 'Uzbekistan' },
      resorts: [ { id: 'samarkand', name: { ru: 'Самарканд', kk: 'Самарқанд', en: 'Samarkand' } } ] },
    { id: 'kz', base: 60000, acc: 'Казахстан', visaFree: true, water: 22, air: 27, flight: 1.2, img: 'kz-borovoe', domestic: true,
      name: { ru: 'Казахстан', kk: 'Қазақстан', en: 'Kazakhstan' },
      resorts: [
        { id: 'alakol',    name: { ru: 'Алаколь',   kk: 'Алакөл',    en: 'Alakol' } },
        { id: 'borovoe',   name: { ru: 'Боровое',   kk: 'Бурабай',   en: 'Borovoe' } },
        { id: 'kenderli',  name: { ru: 'Кендерли',  kk: 'Кендірлі',  en: 'Kenderli' } },
        { id: 'turkestan', name: { ru: 'Туркестан', kk: 'Түркістан', en: 'Turkestan' } },
        { id: 'saryagash', name: { ru: 'Сарыагаш',  kk: 'Сарыағаш',  en: 'Saryagash' } }
      ] },
    { id: 'es', base: 226000, acc: 'Испанию', visaFree: false, water: 24, air: 29, flight: 8, img: 'es-costabrava',
      name: { ru: 'Испания', kk: 'Испания', en: 'Spain' },
      resorts: [ { id: 'costabrava', name: { ru: 'Коста-Брава', kk: 'Коста-Брава', en: 'Costa Brava' } } ] },
    { id: 'cz', base: 183000, acc: 'Чехию', visaFree: false, water: 0, air: 24, flight: 7, img: 'cz-prague',
      name: { ru: 'Чехия', kk: 'Чехия', en: 'Czechia' },
      resorts: [ { id: 'prague', name: { ru: 'Прага', kk: 'Прага', en: 'Prague' } } ] },
    { id: 'my', base: 244000, acc: 'Малайзию', visaFree: true, water: 29, air: 31, flight: 9, img: 'my-langkawi',
      name: { ru: 'Малайзия', kk: 'Малайзия', en: 'Malaysia' },
      resorts: [ { id: 'langkawi', name: { ru: 'Лангкави', kk: 'Лангкави', en: 'Langkawi' } } ] },
    { id: 'cu', base: 408000, acc: 'Кубу', visaFree: true, water: 28, air: 30, flight: 16, img: 'cu-varadero',
      name: { ru: 'Куба', kk: 'Куба', en: 'Cuba' },
      resorts: [ { id: 'varadero', name: { ru: 'Варадеро', kk: 'Варадеро', en: 'Varadero' } } ] },
    { id: 'do', base: 442000, acc: 'Доминикану', visaFree: true, water: 28, air: 31, flight: 17, img: 'do-punta',
      name: { ru: 'Доминикана', kk: 'Доминикана', en: 'Dominican Rep.' },
      resorts: [ { id: 'punta', name: { ru: 'Пунта-Кана', kk: 'Пунта-Кана', en: 'Punta Cana' } } ] }
  ];

  /* --- Питание, пляж, услуги, тип отдыха ---------------------------------- */
  /* Состав питания, пляжа, удобств и типов отдыха повторяет набор, принятый в
     российских турагрегаторах (travelata и аналоги): турист приходит в выдачу
     с уже усвоенным списком условий, и свой, «более логичный» набор он читает
     как отсутствие привычного фильтра. Порядок значений тоже их — от «всё
     включено» к «без питания», а не наоборот. */
  var MEALS = [
    { id: 'UAI',     name: { ru: 'UAI · Ультра всё включено', kk: 'UAI · Ультра бәрі қосылған', en: 'UAI · Ultra all inclusive' }, mul: 1.40 },
    { id: 'AI',      name: { ru: 'AI · Всё включено',         kk: 'AI · Бәрі қосылған',         en: 'AI · All inclusive' },        mul: 1.30 },
    { id: 'AInoalc', name: { ru: 'AI · Всё включено (без алкоголя)', kk: 'AI · Бәрі қосылған (алкогольсіз)', en: 'AI · All inclusive (no alcohol)' }, mul: 1.26 },
    { id: 'FB',      name: { ru: 'FB · Завтрак, обед, ужин',  kk: 'FB · Таңғы, түскі, кешкі ас', en: 'FB · Breakfast, lunch, dinner' }, mul: 1.22 },
    { id: 'HB',      name: { ru: 'HB · Завтрак + ужин',       kk: 'HB · Таңғы ас + кешкі ас',   en: 'HB · Breakfast + dinner' },   mul: 1.12 },
    { id: 'LHB',     name: { ru: 'LHB · Завтрак + обед',      kk: 'LHB · Таңғы ас + түскі ас',  en: 'LHB · Breakfast + lunch' },   mul: 1.10 },
    { id: 'BB',      name: { ru: 'BB · Завтрак',              kk: 'BB · Таңғы ас',              en: 'BB · Breakfast' },            mul: 1.00 },
    { id: 'RO',      name: { ru: 'RO · Без питания',          kk: 'RO · Тамақсыз',              en: 'RO · Room only' },            mul: 0.88 }
  ];
  var BEACH_TYPES = [
    { id: 'sand',   name: { ru: 'Песчаный',        kk: 'Құмды',            en: 'Sandy' } },
    { id: 'pebble', name: { ru: 'Галечный',        kk: 'Малтатасты',       en: 'Pebble' } },
    { id: 'mixed',  name: { ru: 'Песчано-галечный', kk: 'Құмды-малтатасты', en: 'Sand and pebble' } }
  ];
  var BEACH_OPTS = [
    { id: 'own',  name: { ru: 'Собственный пляж отеля', kk: 'Қонақүйдің жеке жағажайы', en: 'Private hotel beach' } },
    { id: 'near', name: { ru: 'Близко к центру',        kk: 'Орталыққа жақын',          en: 'Close to the centre' } }
  ];
  /* Линия пляжа с метрами: «вторая линия» без цифр ничего не сообщает */
  var BEACH_LINES = [
    { id: '1', line: 1, name: { ru: '1-я линия: 0—200 метров',   kk: '1-желі: 0—200 метр',   en: '1st line: 0—200 m' } },
    { id: '2', line: 2, name: { ru: '2-я линия: 201—500 метров', kk: '2-желі: 201—500 метр', en: '2nd line: 201—500 m' } },
    { id: '3', line: 3, name: { ru: '3-я линия: 501—800 метров', kk: '3-желі: 501—800 метр', en: '3rd line: 501—800 m' } }
  ];
  var SERVICES = [
    { id: 'ac',      icon: 'mark',  name: { ru: 'Кондиционер',              kk: 'Кондиционер',            en: 'Air conditioning' } },
    { id: 'wifi',    icon: 'wifi',  name: { ru: 'Wi-Fi (Интернет)',         kk: 'Wi-Fi (Интернет)',       en: 'Wi-Fi (internet)' } },
    { id: 'spa',     icon: 'spa',   name: { ru: 'Спа / Оздоровительный центр', kk: 'Спа / Сауықтыру орталығы', en: 'Spa / wellness centre' } },
    { id: 'bay',     icon: 'mark',  name: { ru: 'Отель расположен в бухте', kk: 'Қонақүй шығанақта',      en: 'Hotel in a bay' } },
    { id: 'adults',  icon: 'users', name: { ru: 'Только для взрослых',      kk: 'Тек ересектерге',        en: 'Adults only' } },
    { id: 'kids',    icon: 'kids',  name: { ru: 'Отдых с детьми',           kk: 'Балалармен демалыс',     en: 'Family friendly' } },
    { id: 'couples', icon: 'heart', name: { ru: 'Идеально для пар',         kk: 'Жұптарға тамаша',        en: 'Ideal for couples' } },
    { id: 'pets',    icon: 'mark',  name: { ru: 'Отдых с животными',        kk: 'Жануарлармен демалыс',   en: 'Pets allowed' } },
    { id: 'parking', icon: 'mark',  name: { ru: 'Парковка',                 kk: 'Тұрақ',                  en: 'Parking' } },
    { id: 'sauna',   icon: 'spa',   name: { ru: 'Сауна / Баня / Хаммам',    kk: 'Сауна / Моншa / Хаммам', en: 'Sauna / hammam' } },
    { id: 'jacuzzi', icon: 'water', name: { ru: 'Джакузи',                  kk: 'Джакузи',                en: 'Jacuzzi' } }
  ];
  /* Водные развлечения вынесены из удобств отдельной группой: их выбирают
     не «до кучи», а прицельно — ради детей или ради самого бассейна. */
  var WATER_FUN = [
    { id: 'pool_out',  icon: 'pool',  name: { ru: 'Открытый бассейн',        kk: 'Ашық бассейн',           en: 'Outdoor pool' } },
    { id: 'pool_in',   icon: 'pool',  name: { ru: 'Крытый бассейн',          kk: 'Жабық бассейн',          en: 'Indoor pool' } },
    { id: 'pool_warm', icon: 'pool',  name: { ru: 'Бассейн с подогревом',    kk: 'Жылытылатын бассейн',    en: 'Heated pool' } },
    { id: 'pool_sea',  icon: 'water', name: { ru: 'Бассейн с морской водой', kk: 'Теңіз суы бар бассейн',  en: 'Seawater pool' } },
    { id: 'slides',    icon: 'water', name: { ru: 'Водные горки',            kk: 'Су сырғанақтары',        en: 'Water slides' } },
    { id: 'aquapark',  icon: 'water', name: { ru: 'Аквапарк',                kk: 'Аквапарк',               en: 'Aquapark' } }
  ];
  var HOTEL_TYPES = [
    { id: 'beach',   name: { ru: 'Пляжный',                 kk: 'Жағажайлық',            en: 'Beach' } },
    { id: 'city',    name: { ru: 'Городской',               kk: 'Қалалық',               en: 'City' } },
    { id: 'ski',     name: { ru: 'Горный / Горнолыжный',    kk: 'Таулы / Тау шаңғысы',   en: 'Mountain / ski' } },
    { id: 'health',  name: { ru: 'Оздоровительный',         kk: 'Сауықтыру',             en: 'Wellness' } },
    { id: 'eco',     name: { ru: 'Загородный / Экологичный', kk: 'Қала сыртындағы / Экологиялық', en: 'Countryside / eco' } }
  ];
  /* Год открытия и реновации: у агрегаторов это отдельный фильтр — свежий
     ремонт объясняет разницу в цене между соседними отелями той же категории */
  var OPENING = [
    { id: 'new',   name: { ru: 'Недавно открылись', kk: 'Жақында ашылды',   en: 'Recently opened' } },
    { id: 'renov', name: { ru: 'После реновации',   kk: 'Реновациядан кейін', en: 'Recently renovated' } }
  ];
  var ROOMS = [
    { id: 'std', name: { ru: 'Стандартный номер', kk: 'Стандартты нөмір', en: 'Standard room' } },
    { id: 'fam', name: { ru: 'Семейный номер',    kk: 'Отбасылық нөмір',  en: 'Family room' } },
    { id: 'sea', name: { ru: 'Номер с видом на море', kk: 'Теңіз көрінісі бар нөмір', en: 'Sea view room' } },
    { id: 'bng', name: { ru: 'Бунгало',           kk: 'Бунгало',          en: 'Bungalow' } }
  ];

  /* --- Туроператоры и авиакомпании: состав набора — заглушка -------------- */
  var OPERATORS = [
    { id: 'op1', name: 'Anex Tour' },
    { id: 'op2', name: 'Coral Travel' },
    { id: 'op3', name: 'Pegas Touristik' },
    { id: 'op4', name: 'Join UP!' },
    { id: 'op5', name: 'TUI' },
    { id: 'op6', name: 'Kompas' },
    { id: 'op7', name: 'Sunmar' },
    { id: 'op8', name: 'Space Travel' }
  ];
  var AIRLINES = ['Air Astana', 'FlyArystan', 'SCAT', 'Qazaq Air'];

  /* --- Отели ---------------------------------------------------------------
     Каталог собирается программно: названия составлены из нейтральных слов и
     заведомо вымышлены — принять их за настоящие отели нельзя. Снимок берётся
     по курорту из набора Викисклада (авторство — assets/img/credits.json);
     где подходящего снимка нет, карточка честно показывает заглушку.
     ----------------------------------------------------------------------- */
  var NAME_A = ['Sunrise', 'Blue Lagoon', 'Coral', 'Palm Garden', 'Marina', 'Azure',
    'Sea Breeze', 'Golden Bay', 'Olive Grove', 'Pearl', 'Sunset', 'Emerald',
    'Riviera', 'Amber', 'Horizon', 'Oasis', 'Silver Sands', 'Lotus', 'Delfin', 'Terrace'];
  var NAME_B = ['Resort & Spa', 'Beach Hotel', 'Bay Club', 'Garden Resort', 'Palace',
    'Suites', 'Village', 'Residence', 'Grand Hotel', 'Aqua Resort'];

  /* Снимки по курортам. Первый в списке — вид курорта, дальше — родственные
     кадры той же страны, чтобы соседние карточки не повторяли одну картинку. */
  var PHOTOS = {
    'tr:antalya': ['tr-antalya', 'tour-antalya', 'hero-antalya'],
    'tr:kemer': ['tr-kemer', 'pool'],
    'tr:side': ['tr-side'],
    'tr:alanya': ['tr-alanya'],
    'tr:belek': ['tr-belek'],
    'eg:hurghada': ['eg-hurghada'],
    'eg:sharm': ['eg-sharm', 'tour-sharm'],
    'ae:dubai': ['ae-dubai', 'tour-dubai'],
    'ae:sharjah': ['ae-sharjah'],
    'ae:rak': ['ae-rak'],
    'th:phuket': ['th-phuket', 'tour-phuket'],
    'th:pattaya': ['th-pattaya'],
    'vn:nhatrang': ['vn-nhatrang'],
    'cn:sanya': ['cn-sanya'],
    'mv:male': ['mv-male'],
    'lk:bentota': ['lk-bentota'],
    'id:kuta': ['id-kuta'],
    'in:goa': ['in-goa'],
    'cy:ayia': ['cy-ayia'],
    'ge:batumi': ['ge-batumi'],
    'az:baku': ['az-baku'],
    'kg:issyk': ['kg-issyk'],
    'uz:samarkand': ['uz-samarkand'],
    'kz:borovoe': ['kz-borovoe'],
    'kz:turkestan': ['kz-turkestan'],
    'kz:saryagash': ['kz-saryagash'],
    'kz:alakol': [],
    'kz:kenderli': [],
    'es:costabrava': ['es-costabrava'],
    'cz:prague': ['cz-prague'],
    'my:langkawi': ['my-langkawi'],
    'cu:varadero': ['cu-varadero'],
    'do:punta': ['do-punta']
  };

  /* Число отелей на курорт равно числу непохожих снимков: повторять одну
     фотографию в соседних карточках — та же неправда, что и чужое фото. */
  function buildHotels() {
    var out = [], used = {}, n = 0;
    COUNTRIES.forEach(function (c) {
      c.resorts.forEach(function (r) {
        var key = c.id + ':' + r.id;
        var pool = PHOTOS[key] || [];
        var count = Math.max(2, pool.length);
        for (var i = 0; i < count; i++) {
          n++;
          var rnd = rngFrom(seedFrom('hotel|' + key + '|' + i));
          var name;
          do {
            name = NAME_A[Math.floor(rnd() * NAME_A.length)] + ' ' + NAME_B[Math.floor(rnd() * NAME_B.length)];
          } while (used[name]);
          used[name] = 1;

          var stars = [3, 3, 4, 4, 4, 5, 5, 2][Math.floor(rnd() * 8)];
          if (c.id === 'mv') stars = i === 0 ? 5 : 4;             /* дешёвых отелей там нет */
          var rate = { 2: 6.9, 3: 7.3, 4: 7.9, 5: 8.6 }[stars] + rnd() * 0.9;
          var beachRoll = rnd();
          var beach = (c.id === 'tr' || c.id === 'ge' || c.id === 'es')
            ? (beachRoll < 0.4 ? 'pebble' : (beachRoll < 0.7 ? 'mixed' : 'sand'))
            : (beachRoll < 0.85 ? 'sand' : 'mixed');
          var line = stars >= 5 ? 1 : (rnd() < 0.45 ? 1 : (rnd() < 0.75 ? 2 : 3));
          /* Метры согласованы с подписями линий: 1-я 0—200, 2-я 201—500, 3-я 501—800 */
          var dist = line === 1 ? Math.floor(rnd() * 201)
            : (line === 2 ? 201 + Math.floor(rnd() * 300) : 501 + Math.floor(rnd() * 300));

          var svc = ['ac', 'wifi'];
          if (stars >= 4) svc.push('spa');
          if (stars >= 4 && rnd() < 0.35) svc.push('bay');
          if (rnd() < 0.6) svc.push('kids');
          if (stars >= 5 && svc.indexOf('kids') === -1) svc.push('adults');
          if (rnd() < 0.45) svc.push('couples');
          if (rnd() < 0.2) svc.push('pets');
          if (stars >= 3) svc.push('parking');
          if (stars >= 4 && rnd() < 0.7) svc.push('sauna');
          if (stars >= 4 && rnd() < 0.4) svc.push('jacuzzi');

          var water = [];
          if (stars >= 3) water.push('pool_out');
          if (stars >= 4 && rnd() < 0.45) water.push('pool_in');
          if (stars >= 4 && rnd() < 0.3) water.push('pool_warm');
          if (rnd() < 0.1) water.push('pool_sea');
          if (stars >= 4 && rnd() < 0.4) water.push('slides');
          if (stars >= 4 && rnd() < 0.25) water.push('aquapark');

          /* Тип отдыха следует географии: у моря — пляжный, Прага и Стамбул —
             городской, Боровое и Сарыагаш — загородный и оздоровительный. */
          var types = [];
          if (c.water >= 20) types.push('beach');
          if (r.id === 'prague' || r.id === 'istanbul' || r.id === 'dubai') types.push('city');
          if (r.id === 'borovoe' || r.id === 'turkestan') types.push('eco');
          if (r.id === 'saryagash' || svc.indexOf('spa') !== -1 && rnd() < 0.3) types.push('health');
          if (c.water === 0 && rnd() < 0.25) types.push('ski');
          if (!types.length) types.push(c.water >= 20 ? 'beach' : 'city');

          var opened = 2005 + Math.floor(rnd() * 21);
          var renov = rnd() < 0.35 ? 2023 + Math.floor(rnd() * 3) : 0;

          /* Номерной фонд, этажность и площадь территории: без них раздел
             «Об отеле» состоял из одного абзаца и трёх расстояний, а именно
             эти три числа отличают городскую высотку от бунгало у моря.
             Значения следуют категории: пятёрка — крупнее и просторнее. */
          var roomsN = ({ 2: 40, 3: 90, 4: 180, 5: 300 }[stars]) + Math.floor(rnd() * 120);
          var floors = types.indexOf('city') !== -1
            ? 8 + Math.floor(rnd() * 12)
            : 2 + Math.floor(rnd() * (stars >= 4 ? 6 : 3));
          var land = Math.round((stars >= 4 ? 1.5 + rnd() * 6 : 0.4 + rnd() * 2) * 10) / 10;
          /* Языки персонала: русский есть везде, где принимают рейсы из
             Казахстана, остальное — от страны. */
          var langs = ['ru', 'en'];
          if (c.id === 'tr') langs.push('tr');
          if (c.id === 'kz' || c.id === 'kg' || c.id === 'uz') langs.push('kk');
          if (c.id === 'eg' || c.id === 'ae') langs.push('ar');

          out.push({
            id: 'h' + (n < 10 ? '0' : '') + n,
            name: name,
            c: c.id,
            r: r.id,
            s: stars,
            rate: Math.round(rate * 10) / 10,
            rev: 120 + Math.floor(rnd() * 3280),
            beach: beach,
            line: line,
            dist: dist,
            air: 6 + Math.floor(rnd() * 130),
            img: pool[i] || null,
            svc: svc,
            water: water,
            types: types,
            opened: opened,
            renov: renov,
            roomsN: roomsN,
            floors: floors,
            land: land,
            langs: langs
          });
        }
      });
    });
    return out;
  }

  var HOTELS = buildHotels();

  /* --- Сезонность: множитель по месяцу ------------------------------------ */
  var WINTER_SUN = ['th', 'vn', 'ae', 'eg', 'mv', 'lk', 'in', 'id', 'my', 'cu', 'do', 'cn'];
  function season(countryId, month) {
    var winter = WINTER_SUN.indexOf(countryId) !== -1;
    if (winter) {
      if (month === 11 || month === 0 || month === 1) return 1.18;
      if (month === 10 || month === 2) return 1.06;
      if (month >= 5 && month <= 7) return 0.85;
      return 1.0;
    }
    if (month >= 5 && month <= 7) return 1.16;
    if (month === 4 || month === 8) return 1.06;
    if (month === 9) return 0.95;
    return 0.85;
  }
  var STAR_MUL = { 2: 0.82, 3: 1.0, 4: 1.26, 5: 1.45 };

  /* Детерминированный генератор: одинаковый город — одинаковые цифры. */
  function seedFrom(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function country(id) { return byId(COUNTRIES, id); }
  function city(id) { return byId(CITIES, id) || CITIES[0]; }
  function meal(id) { return byId(MEALS, id); }
  function hotel(id) { return byId(HOTELS, id); }
  function operator(id) { return byId(OPERATORS, id); }
  function resort(countryId, resortId) {
    var c = country(countryId);
    return c ? byId(c.resorts, resortId) : null;
  }

  function priceFor(h, cityId, dateISO, nightsCount, mealId, jitter) {
    var c = country(h.c), ct = city(cityId), d = Fmt.parseISO(dateISO);
    var perPerson = c.base
      * ct.mul
      * STAR_MUL[h.s]
      * meal(mealId).mul
      * (1 + (nightsCount - 7) * 0.06)
      * season(h.c, d.getMonth())
      * jitter;
    /* Новогодняя надбавка: 25 декабря — 5 января */
    var md = (d.getMonth() + 1) * 100 + d.getDate();
    if (md >= 1225 || md <= 105) perPerson *= 1.35;
    /* Демонстрационный набор держится в объявленном коридоре 149 000 — 1 200 000 ₸
       за двоих: числа вне него читались бы как ошибка, а не как цена. */
    var forTwo = Math.min(Math.max(perPerson * 2, 149000), 1200000);
    return Math.round(forTwo / 1000) * 1000;
  }

  /* --- Сборка предложений под город вылета -------------------------------- */
  function build(cityId, anchorISO) {
    var rnd = rngFrom(seedFrom('trips.kz|' + cityId + '|' + (anchorISO || '')));
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var anchorDays = anchorISO
      ? Math.round((Fmt.parseISO(anchorISO) - today) / 86400000)
      : 14;
    var tours = [];
    var nightsSet = [7, 7, 8, 9, 10, 10, 11, 14];

    HOTELS.forEach(function (h, hi) {
      var offers = 14 + Math.floor(rnd() * 5);          /* 14–18 предложений на отель */
      for (var k = 0; k < offers; k++) {
        /* Четыре из пяти предложений ложатся вокруг запрошенной даты — так
           отвечает реальная выдача; остальные разбросаны по трём месяцам и
           кормят календарь низких цен и подсказку «рядом дешевле». */
        var inDays = rnd() < 0.8
          ? Math.max(2, anchorDays + Math.round((rnd() - 0.5) * 28))
          : 2 + Math.floor(rnd() * 89);
        var date = Fmt.addDays(today, inDays);
        var dateISO = Fmt.toISO(date);
        var n = nightsSet[Math.floor(rnd() * nightsSet.length)];
        var mealPool = h.s === 5 ? ['HB', 'AI', 'AI', 'AInoalc', 'UAI']
          : h.s === 4 ? ['BB', 'HB', 'HB', 'LHB', 'AI', 'AI', 'FB']
          : ['RO', 'BB', 'BB', 'LHB', 'HB'];
        var mealId = mealPool[Math.floor(rnd() * mealPool.length)];
        var jitter = 0.9 + rnd() * 0.22;
        var price = priceFor(h, cityId, dateISO, n, mealId, jitter);
        var hot = inDays < 21 && rnd() < 0.55;
        var discount = hot ? 12 + Math.floor(rnd() * 27) : (rnd() < 0.35 ? 5 + Math.floor(rnd() * 10) : 0);
        var old = discount ? Math.round(price / (1 - discount / 100) / 1000) * 1000 : 0;
        var seats = rnd() < 0.4 ? 1 + Math.floor(rnd() * 3) : 0;

        tours.push({
          id: h.id + '-' + k,
          hotelId: h.id,
          countryId: h.c,
          resortId: h.r,
          cityId: cityId,
          date: dateISO,
          nights: n,
          meal: mealId,
          room: ROOMS[Math.floor(rnd() * ROOMS.length)].id,
          price: price,
          oldPrice: old,
          discount: discount,
          hot: hot,
          seats: seats,
          top: rnd() < 0.18,
          instant: rnd() < 0.55,
          operatorId: OPERATORS[Math.floor(rnd() * OPERATORS.length)].id,
          direct: country(h.c).flight < 7 ? rnd() < 0.8 : rnd() < 0.35,
          departTime: ['morning', 'day', 'night'][Math.floor(rnd() * 3)],
          airline: AIRLINES[Math.floor(rnd() * AIRLINES.length)],
          baggage: rnd() < 0.75,
          photos: 8 + Math.floor(rnd() * 16),
          /* координаты пина на демо-карте: доля от ширины и высоты полотна */
          mapX: 0.08 + ((hi * 37) % 84) / 100,
          mapY: 0.10 + ((hi * 53) % 78) / 100
        });
      }
    });

    tours.sort(function (a, b) { return a.price - b.price; });
    return tours;
  }

  /* Минимум по направлению для плиток и подменю. */
  function minByCountry(tours) {
    var map = {};
    tours.forEach(function (t) {
      if (!map[t.countryId] || t.price < map[t.countryId]) map[t.countryId] = t.price;
    });
    return map;
  }

  /* Минимум по месяцам — лента «когда дешевле». Шесть месяцев вперёд:
     набор предложений покрывает три, дальше цена считается той же формулой. */
  function monthsLow(cityId, countryId, count) {
    var out = [], today = new Date();
    var c = countryId || 'tr';
    var cheapest = HOTELS.filter(function (h) { return h.c === c; })
      .sort(function (a, b) { return STAR_MUL[a.s] - STAR_MUL[b.s]; })[0];
    if (!cheapest) return out;
    for (var i = 0; i < (count || 6); i++) {
      var d = new Date(today.getFullYear(), today.getMonth() + i, 12);
      var iso = Fmt.toISO(d);
      /* Небольшой разброс по месяцам: без него соседние месяцы одного сезона
         дают одинаковую до тенге цену, и лента читается как ошибка. */
      var jitter = 0.9 + ((seedFrom(cityId + c + i) % 17) / 100);
      out.push({
        month: d.getMonth(),
        year: d.getFullYear(),
        date: iso,
        price: priceFor(cheapest, cityId, iso, 7, cheapest.s >= 4 ? 'HB' : 'BB', jitter)
      });
    }
    return out;
  }

  /* Цены по дням вылета — мини-календарь в выдаче и подсказка «рядом дешевле». */
  function daysLow(cityId, countryId, fromISO, count) {
    var out = [];
    var cheapest = HOTELS.filter(function (h) { return h.c === countryId; })
      .sort(function (a, b) { return STAR_MUL[a.s] - STAR_MUL[b.s]; })[0] || HOTELS[0];
    var start = Fmt.parseISO(fromISO);
    for (var i = 0; i < (count || 9); i++) {
      var d = Fmt.addDays(start, i - Math.floor((count || 9) / 2));
      var iso = Fmt.toISO(d);
      var jitter = 0.9 + ((i * 37) % 20) / 100;
      out.push({ date: iso, price: priceFor(cheapest, cityId, iso, 7, 'BB', jitter) });
    }
    return out;
  }

  /* ==========================================================================
     Страница отеля: галерея, сетка цен, предложения, номера, отзывы.

     THESIS: карточка выдачи отвечает «сколько», страница отеля — «как он
     выглядит», «сколько стоит в другие даты» и «что говорят те, кто был».
     Ни на один из трёх вопросов данных карточки не хватает: там один снимок,
     одна цена и одна строка рейтинга. Всё, что добавлено ниже, считается той
     же детерминированной формулой, что и выдача, — иначе таблица цен и список
     предложений разошлись бы между собой и с ценой в шапке.
     ======================================================================== */

  /* --- Галерея -------------------------------------------------------------
     Настоящих снимков конкретного отеля в наборе нет и быть не может: отели
     вымышлены. Кадры собираются по убыванию правдоподобия: снимок своего
     курорта, затем соседние по стране, затем нейтральные виды из общего
     набора. Порядок детерминирован семенем отеля — у соседних отелей галереи
     не совпадают, у одного отеля не пляшут между перезагрузками. */
  var NEUTRAL_SHOTS = ['pool', 'hero-terrace-1600', 'hero-window-1600', 'hero-blue-1600',
    'hero-bay-1600', 'hero-coast-1600', 'hero-wave-1600', 'hero-maldives'];

  /* --- Миниатюра кадра ------------------------------------------------------
     К каждому снимку набора лежит квадратная копия 160×160 с приставкой
     cover-. Она нужна не ради килобайтов: полосу миниатюр под галереей
     Chrome местами просто не рисовал — снимок в 1600 пикселей, ужатый до
     восьмидесяти, у него через раз оставался пустым прямоугольником. Тот же
     приём уже спас кружки сторис. */
  function cover(name) { return name ? 'cover-' + name : name; }

  function gallery(hotelId) {
    var h = hotel(hotelId);
    if (!h) return [];
    var key = h.c + ':' + h.r;
    var pool = [];
    function push(name) { if (name && pool.indexOf(name) === -1) pool.push(name); }

    push(h.img);
    (PHOTOS[key] || []).forEach(push);
    Object.keys(PHOTOS).forEach(function (k) {
      if (k.indexOf(h.c + ':') === 0 && k !== key) (PHOTOS[k] || []).forEach(push);
    });

    /* Нейтральные кадры тасуются семенем отеля: без перемешивания у всех
       отелей страны хвост галереи выглядел бы одинаково. */
    var rnd = rngFrom(seedFrom('gallery|' + hotelId));
    var rest = NEUTRAL_SHOTS.slice();
    for (var i = rest.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp;
    }
    rest.forEach(push);
    return pool.slice(0, 12);
  }

  /* --- Предложения отеля на конкретную дату и длительность -----------------
     Один и тот же отель у оператора продаётся несколькими строками: номер,
     питание и перевозчик меняются, цена вместе с ними. Набор строится от той
     же priceFor, что и вся выдача, поэтому минимум по этому списку — та самая
     цена, которая стоит в ячейке таблицы выше. Иначе таблица обещала бы одно,
     а список показывал другое. */
  var ROOM_MUL = { std: 1, sea: 1.12, fam: 1.20, bng: 1.32 };

  function hotelOffers(hotelId, cityId, dateISO, nightsCount) {
    var h = hotel(hotelId);
    if (!h) return [];
    var c = country(h.c);
    var rnd = rngFrom(seedFrom('offers|' + hotelId + '|' + cityId + '|' + dateISO + '|' + nightsCount));

    var mealPool = h.s === 5 ? ['UAI', 'AI', 'AInoalc', 'HB']
      : h.s === 4 ? ['AI', 'HB', 'FB', 'BB', 'LHB']
      : ['BB', 'HB', 'RO', 'LHB'];
    var roomPool = ['std'];
    if (c.water >= 20) roomPool.push('sea');
    if (h.svc.indexOf('kids') !== -1 || h.s >= 4) roomPool.push('fam');
    if (h.s === 5 && c.water >= 20) roomPool.push('bng');

    /* Пары «питание + номер» перебираются по кругу, а не случайно: случайный
       выбор давал повторы, и в списке дважды стояла одна и та же строка. */
    var combos = [];
    mealPool.forEach(function (m) {
      roomPool.forEach(function (r) { combos.push([m, r]); });
    });
    for (var i = combos.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = combos[i]; combos[i] = combos[j]; combos[j] = tmp;
    }

    var count = Math.min(combos.length, 5 + Math.floor(rnd() * 4));
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var inDays = Math.round((Fmt.parseISO(dateISO) - today) / 86400000);

    var out = combos.slice(0, count).map(function (pair, k) {
      var jitter = (0.94 + rnd() * 0.16) * ROOM_MUL[pair[1]];
      var price = priceFor(h, cityId, dateISO, nightsCount, pair[0], jitter);
      var hot = inDays < 21 && rnd() < 0.4;
      var discount = hot ? 12 + Math.floor(rnd() * 24) : (rnd() < 0.3 ? 5 + Math.floor(rnd() * 9) : 0);
      return {
        /* В id входит город вылета: предложение считается от него, и без
           города избранное не смогло бы восстановить сохранённую строку. */
        id: hotelId + '.' + cityId + '.' + dateISO.replace(/-/g, '') + '.' + nightsCount + '.' + k,
        hotelId: hotelId,
        countryId: h.c,
        resortId: h.r,
        cityId: cityId,
        date: dateISO,
        nights: nightsCount,
        meal: pair[0],
        room: pair[1],
        price: price,
        oldPrice: discount ? Math.round(price / (1 - discount / 100) / 1000) * 1000 : 0,
        discount: discount,
        hot: hot,
        seats: rnd() < 0.35 ? 1 + Math.floor(rnd() * 3) : 0,
        top: false,
        instant: rnd() < 0.6,
        operatorId: OPERATORS[Math.floor(rnd() * OPERATORS.length)].id,
        direct: c.flight < 7 ? rnd() < 0.8 : rnd() < 0.35,
        departTime: ['morning', 'day', 'night'][Math.floor(rnd() * 3)],
        airline: AIRLINES[Math.floor(rnd() * AIRLINES.length)],
        baggage: rnd() < 0.75,
        photos: 12
      };
    });
    out.sort(function (a, b) { return a.price - b.price; });
    return out;
  }

  /* Обратный разбор id: строка предложения самоописательна, поэтому её можно
     восстановить из одного идентификатора — это нужно избранному, которое
     хранит только id и открывается с любой страницы сайта. */
  function offerById(id) {
    var m = /^(h\d+)\.([a-z]+)\.(\d{4})(\d{2})(\d{2})\.(\d+)\.(\d+)$/.exec(String(id || ''));
    if (!m) return null;
    var list = hotelOffers(m[1], m[2], m[3] + '-' + m[4] + '-' + m[5], +m[6]);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* --- Таблица «ночи × даты вылета» ---------------------------------------
     В ячейке — минимум по предложениям этого дня и этой длительности. Так
     таблица отвечает ровно на тот вопрос, который ей задают: «во сколько
     обойдётся, если сдвинуть вылет на день или взять на ночь больше». */
  function hotelGrid(hotelId, cityId, fromISO, cols, nightsFrom, rows) {
    var out = [], start = Fmt.parseISO(fromISO);
    for (var r = 0; r < rows; r++) {
      var nightsCount = nightsFrom + r;
      var row = { nights: nightsCount, cells: [] };
      for (var c = 0; c < cols; c++) {
        var iso = Fmt.toISO(Fmt.addDays(start, c));
        var offers = hotelOffers(hotelId, cityId, iso, nightsCount);
        row.cells.push({ date: iso, nights: nightsCount, price: offers.length ? offers[0].price : 0 });
      }
      out.push(row);
    }
    return out;
  }

  /* --- Номера --------------------------------------------------------------
     Категории берутся те же, что и в предложениях, — иначе в списке туров
     стояло бы «Бунгало», а в описании отеля его бы не было. Площадь и
     вместимость выведены из категории отеля и типа номера. */
  var ROOM_EXTRA = {
    std: { area: 22, cap: 2 },
    sea: { area: 26, cap: 2 },
    fam: { area: 38, cap: 4 },
    bng: { area: 45, cap: 3 }
  };
  function hotelRooms(hotelId) {
    var h = hotel(hotelId);
    if (!h) return [];
    var c = country(h.c);
    var rnd = rngFrom(seedFrom('rooms|' + hotelId));
    var ids = ['std'];
    if (c.water >= 20) ids.push('sea');
    if (h.svc.indexOf('kids') !== -1 || h.s >= 4) ids.push('fam');
    if (h.s === 5 && c.water >= 20) ids.push('bng');

    return ids.map(function (id) {
      var base = ROOM_EXTRA[id];
      var feats = ['ac', 'wifi', 'safe'];
      if (h.s >= 4) feats.push('minibar');
      if (id !== 'std' || rnd() < 0.6) feats.push('balcony');
      if (h.s >= 4 && rnd() < 0.5) feats.push('bath');
      if (id === 'fam' || id === 'bng') feats.push('two_rooms');
      return {
        id: id,
        area: base.area + Math.floor(rnd() * 8) + (h.s === 5 ? 6 : 0),
        cap: base.cap,
        feats: feats,
        /* Снимок категории, а не конкретного номера: кадры сняты под каждый
           тип и одинаковы у всех отелей набора — обещать «вот этот номер в
           этом отеле» нельзя, показать, чем стандарт отличается от семейного,
           нужно. */
        img: 'room-' + id,
        /* Три кадра на категорию: комната, ванная и то, что снаружи —
           балкон, терраса или вторая спальня. Одной фотографии для «открыть
           номер» мало: по ней не видно ровно того, о чём спрашивают перед
           бронированием. */
        shots: ['room-' + id, 'room-' + id + '-2', 'room-' + id + '-3']
      };
    });
  }

  /* --- Сторис отеля --------------------------------------------------------
     Круглая лента поверх галереи: она отвечает на вопрос, который к обычной
     галерее не задать, — «покажите отдельно номер, отдельно пляж, отдельно
     что там с едой». Каждая тема появляется только если она у отеля есть:
     аквапарк — там, где он есть в наборе, спа — где есть спа, пляж — где
     вообще есть море. Кадры сняты под тему, поэтому подпись под кружком
     говорит о снимке правду. */
  /* Обложка кружка — отдельный кадр 160×160, а не тот же снимок, что внутри
     сторис: подставлять фотографию в 1200 пикселей под шестидесятипиксельный
     круг — это и лишние двести килобайт на кружок, и двадцатикратное
     уменьшение, на котором браузер местами отказывался рисовать кадр вовсе. */
  var STORIES = [
    { id: 'hotel', cover: 'cover-hotel', shots: ['hotel-facade', 'hotel-grounds'],
      when: function () { return true; },
      name: { ru: 'Отель', kk: 'Қонақүй', en: 'The hotel' } },
    { id: 'room', cover: 'cover-room', shots: ['room-std', 'room-sea'],
      when: function () { return true; },
      name: { ru: 'Номер', kk: 'Нөмір', en: 'Rooms' } },
    { id: 'meal', cover: 'cover-meal', shots: ['hotel-restaurant'],
      when: function () { return true; },
      name: { ru: 'Питание', kk: 'Тамақтану', en: 'Dining' } },
    { id: 'pool', cover: 'cover-pool', shots: ['hotel-pool', 'pool'],
      when: function (h) { return h.water.length > 0; },
      name: { ru: 'Бассейн', kk: 'Бассейн', en: 'Pool' } },
    { id: 'beach', cover: 'cover-beach', shots: ['hotel-beach'],
      when: function (h) { return country(h.c).water > 0; },
      name: { ru: 'Пляж', kk: 'Жағажай', en: 'Beach' } },
    { id: 'aqua', cover: 'cover-aqua', shots: ['hotel-aquapark'],
      when: function (h) { return h.water.indexOf('aquapark') !== -1 || h.water.indexOf('slides') !== -1; },
      name: { ru: 'Аквапарк', kk: 'Аквапарк', en: 'Aquapark' } },
    { id: 'spa', cover: 'cover-spa', shots: ['hotel-spa'],
      when: function (h) { return h.svc.indexOf('spa') !== -1; },
      name: { ru: 'Спа', kk: 'Спа', en: 'Spa' } },
    { id: 'resort', shots: [],
      when: function (h) { return (PHOTOS[h.c + ':' + h.r] || []).length > 0; },
      name: { ru: 'Курорт', kk: 'Курорт', en: 'The resort' } }
  ];

  function stories(hotelId) {
    var h = hotel(hotelId);
    if (!h) return [];
    return STORIES.filter(function (x) { return x.when(h); }).map(function (x) {
      /* «Курорт» собирается из снимков самого курорта: это единственная тема,
         кадры которой зависят от направления. */
      var shots = x.id === 'resort'
        ? (PHOTOS[h.c + ':' + h.r] || []).slice(0, 3)
        : x.shots;
      /* У «Курорта» обложка своя на каждый курорт — маленькая копия того же
         снимка: полноразмерный кадр в кружке браузер местами не рисовал. */
      return {
        id: x.id,
        name: x.name,
        cover: x.cover || (shots[0] ? 'cover-' + shots[0] : ''),
        shots: shots
      };
    }).filter(function (x) { return x.shots.length; });
  }

  /* --- Отзывы об отеле -----------------------------------------------------
     Готовых отзывов о вымышленном отеле в наборе нет, и брать чужие тексты
     из общего списка нельзя: там сказано «до моря три минуты» про Анталью, и
     под Туркестаном это была бы прямая ложь. Поэтому отзыв собирается из
     полей самого отеля — линии пляжа, типа питания, услуг — по тем же
     правилам, что и текст «Об отеле». Ни одна фраза не утверждает того, чего
     нет в наборе: про аквапарк говорится только там, где аквапарк есть. */
  var REVIEW_NAMES = [
    { ru: 'Айгуль С.', kk: 'Айгүл С.', en: 'Aigul S.' },
    { ru: 'Данияр К.', kk: 'Данияр Қ.', en: 'Daniyar K.' },
    { ru: 'Мария Т.', kk: 'Мария Т.', en: 'Maria T.' },
    { ru: 'Ержан М.', kk: 'Ержан М.', en: 'Yerzhan M.' },
    { ru: 'Асель Б.', kk: 'Әсел Б.', en: 'Assel B.' },
    { ru: 'Тимур А.', kk: 'Тимур А.', en: 'Timur A.' },
    { ru: 'Гульнара Ж.', kk: 'Гүлнара Ж.', en: 'Gulnara Zh.' },
    { ru: 'Санжар Н.', kk: 'Санжар Н.', en: 'Sanzhar N.' },
    { ru: 'Динара К.', kk: 'Динара Қ.', en: 'Dinara K.' },
    { ru: 'Алибек Т.', kk: 'Әлібек Т.', en: 'Alibek T.' },
    { ru: 'Жанна Р.', kk: 'Жанна Р.', en: 'Zhanna R.' },
    { ru: 'Руслан Б.', kk: 'Руслан Б.', en: 'Ruslan B.' }
  ];

  /* Плюсы и минусы: у каждой фразы есть условие — она попадает в отзыв
     только если поле отеля её подтверждает. Ключ {n} подставляется из набора. */
  var REVIEW_PROS = [
    { id: 'line1', when: function (h) { return h.line === 1; },
      ru: 'До воды {dist} метров — с полотенцем дошли, ни разу не брали машину.',
      kk: 'Суға дейін {dist} метр — сүлгімен жетіп бардық, көлік мүлде керек болмады.',
      en: 'The water is {dist} metres away — we walked down with a towel and never needed a car.' },
    { id: 'sand', when: function (h) { return h.beach === 'sand'; },
      ru: 'Пляж песчаный, вход пологий: дети заходили сами.',
      kk: 'Жағажай құмды, түсу жайлы: балалар өздері кірді.',
      en: 'Sandy beach with a gentle entry: the kids walked in on their own.' },
    { id: 'aquapark', when: function (h) { return h.water.indexOf('aquapark') !== -1 || h.water.indexOf('slides') !== -1; },
      ru: 'Горки работали каждый день, очередь была только после обеда.',
      kk: 'Сырғанақтар күн сайын жұмыс істеді, кезек тек түстен кейін болды.',
      en: 'The slides ran every day and the queue only built up after lunch.' },
    { id: 'kids', when: function (h) { return h.svc.indexOf('kids') !== -1; },
      ru: 'Детский клуб забирал ребёнка на полдня — впервые за отпуск дочитала книгу.',
      kk: 'Балалар клубы баланы жарты күнге алды — демалыста алғаш рет кітап оқып бітірдім.',
      en: 'The kids club took our child for half a day — I finished a book for the first time on holiday.' },
    { id: 'renov', when: function (h) { return !!h.renov; },
      ru: 'После реновации {renov} года мебель и сантехника новые, ничего не подтекало.',
      kk: '{renov} жылғы реновациядан кейін жиһаз бен сантехника жаңа, ештеңе ақпады.',
      en: 'After the {renov} refurbishment the furniture and plumbing are new; nothing leaked.' },
    { id: 'spa', when: function (h) { return h.svc.indexOf('spa') !== -1; },
      ru: 'Спа записывали на месте, хаммам входил в проживание.',
      kk: 'Спаға жерінде жазылдық, хаммам тұруға кірді.',
      en: 'You book the spa on the spot and the hammam was included in the stay.' },
    { id: 'quiet', when: function (h) { return h.svc.indexOf('adults') !== -1 || h.line >= 2; },
      ru: 'Территория тихая, вечером слышно только цикад.',
      kk: 'Аумақ тыныш, кешке тек шегіртке дауысы естіледі.',
      en: 'The grounds are quiet; in the evening you only hear the cicadas.' },
    { id: 'staff', when: function () { return true; },
      ru: 'На ресепшене говорят по-русски, заселили за двадцать минут.',
      kk: 'Ресепшенде орысша сөйлейді, жиырма минутта орналастырды.',
      en: 'Reception speaks Russian and check-in took twenty minutes.' },
    { id: 'pool', when: function (h) { return h.water.indexOf('pool_out') !== -1; },
      ru: 'Лежаков у бассейна хватало даже в полдень, полотенца меняли без разговоров.',
      kk: 'Бассейн жанында шезлонг түсте де жетті, сүлгіні сөзсіз ауыстырды.',
      en: 'There were free sunbeds by the pool even at midday and towels were changed without a fuss.' },
    { id: 'transfer', when: function () { return true; },
      ru: 'Трансфер встретил с табличкой, до отеля довезли без пересадок.',
      kk: 'Трансфер тақтайшамен қарсы алды, қонақүйге ауыспай жеткізді.',
      en: 'The transfer met us with a sign and drove straight to the hotel.' },
    { id: 'clean', when: function () { return true; },
      ru: 'Убирали каждый день, бельё меняли через день без напоминаний.',
      kk: 'Күн сайын жинады, төсек жабдығын күн ара, ескертусіз ауыстырды.',
      en: 'The room was cleaned daily and the linen changed every other day without asking.' },
    { id: 'parking', when: function (h) { return h.svc.indexOf('parking') !== -1; },
      ru: 'Парковка своя и бесплатная — приехали на машине, места хватило.',
      kk: 'Тұрақ өзінікі әрі тегін — көлікпен келдік, орын жетті.',
      en: 'Parking is on site and free — we came by car and there was space.' },
    { id: 'air', when: function (h) { return h.air <= 40; },
      ru: 'До аэропорта {air} км: обратный трансфер занял меньше часа.',
      kk: 'Әуежайға дейін {air} км: кері трансфер бір сағаттан аз уақыт алды.',
      en: 'The airport is {air} km away, so the return transfer took under an hour.' }
  ];
  var REVIEW_CONS = [
    { id: 'pebble', when: function (h) { return h.beach !== 'sand'; },
      ru: 'Пляж не песчаный — тапочки для захода в воду обязательны.',
      kk: 'Жағажай құмды емес — суға кіретін тәпішке міндетті.',
      en: 'The beach is not sandy — water shoes are a must.' },
    { id: 'far', when: function (h) { return h.line >= 2; },
      ru: 'До моря {dist} метров, в жару этот путь чувствуется.',
      kk: 'Теңізге дейін {dist} метр, ыстықта бұл жол сезіледі.',
      en: 'It is {dist} metres to the sea and in the heat you feel that walk.' },
    { id: 'meal', when: function () { return true; },
      ru: 'К концу недели горячее в ресторане повторяется.',
      kk: 'Апта соңына қарай мейрамханадағы ыстық тағам қайталанады.',
      en: 'By the end of the week the hot dishes in the restaurant start repeating.' },
    { id: 'wifi', when: function (h) { return h.svc.indexOf('wifi') !== -1; },
      ru: 'Wi-Fi уверенно ловит в лобби, в номере слабее.',
      kk: 'Wi-Fi лоббиде сенімді ұстайды, нөмірде әлсіз.',
      en: 'Wi-Fi is solid in the lobby but weaker in the room.' },
    { id: 'air', when: function (h) { return h.air > 60; },
      ru: 'До аэропорта {air} км — трансфер занимает больше часа.',
      kk: 'Әуежайға дейін {air} км — трансфер бір сағаттан асады.',
      en: 'The airport is {air} km away, so the transfer takes over an hour.' },
    { id: 'old', when: function (h) { return !h.renov && h.opened < 2015; },
      ru: 'Корпус не новый: косметику видно, но всё работает.',
      kk: 'Корпус жаңа емес: косметикасы көрінеді, бірақ бәрі жұмыс істейді.',
      en: 'The building is not new — you can see the wear, but everything works.' },
    { id: 'crowd', when: function (h) { return h.s <= 4; },
      ru: 'В высокий сезон у стойки регистрации собирается очередь.',
      kk: 'Жоғары маусымда тіркеу тұрағында кезек жиналады.',
      en: 'In high season a queue builds up at the check-in desk.' },
    { id: 'noise', when: function (h) { return h.line === 1; },
      ru: 'Номера у дороги шумноваты — просите подальше от въезда.',
      kk: 'Жол жақтағы нөмірлер шуылдау — кіреберістен алысырақ сұраңыз.',
      en: 'Rooms facing the road are noisy — ask for one away from the entrance.' },
    { id: 'nokids', when: function (h) { return h.svc.indexOf('kids') === -1; },
      ru: 'Детской анимации нет: с малышами придётся придумывать программу самим.',
      kk: 'Балалар анимациясы жоқ: кішкентайлармен бағдарламаны өзің ойлап табасың.',
      en: 'There is no kids entertainment, so with small children you plan the day yourself.' }
  ];

  /* Ярлыки, которые чаще всего называют в отзывах. Состав берётся из полей
     отеля, число — детерминированная доля от общего числа отзывов. */
  var REVIEW_TAGS = [
    { id: 'meal',   share: 0.46, when: function (t2) { return t2.meal; },
      name: { ru: 'питание', kk: 'тамақтану', en: 'food' } },
    { id: 'area',   share: 0.33, when: function () { return true; },
      name: { ru: 'территория', kk: 'аумақ', en: 'grounds' } },
    { id: 'staff',  share: 0.30, when: function () { return true; },
      name: { ru: 'сервис', kk: 'сервис', en: 'service' } },
    { id: 'kids',   share: 0.22, when: function (t2) { return t2.kids; },
      name: { ru: 'для детей', kk: 'балаларға', en: 'for kids' } },
    { id: 'room',   share: 0.21, when: function () { return true; },
      name: { ru: 'номер', kk: 'нөмір', en: 'room' } },
    { id: 'clean',  share: 0.17, when: function () { return true; },
      name: { ru: 'чистота', kk: 'тазалық', en: 'cleanliness' } },
    { id: 'pool',   share: 0.16, when: function (t2) { return t2.pool; },
      name: { ru: 'бассейн', kk: 'бассейн', en: 'pool' } },
    { id: 'beach',  share: 0.16, when: function (t2) { return t2.sea; },
      name: { ru: 'пляж', kk: 'жағажай', en: 'beach' } },
    { id: 'sea',    share: 0.11, when: function (t2) { return t2.sea; },
      name: { ru: 'море', kk: 'теңіз', en: 'sea' } },
    { id: 'aqua',   share: 0.08, when: function (t2) { return t2.aqua; },
      name: { ru: 'аквапарк', kk: 'аквапарк', en: 'aquapark' } },
    { id: 'spa',    share: 0.07, when: function (t2) { return t2.spa; },
      name: { ru: 'спа', kk: 'спа', en: 'spa' } },
    { id: 'place',  share: 0.06, when: function () { return true; },
      name: { ru: 'расположение', kk: 'орналасуы', en: 'location' } }
  ];

  function hotelReviews(hotelId) {
    var h = hotel(hotelId);
    if (!h) return { list: [], tags: [] };
    var c = country(h.c);
    var rnd = rngFrom(seedFrom('reviews|' + hotelId));
    var vars = {
      dist: h.dist, air: h.air, renov: h.renov || h.opened
    };
    function fill(tpl) {
      return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    }
    /* Фраза не повторяется по всей странице, а не только внутри отзыва: две
       карточки подряд с одним предложением читаются как сбой шаблона. Когда
       подходящие фразы кончаются, счётчик обнуляется — лучше повтор, чем
       пустой блок «Понравилось». */
    function pick(pool, taken) {
      var fit = pool.filter(function (x) { return x.when(h) && taken.indexOf(x.id) === -1; });
      if (!fit.length) {
        taken.length = 0;
        fit = pool.filter(function (x) { return x.when(h); });
      }
      if (!fit.length) return null;
      var x = fit[Math.floor(rnd() * fit.length)];
      taken.push(x.id);
      return { ru: fill(x.ru), kk: fill(x.kk), en: fill(x.en) };
    }
    var usedPros = [], usedCons = [];

    var months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
    var rooms = hotelRooms(hotelId);
    /* Чётное число: карточки стоят в два столбца, и при пятом отзыве последний
       оставался один, а рядом с ним — дыра во весь столбец. */
    var count = 6;
    var list = [];
    /* Имена раздаются без возврата: два отзыва от «Динары К.» под одним
       отелем читаются как ошибка выборки, а не как совпадение. */
    var names = REVIEW_NAMES.slice();
    for (var k = names.length - 1; k > 0; k--) {
      var q = Math.floor(rnd() * (k + 1));
      var tmp2 = names[k]; names[k] = names[q]; names[q] = tmp2;
    }
    /* Снимки прикладывают не все и не к каждому отзыву — так и на живой
       площадке: из пяти отзывов с фотографиями два-три. Кадры берутся из
       галереи отеля: своих снимков у демо-отзыва быть не может, а чужой
       курорт под чужим отелем был бы прямой ложью. Курсор по галерее общий,
       поэтому два отзыва подряд не показывают один и тот же кадр. */
    var pics = gallery(hotelId);
    var withPics = {}, picCur = 0;
    /* Снимки раздаются рядами, а не поштучно. Карточки стоят в два столбца, и
       отзыв с фотографиями рядом с отзывом без них читался как сбой вёрстки:
       один ряд с полосой снимков, другой без — это ритм, а вперемешку —
       мусор. Рядов три, снимки достаются одному или двум. */
    var rows = [];
    for (var oi = 0; oi < count; oi += 2) rows.push(oi);
    for (var oj = rows.length - 1; oj > 0; oj--) {
      var ok2 = Math.floor(rnd() * (oj + 1));
      var tmp3 = rows[oj]; rows[oj] = rows[ok2]; rows[ok2] = tmp3;
    }
    rows.slice(0, 1 + Math.floor(rnd() * 2)).forEach(function (r0) {
      withPics[r0] = 1;
      if (r0 + 1 < count) withPics[r0 + 1] = 1;
    });
    function photosFor(idx) {
      if (!withPics[idx] || !pics.length) return [];
      var n = Math.min(pics.length, 2 + Math.floor(rnd() * 2));
      var out = [];
      for (var pi = 0; pi < n; pi++) out.push(pics[(picCur++) % pics.length]);
      return out;
    }

    for (var i = 0; i < count; i++) {
      var pros = [pick(REVIEW_PROS, usedPros), pick(REVIEW_PROS, usedPros)].filter(Boolean);
      var cons = [pick(REVIEW_CONS, usedCons)].filter(Boolean);
      /* Оценка отзыва пляшет вокруг оценки отеля, но остаётся в шкале 1—10:
         пятёрка под отелем с 8,6 читалась бы как чужая цифра. */
      var rate = Math.max(6, Math.min(10, Math.round((h.rate + (rnd() - 0.45) * 2.2) * 10) / 10));
      list.push({
        id: hotelId + '-rv' + i,
        who: names[i % names.length],
        when: months[Math.floor(rnd() * months.length)],
        rate: rate,
        nights: [7, 7, 8, 10, 11, 14][Math.floor(rnd() * 6)],
        room: rooms[Math.floor(rnd() * rooms.length)].id,
        pros: pros,
        cons: cons,
        photos: photosFor(i),
        likes: Math.floor(rnd() * 42)
      });
    }

    var have = {
      meal: true,
      kids: h.svc.indexOf('kids') !== -1,
      pool: h.water.length > 0,
      sea: c.water > 0,
      aqua: h.water.indexOf('aquapark') !== -1 || h.water.indexOf('slides') !== -1,
      spa: h.svc.indexOf('spa') !== -1
    };
    var tags = REVIEW_TAGS.filter(function (x) { return x.when(have); }).map(function (x) {
      return { id: x.id, name: x.name, n: Math.max(4, Math.round(h.rev * x.share * (0.8 + rnd() * 0.4))) };
    }).sort(function (a, b) { return b.n - a.n; });

    return { list: list, tags: tags };
  }

  /* --- Подборки, отзывы, статьи: структура настоящая, содержимое — демо --- */
  var COLLECTIONS = [
    { id: 'kids',  img: 'kz-saryagash',         q: 'svc=kids',      name: { ru: 'Отдых с детьми', kk: 'Балалармен демалыс', en: 'Family holidays' },
      note: { ru: 'Детский клуб, аквапарк и семейные номера', kk: 'Балалар клубы, аквапарк және отбасылық нөмірлер', en: 'Kids club, aquapark and family rooms' } },
    { id: 'ai5',   img: 'tr-belek', q: 'meal=AI&stars=5', name: { ru: 'Всё включено 5★', kk: 'Бәрі қосылған 5★', en: 'All inclusive 5★' },
      note: { ru: 'Питание и напитки без доплат на месте', kk: 'Тамақ пен сусын үшін қосымша төлемсіз', en: 'Board and drinks with no extra payment' } },
    { id: 'early', img: 'tr-side',           q: 'sort=profit',     name: { ru: 'Раннее бронирование', kk: 'Ерте брондау', en: 'Early booking' },
      note: { ru: 'Цена ниже, места выбираются заранее', kk: 'Баға төмен, орын алдын ала таңдалады', en: 'Lower price, seats chosen in advance' } },
    { id: 'line1', img: 'eg-hurghada',   q: 'line=1',     name: { ru: 'Пляжи первой линии', kk: 'Бірінші желі жағажайлары', en: 'Beachfront' },
      note: { ru: 'От номера до воды — без дороги', kk: 'Нөмірден суға дейін — жолсыз', en: 'From room to water with no road' } },
    { id: 'ny',    img: 'cz-prague',           q: 'ny=1',            name: { ru: 'Тур на Новый год', kk: 'Жаңа жылға тур', en: 'New Year trip' },
      note: { ru: 'Вылеты 25 декабря — 5 января', kk: '25 желтоқсан — 5 қаңтар ұшулары', en: 'Departures 25 Dec — 5 Jan' } },
    { id: 'duo',   img: 'mv-male',  q: 'svc=couples',     name: { ru: 'Романтика для двоих', kk: 'Екеуге арналған', en: 'For two' },
      note: { ru: 'Отели без анимации и детских клубов', kk: 'Анимациясыз және балалар клубысыз', en: 'Hotels without animation and kids clubs' } },
    { id: 'short', img: 'kz-borovoe', q: 'nights=2-4',    name: { ru: 'Короткие поездки', kk: 'Қысқа сапарлар', en: 'Short trips' },
      note: { ru: 'Две–четыре ночи: уехать в четверг, вернуться в понедельник', kk: 'Екі–төрт түн: бейсенбіде кету, дүйсенбіде оралу', en: 'Two to four nights: leave Thursday, back Monday' } },
    { id: 'calm',  img: 'lk-bentota', q: 'type=eco',     name: { ru: 'Спокойный отдых', kk: 'Тыныш демалыс', en: 'Quiet stay' },
      note: { ru: 'Без шумной анимации и вечерних программ', kk: 'Шулы анимациясыз және кешкі бағдарламасыз', en: 'No loud animation or evening shows' } }
  ];

  /* Итог по отзывам. Числа — заглушка демонстрационного набора: подтверждённой
     статистики у проекта нет, поэтому блок помечен как заглушка на странице.
     Сумма оценок по площадкам сходится с общим числом оценок — иначе таблица
     противоречит сама себе. */
  /* Рейтинг компании — по пятибалльной шкале, как на картах и в отзовиках,
     откуда он и собран. Десятибалльная шкала осталась только у отелей: там
     это оценка туроператора, и смешивать две шкалы в одном экране нельзя. */
  var REVIEW_STATS = {
    score: 4.9,
    max: 5,
    reviews: 428,
    /* Яндекс.Карты убраны из сводки по просьбе: с четырьмя площадками ряд
       не совпадал по ритму с сеткой карточек отзывов ниже, три встают
       ровнее. Сумма пересчитана без выпавших 384 оценок. */
    rates: 856,
    platforms: [
      { id: 'gmaps', name: 'Google Maps', mark: 'G', score: 4.8, max: 5, n: 512 },
      { id: 'gis',   name: '2ГИС',        mark: '2', score: 4.6, max: 5, n: 268 },
      { id: 'zoon',  name: 'Zoon',        mark: 'Z', score: 4.9, max: 5, n: 76 }
    ]
  };

  /* Оценка отзыва — по той же пятибалльной шкале, что и рейтинг компании:
     отзывы её и составляют. Десятибалльная шкала осталась у отелей.
     Длина текстов намеренно разная: карточка обязана выдерживать и три
     строки, и полтора экрана — отсюда «Читать весь отзыв». */
  var REVIEWS = [
    { id: 'r1', who: { ru: 'Айгуль С.', kk: 'Айгүл С.', en: 'Aigul S.' }, hotel: 'Sunrise Bay Resort & Spa', place: { ru: 'Анталья, Турция', kk: 'Анталья, Түркия', en: 'Antalya, Türkiye' }, when: '2026-06', rate: 4.7, likes: 34,
      text: { ru: 'Вылет из Алматы утром, к обеду были в отеле. Номер дали с видом на море, как в заявке, заселили раньше расчётного часа и без доплаты. Детский клуб работал каждый день с десяти до шести, аниматоры говорят по-русски. Питание — шведский стол, к концу недели набор горячего повторяется, но фрукты и рыба были свежие всегда. До моря идти минуты три по своей территории, лежаков хватало даже в полдень. Обратный трансфер приехал за час до времени, водитель ждал у стойки. Единственное, о чём стоит знать заранее: пляж песчано-галечный, малышам лучше взять тапочки.',
              kk: 'Алматыдан таңертең ұштық, түскі асқа қонақүйде болдық. Нөмір өтінімдегідей теңіз көрінісімен берілді, есеп айырысу уақытынан бұрын, қосымша төлемсіз орналастырды. Балалар клубы күн сайын сағат ондан алтыға дейін жұмыс істеді, аниматорлар орысша сөйлейді. Тамақ — швед үстелі, апта соңына қарай ыстық тағам қайталанады, бірақ жеміс пен балық әрқашан жаңа болды. Теңізге өз аумағымен үш минут, шезлонг түсте де жетті. Кері трансфер бір сағат бұрын келді, жүргізуші тіркеу тұрағында күтті. Алдын ала білген жөн: жағажай құмды-малтатасты, кішкентайларға тәпішке алған дұрыс.',
              en: 'Morning flight from Almaty, we were at the hotel by lunch. Sea view room exactly as booked, and they checked us in before the official time at no extra cost. The kids club ran every day from ten to six and the animators speak Russian. Meals are buffet style; by the end of the week the hot dishes start repeating, but the fruit and fish were always fresh. The sea is a three-minute walk across the grounds and there were free sunbeds even at midday. The return transfer arrived an hour early and the driver waited at the desk. One thing worth knowing in advance: the beach is sand and shingle, so bring water shoes for small children.' } },
    { id: 'r2', who: { ru: 'Данияр К.', kk: 'Данияр Қ.', en: 'Daniyar K.' }, hotel: 'Coral Sands Resort', place: { ru: 'Хургада, Египет', kk: 'Хургада, Мысыр', en: 'Hurghada, Egypt' }, when: '2026-05', rate: 4.4, likes: 12,
      text: { ru: 'Брали горящий за неделю до вылета. Документы пришли на почту в тот же день, в аэропорту вопросов не было.',
              kk: 'Ұшуға бір апта қалғанда ыстық тур алдық. Құжаттар сол күні поштаға келді, әуежайда сұрақ болмады.',
              en: 'Booked a last-minute deal a week before departure. Documents arrived the same day, no questions at the airport.' } },
    { id: 'r3', who: { ru: 'Мария Т.', kk: 'Мария Т.', en: 'Maria T.' }, hotel: 'Andaman Cliff Resort', place: { ru: 'Пхукет, Таиланд', kk: 'Пхукет, Тайланд', en: 'Phuket, Thailand' }, when: '2026-03', rate: 4.6, likes: 27,
      text: { ru: 'Перелёт длинный, но отель того стоил. Пляж свой, спуск пологий. Трансфер ждал с табличкой.',
              kk: 'Ұшу ұзақ, бірақ қонақүй соған тұрарлық. Жағажай жеке, түсу жайлы. Трансфер тақтайшамен күтіп тұрды.',
              en: 'Long flight, but the hotel was worth it. Private beach, gentle entry. The transfer was waiting with a sign.' } },
    { id: 'r4', who: { ru: 'Ержан М.', kk: 'Ержан М.', en: 'Yerzhan M.' }, hotel: 'Burabay Forest Hotel', place: { ru: 'Боровое, Казахстан', kk: 'Бурабай, Қазақстан', en: 'Borovoe, Kazakhstan' }, when: '2026-07', rate: 4.3, likes: 8,
      text: { ru: 'Ездили на четыре ночи без перелёта. Оплатили в рассрочку, переплаты не было.',
              kk: 'Ұшусыз төрт түнге бардық. Бөліп төледік, артық төлем болмады.',
              en: 'Four nights, no flight. Paid in instalments with no extra cost.' } },
    { id: 'r5', who: { ru: 'Асель Б.', kk: 'Әсел Б.', en: 'Assel B.' }, hotel: 'Jumeirah Pearl Tower', place: { ru: 'Дубай, ОАЭ', kk: 'Дубай, БАӘ', en: 'Dubai, UAE' }, when: '2026-02', rate: 4.5, likes: 41,
      text: { ru: 'Отель ровно как на фото, ничего не приукрашено. Номер на двадцать втором этаже, вид на канал, шумоизоляция хорошая. Из минусов — до пляжа идти через дорогу по подземному переходу, минут семь с детьми, это стоило уточнить заранее. Завтраки сильные, ужин брали отдельно в городе, так вышло дешевле. Такси до молла — три-четыре доллара, метро в двух остановках. Менеджер заранее прислал памятку по правилам въезда и по тому, что можно провозить, — вопросов на границе не было.',
              kk: 'Қонақүй суреттегідей, ештеңе әсірелемеген. Нөмір жиырма екінші қабатта, арнаға қарайды, дыбыс оқшаулауы жақсы. Кемшілігі — жағажайға жол астындағы өтпемен жүру керек, балалармен жеті минуттай, мұны алдын ала анықтаған жөн еді. Таңғы ас мықты, кешкі асты қалада бөлек алдық, солай арзанырақ шықты. Молға такси — үш-төрт доллар, метро екі аялдамада. Менеджер кіру ережелері мен не алып өтуге болатыны туралы жаднаманы алдын ала жіберді — шекарада сұрақ болмады.',
              en: 'The hotel matched the photos, nothing was dressed up. Room on the twenty-second floor with a canal view and good sound insulation. Downside: the beach is across the road through an underpass, about seven minutes with children — worth checking in advance. Breakfasts are strong; we had dinner in the city instead, which came out cheaper. A taxi to the mall is three or four dollars and the metro is two stops away. The manager sent a note on entry rules and what you may bring, so there were no questions at the border.' } },
    { id: 'r6', who: { ru: 'Тимур А.', kk: 'Тимур А.', en: 'Timur A.' }, hotel: 'Batumi Boulevard Hotel', place: { ru: 'Батуми, Грузия', kk: 'Батуми, Грузия', en: 'Batumi, Georgia' }, when: '2026-06', rate: 4.1, likes: 5,
      text: { ru: 'Хороший вариант на короткие даты. Пляж галечный — стоит взять обувь.',
              kk: 'Қысқа күндерге жақсы нұсқа. Жағажай малтатасты — аяқ киім алған жөн.',
              en: 'A good option for a short trip. Pebble beach — bring shoes.' } },
    { id: 'r7', who: { ru: 'Гульнара Ж.', kk: 'Гүлнара Ж.', en: 'Gulnara Zh.' }, hotel: 'Palm Garden Village', place: { ru: 'Кемер, Турция', kk: 'Кемер, Түркия', en: 'Kemer, Türkiye' }, when: '2026-07', rate: 4.5, likes: 19,
      text: { ru: 'Второй раз берём этот отель. Территория большая, до моря идти пять минут через сосны.',
              kk: 'Бұл қонақүйді екінші рет аламыз. Аумағы үлкен, теңізге қарағайлар арқылы бес минут.',
              en: 'Second time at this hotel. Big grounds, a five-minute walk to the sea through the pines.' } },
    { id: 'r8', who: { ru: 'Санжар Н.', kk: 'Санжар Н.', en: 'Sanzhar N.' }, hotel: 'Azure Bay Club', place: { ru: 'Шарм-эль-Шейх, Египет', kk: 'Шарм-эш-Шейх, Мысыр', en: 'Sharm El Sheikh, Egypt' }, when: '2026-04', rate: 4.3, likes: 23,
      text: { ru: 'Риф прямо у отеля, маска и трубка пригодились каждый день — рыбу видно с первых метров, но заходить лучше с понтона: у берега кораллы острые. Питание однообразное к концу недели, горячее повторяется, зато свежая выпечка и фрукты каждый день. Отель тихий, дискотеки нет, вечером живая музыка у бассейна. Wi-Fi уверенно ловит в лобби и у корпусов, в номере слабее. Трансфер из аэропорта занял сорок минут, визу ставят на месте, деньги на неё лучше взять наличными.',
              kk: 'Риф қонақүйдің дәл жанында, маска мен түтік күн сайын керек болды — балықты алғашқы метрлерден көресіз, бірақ понтоннан түскен жөн: жағада маржан өткір. Апта соңына қарай тамақ біркелкі, ыстық тағам қайталанады, есесіне жаңа піскен нан мен жеміс күн сайын. Қонақүй тыныш, дискотека жоқ, кешке бассейн жанында тірі музыка. Wi-Fi лобби мен корпустар маңында сенімді ұстайды, нөмірде әлсіз. Әуежайдан трансфер қырық минут алды, визаны жерінде қояды, оған ақшаны қолма-қол алған дұрыс.',
              en: 'The reef is right by the hotel and the mask and snorkel came in handy every day — you can see fish from the first few metres, but it is better to enter from the pontoon: the coral near the shore is sharp. The food gets repetitive by the end of the week and the hot dishes repeat, though the pastries and fruit are fresh daily. The hotel is quiet, no disco, live music by the pool in the evening. Wi-Fi holds up in the lobby and near the buildings, weaker in the room. The airport transfer took forty minutes, the visa is issued on arrival and cash is the safer way to pay for it.' } },
    { id: 'r9', who: { ru: 'Динара К.', kk: 'Динара Қ.', en: 'Dinara K.' }, hotel: 'Silver Sands Suites', place: { ru: 'Нячанг, Вьетнам', kk: 'Нячанг, Вьетнам', en: 'Nha Trang, Vietnam' }, when: '2026-01', rate: 4.6, likes: 16,
      text: { ru: 'Летели с пересадкой, зато цена за двоих вышла ниже, чем в Турцию летом. Номер на высоком этаже с видом на залив, кровать большая, кондиционер тихий. Пересадка шесть часов, в аэропорту есть где посидеть, но еду лучше взять с собой. На ресепшене есть русскоговорящий сотрудник, меню в ресторане с картинками. Море в январе тёплое, волна поднимается после обеда. Экскурсии брали не в отеле, а в городе — вышло вдвое дешевле, но проверяйте, входит ли обед.',
              kk: 'Ауысып ұштық, есесіне екеуге баға жаздағы Түркиядан арзан шықты. Нөмір жоғарғы қабатта, шығанақ көрінеді, төсек үлкен, кондиционер тыныш. Ауысу алты сағат, әуежайда отыратын жер бар, бірақ тамақты өзіңмен алған жөн. Ресепшенде орысша сөйлейтін қызметкер бар, мейрамхана мәзірі суретті. Қаңтарда теңіз жылы, толқын түстен кейін көтеріледі. Экскурсияны қонақүйден емес, қаладан алдық — екі есе арзан шықты, бірақ түскі ас кіре ме, тексеріңіз.',
              en: 'We flew with a connection, but the price for two came out lower than Türkiye in summer. High-floor room with a bay view, a big bed and a quiet air conditioner. The layover is six hours; there is somewhere to sit at the airport, but bring your own food. Reception has a Russian-speaking member of staff and the restaurant menu has pictures. The sea is warm in January, with waves picking up in the afternoon. We booked excursions in town rather than at the hotel — half the price, but check whether lunch is included.' } },
    { id: 'r10', who: { ru: 'Алибек Т.', kk: 'Әлібек Т.', en: 'Alibek T.' }, hotel: 'Emerald Aqua Resort', place: { ru: 'Санья, Китай', kk: 'Санья, Қытай', en: 'Sanya, China' }, when: '2026-02', rate: 4.2, likes: 7,
      text: { ru: 'Брали на новогодние каникулы. Отель новый, аквапарк работал, персонал по-английски говорит слабо.',
              kk: 'Жаңа жылдық демалысқа алдық. Қонақүй жаңа, аквапарк жұмыс істеді, қызметкерлер ағылшыншаны нашар біледі.',
              en: 'Booked for the New Year holidays. The hotel is new, the aquapark was open, staff English is weak.' } },
    { id: 'r11', who: { ru: 'Жанна Р.', kk: 'Жанна Р.', en: 'Zhanna R.' }, hotel: 'Lotus Beach Hotel', place: { ru: 'Алаколь, Казахстан', kk: 'Алакөл, Қазақстан', en: 'Alakol, Kazakhstan' }, when: '2026-08', rate: 4.0, likes: 11,
      text: { ru: 'Ездили на четыре ночи из Астаны. Вода тёплая, но пляж каменистый — дети ходили в тапках.',
              kk: 'Астанадан төрт түнге бардық. Су жылы, бірақ жағажай тасты — балалар тәпішкемен жүрді.',
              en: 'Four nights from Astana. The water is warm, but the beach is stony — the kids wore water shoes.' } },
    { id: 'r12', who: { ru: 'Руслан Б.', kk: 'Руслан Б.', en: 'Ruslan B.' }, hotel: 'Horizon Palace', place: { ru: 'Дубай, ОАЭ', kk: 'Дубай, БАӘ', en: 'Dubai, UAE' }, when: '2026-03', rate: 4.7, likes: 29,
      text: { ru: 'Заявку оставили вечером, утром прислали три варианта с ценами. Выбрали средний, оплатили картой.',
              kk: 'Өтінімді кешке қалдырдық, таңертең бағасымен үш нұсқа жіберді. Ортаңғысын таңдап, картамен төледік.',
              en: 'Left a request in the evening, got three priced options by morning. Took the middle one and paid by card.' } }
  ];

  var ARTICLES = [
    { id: 'a1', date: '2026-08-04', img: 'tr-alanya', min: 6, cat: { ru: 'Сезон', kk: 'Маусым', en: 'Season' },
      title: { ru: 'Куда лететь в октябре из Казахстана', kk: 'Қазанда Қазақстаннан қайда ұшу керек', en: 'Where to fly from Kazakhstan in October' },
      lead: { ru: 'Море ещё тёплое, а цена уже осенняя: разбираем шесть направлений и даты, когда они дешевле всего.',
              kk: 'Теңіз әлі жылы, ал баға күзгі: алты бағыт пен олардың ең арзан күндерін қарастырамыз.',
              en: 'The sea is still warm while prices have dropped: six destinations and the dates when they are cheapest.' } },
    { id: 'a2', date: '2026-07-21', img: 'pool', min: 8, cat: { ru: 'Отели', kk: 'Қонақүйлер', en: 'Hotels' },
      title: { ru: 'Как выбрать отель по системе питания', kk: 'Тамақтану жүйесі бойынша қонақүйді қалай таңдау керек', en: 'How to choose a hotel by board type' },
      lead: { ru: 'Чем «всё включено» отличается от полупансиона и когда завтраки выходят выгоднее.',
              kk: '«Бәрі қосылған» жартылай пансионнан немен ерекшеленеді және таңғы ас қашан тиімді.',
              en: 'How all-inclusive differs from half board and when breakfast-only works out cheaper.' } },
    { id: 'a3', date: '2026-06-30', img: 'tr-kemer', min: 5, cat: { ru: 'С детьми', kk: 'Балалармен', en: 'With kids' },
      title: { ru: 'Что взять в Турцию с ребёнком', kk: 'Түркияға баламен не алу керек', en: 'What to pack for Türkiye with a child' },
      lead: { ru: 'Список вещей, документы на ребёнка и вопросы, которые стоит задать отелю до брони.',
              kk: 'Заттар тізімі, балаға арналған құжаттар және брондау алдында қонақүйге қоятын сұрақтар.',
              en: 'A packing list, the child’s documents and what to ask the hotel before booking.' } },
    { id: 'a4', date: '2026-06-11', img: 'ge-batumi', min: 7, cat: { ru: 'Деньги', kk: 'Ақша', en: 'Money' },
      title: { ru: 'Рассрочка на тур: как это устроено', kk: 'Турға бөліп төлеу қалай жұмыс істейді', en: 'Instalments for a tour: how it works' },
      lead: { ru: 'Кто оформляет рассрочку, что происходит при отмене поездки и где искать переплату.',
              kk: 'Бөліп төлеуді кім рәсімдейді, сапар күшін жойса не болады және артық төлемді қайдан іздеу керек.',
              en: 'Who issues the instalment plan, what happens if the trip is cancelled and where overpayment hides.' } },
    { id: 'a5', date: '2026-05-27', img: 'kz-borovoe', min: 6, cat: { ru: 'Казахстан', kk: 'Қазақстан', en: 'Kazakhstan' },
      title: { ru: 'Отдых внутри страны: Алаколь, Боровое, Кендерли', kk: 'Ел ішіндегі демалыс: Алакөл, Бурабай, Кендірлі', en: 'Holidays at home: Alakol, Borovoe, Kenderli' },
      lead: { ru: 'Сезон, дорога и во сколько обходится неделя без перелёта.',
              kk: 'Маусым, жол және ұшусыз бір апта қанша тұрады.',
              en: 'The season, the drive and what a week without a flight costs.' } },
    { id: 'a6', date: '2026-05-08', img: 'ae-dubai', min: 9, cat: { ru: 'Документы', kk: 'Құжаттар', en: 'Documents' },
      title: { ru: 'Виза и правила въезда для граждан РК', kk: 'ҚР азаматтарына виза және кіру ережелері', en: 'Visas and entry rules for Kazakhstani citizens' },
      lead: { ru: 'Куда пускают по паспорту, где нужна виза заранее и сколько дней должен действовать паспорт.',
              kk: 'Қайда паспортпен кіргізеді, қайда виза алдын ала керек және паспорт неше күн жарамды болуы тиіс.',
              en: 'Where a passport is enough, where a visa is needed in advance and how long it must stay valid.' } }
  ];

  return {
    CITIES: CITIES, COUNTRIES: COUNTRIES, HOTELS: HOTELS, MEALS: MEALS,
    BEACH_TYPES: BEACH_TYPES, BEACH_OPTS: BEACH_OPTS, BEACH_LINES: BEACH_LINES,
    SERVICES: SERVICES, WATER_FUN: WATER_FUN, OPENING: OPENING,
    HOTEL_TYPES: HOTEL_TYPES, ROOMS: ROOMS, OPERATORS: OPERATORS,
    COLLECTIONS: COLLECTIONS, REVIEWS: REVIEWS, ARTICLES: ARTICLES,
    REVIEW_STATS: REVIEW_STATS,
    build: build, minByCountry: minByCountry, monthsLow: monthsLow, daysLow: daysLow,
    gallery: gallery, cover: cover, stories: stories,
    hotelOffers: hotelOffers, offerById: offerById, hotelGrid: hotelGrid,
    hotelRooms: hotelRooms, hotelReviews: hotelReviews,
    country: country, city: city, meal: meal, hotel: hotel, operator: operator,
    resort: resort, byId: byId,
    room: function (id) { return byId(ROOMS, id); },
    service: function (id) { return byId(SERVICES, id) || byId(WATER_FUN, id); },
    hotelType: function (id) { return byId(HOTEL_TYPES, id); },
    beachType: function (id) { return byId(BEACH_TYPES, id); }
  };
})();
