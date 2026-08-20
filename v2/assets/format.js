/* ============================================================================
   trips.kz — форматирование чисел и дат.
   PRODUCT.md: суммы шестизначные, разряд неразрывен, перед ₸ неразрывный пробел,
   всюду табличные цифры. DESIGN.md: сумма не мельче 25px и не легче 700 —
   это задача CSS, здесь только строка.
   ========================================================================== */
window.Fmt = (function () {
  var NBSP = ' ';

  /* Демонстрационные курсы. Реальных курсов у проекта нет — PRODUCT.md
     запрещает подавать невыверенное как факт, поэтому переключатель валюты
     подписан «курс демонстрационный». */
  var RATES = { KZT: 1, USD: 1 / 495, EUR: 1 / 535 };
  var SIGN = { KZT: '₸', USD: '$', EUR: '€' };
  var currency = 'KZT';

  var MONTHS = {
    ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  /* Именительный падеж — для ленты месяцев, где название стоит само по себе:
     «август 2026», а не «августа 2026». */
  var MONTHS_NOM = {
    ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  var MONTHS_SHORT = {
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    kk: ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  };
  var WEEK_SHORT = {
    ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
    kk: ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сн'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  };

  function lang() { return window.I18N ? window.I18N.current : 'ru'; }

  /* Разряды делит Intl, а не своя регулярка: он же знает, что в русской и
     казахской записи разделитель — неразрывный пробел, а в английской запятая.
     Пробел из Intl бывает узким неразрывным (U+202F), поэтому приводим его
     к обычному неразрывному — вёрстка цены рассчитана на него.
     Месяцы остаются своими: русскому нужен родительный падеж («14 августа»),
     а казахские формы браузеры отдают вразнобой. */
  var nfCache = {};
  function nf() {
    var key = lang();
    if (!nfCache[key]) {
      try {
        nfCache[key] = new Intl.NumberFormat(key === 'kk' ? 'kk-KZ' : (key === 'en' ? 'en-US' : 'ru-RU'),
          { maximumFractionDigits: 0 });
      } catch (e) { nfCache[key] = null; }
    }
    return nfCache[key];
  }
  function groups(n) {
    var v = Math.round(n), f = nf();
    if (!f) return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    return f.format(v).replace(/[\u00A0\u202F\u2009 ]/g, NBSP);
  }

  /* Сумма в текущей валюте. Тенге — целыми, валюта — тоже целыми:
     в этой категории копейки не показывают. */
  function money(kzt) {
    var v = kzt * RATES[currency];
    if (currency === 'KZT') return groups(v) + NBSP + SIGN.KZT;
    return SIGN[currency] + NBSP + groups(v);
  }

  /* Разбор суммы на части — крупная цифра и знак валюты живут в разной
     типографике, поэтому карточке нужны куски, а не готовая строка. */
  function moneyParts(kzt) {
    var v = kzt * RATES[currency];
    return currency === 'KZT'
      ? { value: groups(v), sign: SIGN.KZT, signFirst: false }
      : { value: groups(v), sign: SIGN[currency], signFirst: true };
  }

  function setCurrency(code) {
    if (!RATES[code]) return;
    currency = code;
    try { localStorage.setItem('trips.currency', code); } catch (e) {}
    document.dispatchEvent(new CustomEvent('currency:change', { detail: { currency: code } }));
  }
  function getCurrency() { return currency; }
  function initCurrency() {
    var saved;
    try { saved = localStorage.getItem('trips.currency'); } catch (e) {}
    if (saved && RATES[saved]) currency = saved;
  }

  /* Числительные. Русский требует трёх форм, казахский — одной,
     английский — двух. Правило одно на все счётные строки. */
  function plural(n, one, few, many) {
    var l = lang();
    if (l === 'kk') return one;
    if (l === 'en') return n === 1 ? one : few;
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function nights(n) {
    var t = window.I18N.t;
    return n + NBSP + plural(n, t('card.night'), t('card.nights2'), t('card.nights5'));
  }

  function parseISO(iso) {
    var p = String(iso).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function toISO(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }

  function dayMonth(iso) {
    var d = parseISO(iso), l = lang();
    return d.getDate() + NBSP + MONTHS_SHORT[l][d.getMonth()];
  }
  function dayMonthFull(iso) {
    var d = parseISO(iso), l = lang();
    return d.getDate() + NBSP + MONTHS[l][d.getMonth()];
  }
  function weekday(iso) {
    return WEEK_SHORT[lang()][parseISO(iso).getDay()];
  }
  function monthName(index) { return MONTHS[lang()][index]; }
  function monthNom(index) { return MONTHS_NOM[lang()][index]; }
  function monthShort(index) { return MONTHS_SHORT[lang()][index]; }

  /* Диапазон вылет — возврат: «12–19 июля», через месяц — «29 июля — 5 авг». */
  function range(isoFrom, nightsCount) {
    var a = parseISO(isoFrom), b = addDays(a, nightsCount), l = lang();
    if (a.getMonth() === b.getMonth()) {
      return a.getDate() + '–' + b.getDate() + NBSP + MONTHS[l][b.getMonth()];
    }
    return a.getDate() + NBSP + MONTHS_SHORT[l][a.getMonth()] + ' — ' +
           b.getDate() + NBSP + MONTHS_SHORT[l][b.getMonth()];
  }

  function rating(value) {
    var t = window.I18N.t;
    var key = value >= 9 ? 'card.rating.9' : value >= 8 ? 'card.rating.8' : value >= 7 ? 'card.rating.7' : 'card.rating.0';
    return t(key);
  }

  function ratingNum(value) {
    return value.toFixed(1).replace('.', ',');
  }

  return {
    NBSP: NBSP,
    money: money,
    moneyParts: moneyParts,
    setCurrency: setCurrency,
    getCurrency: getCurrency,
    initCurrency: initCurrency,
    plural: plural,
    nights: nights,
    parseISO: parseISO,
    toISO: toISO,
    addDays: addDays,
    dayMonth: dayMonth,
    dayMonthFull: dayMonthFull,
    weekday: weekday,
    monthName: monthName,
    monthNom: monthNom,
    monthShort: monthShort,
    range: range,
    rating: rating,
    ratingNum: ratingNum
  };
})();
