/* ============================================================================
   trips.kz — страница выдачи. Фильтры, сортировка, вид, карта, состояния.
   Всё состояние живёт в адресе страницы: ссылка на выдачу шарится как есть.
   ========================================================================== */
(function () {
  var qs = App.qs, qsa = App.qsa, esc = App.esc, icon = App.icon, t = App.t, nm = App.nm;
  var nmGen = App.nmGen, nmAcc = App.nmAcc;

  var params, F, all = [], base = [], shown = [], bounds = { min: 0, max: 0 };
  var view = 'list', sort = 'price', page = 1, PER = 20;
  var loading = false, failed = false, openGroups = null, form = null, lastKey = null;
  var pollTimer = null;   /* опрос операторов: новый запуск отменяет предыдущий */

  var SORTS = ['price', 'priceDesc', 'rating', 'stars', 'date', 'nights', 'profit'];

  /* ==========================================================================
     Состояние фильтров
     ======================================================================== */
  /* Ключ фильтра в разметке → поле состояния. Одна таблица вместо трёх копий
     этого же соответствия в обработчиках. */
  var LIST_OF = {
    resort: 'resorts', stars: 'stars', meal: 'meals', open: 'opening', type: 'types',
    line: 'lines', beach: 'beach', svc: 'svc', water: 'water', op: 'operators'
  };

  function emptyFilters(p) {
    return {
      date: p.date, flex: p.flex,
      nightsMin: p.nightsMin, nightsMax: p.nightsMax,
      priceMin: null, priceMax: null, perOne: false,
      resorts: [], stars: [], rating: 0, meals: [], types: [], beach: [], lines: [],
      svc: [], water: [], opening: [], bonus: false, exclusive: false, direct: false,
      operators: []
    };
  }

  function readURL() {
    params = App.paramsFromURL();
    params.from = App.state.city && !new URLSearchParams(location.search).get('from')
      ? App.state.city : params.from;
    App.saveCity(params.from);
    F = emptyFilters(params);
    var u = new URLSearchParams(location.search);
    var arr = function (k) { return u.get(k) ? u.get(k).split(',') : []; };
    F.resorts = arr('resort');
    F.stars = arr('stars').map(Number);
    F.rating = +u.get('rating') || 0;
    F.meals = arr('meal');
    F.types = arr('type');
    F.beach = arr('beach');
    F.lines = arr('line');
    F.svc = arr('svc');
    F.water = arr('water');
    F.opening = arr('open');
    F.operators = arr('op');
    F.direct = u.get('direct') === '1';
    F.bonus = u.get('bonus') === '1';
    F.exclusive = u.get('excl') === '1';
    F.perOne = u.get('per') === '1';
    if (u.get('pmin')) F.priceMin = +u.get('pmin');
    if (u.get('pmax')) F.priceMax = +u.get('pmax');
    if (u.get('sort') && SORTS.indexOf(u.get('sort')) !== -1) sort = u.get('sort');
    if (['list', 'grid', 'map'].indexOf(u.get('view')) !== -1) view = u.get('view');
    /* Ссылки подборок с главной приходят готовым набором фильтров: coll=ai5
       разворачивается в meal=AI&stars=5 ещё на главной, здесь ничего не нужно. */
  }

  function writeURL(replace) {
    var extra = {
      sort: sort !== 'price' ? sort : '',
      view: view !== 'list' ? view : '',
      resort: F.resorts.join(','),
      stars: F.stars.join(','),
      rating: F.rating || '',
      meal: F.meals.join(','),
      type: F.types.join(','),
      beach: F.beach.join(','),
      line: F.lines.join(','),
      svc: F.svc.join(','),
      water: F.water.join(','),
      open: F.opening.join(','),
      op: F.operators.join(','),
      direct: F.direct ? '1' : '',
      bonus: F.bonus ? '1' : '',
      excl: F.exclusive ? '1' : '',
      per: F.perOne ? '1' : '',
      pmin: F.priceMin && F.priceMin > bounds.min ? F.priceMin : '',
      pmax: F.priceMax && F.priceMax < bounds.max ? F.priceMax : ''
    };
    var p = App.paramsToQuery({
      from: params.from, to: params.to, date: F.date, dateEnd: '', flex: F.flex,
      nightsMin: F.nightsMin, nightsMax: F.nightsMax, adults: params.adults,
      kids: params.kids, tab: params.tab
    }, extra);
    history[replace ? 'replaceState' : 'pushState']({}, '', location.pathname + '?' + p);
  }

  /* ==========================================================================
     Отбор
     ======================================================================== */
  function inDateWindow(tour) {
    var w = F.flex ? 6 : 3;
    var d = Math.abs(Fmt.parseISO(tour.date) - Fmt.parseISO(F.date)) / 86400000;
    return d <= w;
  }

  function buildBase() {
    all = Data.build(params.from, params.date);
    window.__tours = all;
    window.__toursAnchor = params.date;
    var parts = (params.to || '').split(':');
    base = all.filter(function (x) {
      if (parts[0] && x.countryId !== parts[0]) return false;
      if (parts[1] && x.resortId !== parts[1]) return false;
      return inDateWindow(x) && x.nights >= F.nightsMin && x.nights <= F.nightsMax;
    });
    var prices = base.map(function (x) { return x.price; });
    bounds.min = prices.length ? Math.min.apply(null, prices) : 0;
    bounds.max = prices.length ? Math.max.apply(null, prices) : 0;
    if (F.priceMin === null || F.priceMin < bounds.min) F.priceMin = bounds.min;
    if (F.priceMax === null || F.priceMax > bounds.max) F.priceMax = bounds.max;
  }

  function matches(x, skip) {
    var h = Data.hotel(x.hotelId);
    if (skip !== 'price' && (x.price < F.priceMin || x.price > F.priceMax)) return false;
    if (skip !== 'resort' && F.resorts.length && F.resorts.indexOf(x.resortId) === -1) return false;
    if (skip !== 'stars' && F.stars.length && F.stars.indexOf(h.s) === -1) return false;
    if (skip !== 'rating' && F.rating && h.rate < F.rating) return false;
    if (skip !== 'meal' && F.meals.length && F.meals.indexOf(x.meal) === -1) return false;
    if (skip !== 'open' && F.opening.length && !F.opening.every(function (v) {
      return v === 'new' ? h.opened >= 2024 : !!h.renov;
    })) return false;
    if (skip !== 'type' && F.types.length && !F.types.some(function (v) { return h.types.indexOf(v) !== -1; })) return false;
    if (skip !== 'line' && F.lines.length && F.lines.indexOf(String(h.line)) === -1) return false;
    if (skip !== 'beach' && F.beach.length && !F.beach.every(function (v) {
      if (v === 'sand' || v === 'pebble' || v === 'mixed') return h.beach === v;
      if (v === 'own') return h.line === 1;
      if (v === 'near') return h.dist <= 500;
      return true;
    })) return false;
    if (skip !== 'svc' && F.svc.length && !F.svc.every(function (v) { return h.svc.indexOf(v) !== -1; })) return false;
    if (skip !== 'water' && F.water.length && !F.water.every(function (v) { return h.water.indexOf(v) !== -1; })) return false;
    if (skip !== 'direct' && F.direct && !x.direct) return false;
    /* Бонусы и «только у нас» — свойства предложения, а не отеля: мгновенное
       подтверждение и горящая цена и есть то, что оператор отдаёт только нам. */
    if (skip !== 'bonus' && F.bonus && !x.instant) return false;
    if (skip !== 'excl' && F.exclusive && !x.hot) return false;
    if (skip !== 'op' && F.operators.length && F.operators.indexOf(x.operatorId) === -1) return false;
    return true;
  }

  function apply() {
    var passed = base.filter(function (x) { return matches(x); });
    var by = {
      price: function (a, b) { return a.price - b.price; },
      priceDesc: function (a, b) { return b.price - a.price; },
      rating: function (a, b) { return Data.hotel(b.hotelId).rate - Data.hotel(a.hotelId).rate; },
      stars: function (a, b) { return Data.hotel(b.hotelId).s - Data.hotel(a.hotelId).s; },
      date: function (a, b) { return a.date < b.date ? -1 : 1; },
      nights: function (a, b) { return a.nights - b.nights; },
      profit: function (a, b) { return b.discount - a.discount || a.price - b.price; }
    };
    passed.sort(by[sort] || by.price);
    /* Отель в выдаче — одна строка. Остальные его предложения не исчезают:
       они раскрываются в карточке кнопкой «Ещё варианты дат и питания». */
    var seen = {};
    shown = passed.filter(function (x) {
      if (seen[x.hotelId]) return false;
      seen[x.hotelId] = 1;
      return true;
    });
  }

  /* Счётчики фильтров считают отели, а не предложения: иначе число рядом со
     значением не сходится с числом карточек. */
  function count(skip, pred) {
    var seen = {}, n = 0;
    for (var i = 0; i < base.length; i++) {
      var x = base[i];
      if (seen[x.hotelId]) continue;
      if (matches(x, skip) && pred(x)) { seen[x.hotelId] = 1; n++; }
    }
    return n;
  }

  /* ==========================================================================
     Шапка выдачи
     ======================================================================== */
  function renderHead() {
    var city = nmGen(Data.city(params.from));
    var countryId = (params.to || '').split(':')[0];
    var c = countryId ? Data.country(countryId) : null;
    var r = params.to.indexOf(':') > 0 ? Data.resort(countryId, params.to.split(':')[1]) : null;

    qs('[data-h1]').textContent = c
      ? t('search.h1', { country: nmAcc(c), city: city })
      : t('search.h1any', { city: city });
    document.title = qs('[data-h1]').textContent + ' — trips.kz';

    var step = 0;
    function crumb(label, href) {
      step++;
      return '<span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">' +
        (href ? '<a itemprop="item" href="' + href + '"><span itemprop="name">' + esc(label) + '</span></a>'
              : '<span itemprop="name">' + esc(label) + '</span>') +
        '<meta itemprop="position" content="' + step + '"></span>';
    }
    var crumbs = crumb(t('search.crumbs.home'), 'index.html') + '<span aria-hidden="true">/</span>' +
      crumb(t('search.crumbs.tours'), 'search.html');
    if (c) crumbs += '<span aria-hidden="true">/</span>' + crumb(nm(c.name));
    if (r) crumbs += '<span aria-hidden="true">/</span>' + crumb(nm(r.name));
    var box = qs('[data-crumbs]');
    box.setAttribute('itemscope', '');
    box.setAttribute('itemtype', 'https://schema.org/BreadcrumbList');
    box.innerHTML = crumbs;

    qs('[data-summary]').innerHTML = App.summaryLine({
      from: params.from, to: params.to, date: F.date,
      nightsMin: F.nightsMin, nightsMax: F.nightsMax,
      adults: params.adults, kids: params.kids
    });
  }

  /* ==========================================================================
     Фильтры
     ======================================================================== */
  function group(key, title, body, selected) {
    var open = openGroups.indexOf(key) !== -1;
    return '<details class="fgroup" data-group="' + key + '"' + (open ? ' open' : '') + '>' +
      '<summary>' + esc(title) +
        (selected ? '<span class="fgroup__badge">' + selected + '</span>' : '') +
        icon('chev-d') + '</summary>' +
      '<div class="fgroup__body">' + body + '</div></details>';
  }

  /* Строка списка. «только» рядом со значением — быстрый сброс остальных:
     обычный путь «снять четыре галочки, чтобы осталась одна» здесь занимает
     четыре клика, а нужен он ровно тогда, когда список длинный. */
  function checkline(key, value, label, n, checked, sub) {
    var off = n === 0 && !checked;
    return '<label class="checkline' + (off ? ' checkline--off' : '') + '" data-key="' + key + ':' + value + '">' +
      '<input type="checkbox" data-check="' + key + '" value="' + esc(value) + '"' +
        (checked ? ' checked' : '') + (off ? ' disabled' : '') + '>' +
      '<span class="check__box">' + icon('check') + '</span>' +
      '<span class="checkline__label">' + esc(label) +
        (sub ? ' <i class="checkline__sub">' + esc(sub) + '</i>' : '') + '</span>' +
      (off ? '' : '<button class="checkline__only" type="button" data-only="' + key + ':' + esc(value) + '">' +
        esc(t('flt.only')) + '</button>') +
      '<span class="checkline__count">' + n + '</span></label>';
  }

  /* «Любой / Любое / Все оценки» — не украшение, а видимый способ вернуться
     к полному списку, не разыскивая, какие галочки стоят. */
  function anyline(key, on, n) {
    return '<label class="checkline checkline--any" data-key="' + key + ':any">' +
      '<input type="checkbox" data-any="' + key + '"' + (on ? ' checked' : '') + '>' +
      '<span class="check__box">' + icon('check') + '</span>' +
      '<span class="checkline__label">' + esc(t('flt.any.' + key)) + '</span>' +
      '<span class="checkline__count">' + n + '</span></label>';
  }

  function toggleline(key, label, n, on) {
    return '<label class="checkline checkline--toggle" data-key="' + key + ':1">' +
      '<input type="checkbox" data-toggle="' + key + '"' + (on ? ' checked' : '') + '>' +
      '<span class="check__box">' + icon('check') + '</span>' +
      '<span class="checkline__label">' + esc(label) + '</span>' +
      '<span class="checkline__count">' + n + '</span></label>';
  }

  /* Длинный список (курорты, авиакомпании) показывается первыми значениями, а
     хвост — по кнопке: иначе один фильтр вытягивает панель на несколько экранов
     и остальные условия перестают быть видны. Выбранные всегда в видимой части
     — иначе пользователь потеряет из виду то, что сам же и включил. */
  var openLists = {};
  function capList(items, key, limit) {
    if (items.length <= limit || openLists[key]) return items.join('');
    return items.slice(0, limit).join('') +
      '<button class="fmore" type="button" data-open-list="' + key + '">' +
        esc(t('flt.moreN', { n: items.length - limit })) + icon('chev-d') + '</button>';
  }

  function renderFilters() {
    var host = qs('[data-filters]');
    var countryId = (params.to || '').split(':')[0];
    var resorts = [];
    (countryId ? [Data.country(countryId)] : Data.COUNTRIES).forEach(function (c) {
      if (c) c.resorts.forEach(function (r) { resorts.push({ id: r.id, name: nm(r.name), c: nm(c.name) }); });
    });
    resorts = resorts.filter(function (r) {
      return count('resort', function (x) { return x.resortId === r.id; }) > 0 || F.resorts.indexOf(r.id) !== -1;
    });

    var html = '';

    /* 1—2. Два переключателя без заголовка группы: это не «условие отбора»,
       а два предложения от площадки, и у агрегаторов они всегда стоят первыми. */
    html += '<div class="ftoggles">' +
      toggleline('bonus', t('flt.bonus'), count('bonus', function (x) { return x.instant; }), F.bonus) +
      toggleline('excl', t('flt.exclusive'), count('excl', function (x) { return x.hot; }), F.exclusive) +
    '</div>';

    /* 3. Класс отеля */
    html += group('stars', t('flt.hotelClass'),
      anyline('stars', !F.stars.length, base.length) +
      [5, 4, 3, 2, 0].map(function (s) {
        var n = count('stars', function (x) { return s === 2 ? Data.hotel(x.hotelId).s <= 2 && Data.hotel(x.hotelId).s > 0
          : (s === 0 ? Data.hotel(x.hotelId).s === 0 : Data.hotel(x.hotelId).s === s); });
        return checkline('stars', s, t('flt.stars' + s), n, F.stars.indexOf(s) !== -1);
      }).join(''), F.stars.length);

    /* 4. Питание */
    html += group('meal', t('flt.meal'),
      anyline('meal', !F.meals.length, base.length) +
      Data.MEALS.map(function (m) {
        return checkline('meal', m.id, nm(m.name),
          count('meal', function (x) { return x.meal === m.id; }), F.meals.indexOf(m.id) !== -1);
      }).join(''), F.meals.length);

    /* 5. Открытие и реновация */
    html += group('open', t('flt.opening'),
      anyline('open', !F.opening.length, base.length) +
      Data.OPENING.map(function (o) {
        return checkline('open', o.id, nm(o.name), count('open', function (x) {
          var h = Data.hotel(x.hotelId);
          return o.id === 'new' ? h.opened >= 2024 : !!h.renov;
        }), F.opening.indexOf(o.id) !== -1);
      }).join(''), F.opening.length);

    /* 6. Бюджет: поля «от» и «до» и быстрые пороги — так его и вводят */
    var steps = [200000, 300000, 400000, 500000, 700000, 1000000].filter(function (v) {
      return v > bounds.min && v < bounds.max;
    });
    html += group('price', t('flt.budget'),
      '<div class="budget" data-range="price">' +
        '<div class="budget__row">' +
          '<label class="budget__field"><span>' + esc(t('flt.from')) + '</span>' +
            '<input type="text" inputmode="numeric" data-lo-input value="' + F.priceMin + '" aria-label="' + esc(t('flt.from')) + '"></label>' +
          '<span class="budget__dash" aria-hidden="true">—</span>' +
          '<label class="budget__field"><span>' + esc(t('flt.to')) + '</span>' +
            '<input type="text" inputmode="numeric" data-hi-input value="' + F.priceMax + '" aria-label="' + esc(t('flt.to')) + '"></label>' +
        '</div>' +
        '<div class="budget__for"><span class="t-meta">' + esc(t('flt.priceFor')) + '</span>' +
          '<span class="seg"><button type="button" data-per="two" aria-pressed="' + (!F.perOne) + '">' + esc(t('flt.forTwo')) + '</button>' +
          '<button type="button" data-per="one" aria-pressed="' + F.perOne + '">' + esc(t('flt.forOne')) + '</button></span></div>' +
        '<div class="budget__steps">' + steps.map(function (v) {
          return '<button class="budget__step" type="button" data-price-cap="' + v + '"' +
            (F.priceMax === v ? ' aria-pressed="true"' : '') + '>' +
            esc(t('flt.upTo', { sum: Fmt.money(v) })) + '</button>';
        }).join('') + '</div>' +
      '</div>',
      (F.priceMin > bounds.min || F.priceMax < bounds.max) ? 1 : 0);

    /* 7. Прямые перелёты — снова одиночный переключатель, без группы */
    html += '<div class="ftoggles">' +
      toggleline('direct', t('flt.directFlights'), count('direct', function (x) { return x.direct; }), F.direct) +
    '</div>';

    /* 8. Курорты */
    html += group('resort', t('flt.resorts'),
      '<div class="fsearch">' + icon('search') +
        '<input type="text" data-resort-filter placeholder="' + esc(t('flt.searchIn')) + '" aria-label="' + esc(t('flt.searchIn')) + '"></div>' +
      '<div data-resort-list>' +
        anyline('resort', !F.resorts.length, base.length) +
        capList(resorts.sort(function (a, b) {
          var sa = F.resorts.indexOf(a.id) !== -1, sb = F.resorts.indexOf(b.id) !== -1;
          return sa === sb ? 0 : (sa ? -1 : 1);
        }).map(function (r) {
          return checkline('resort', r.id, r.name, count('resort', function (x) { return x.resortId === r.id; }),
            F.resorts.indexOf(r.id) !== -1, r.c);
        }), 'resort', 11) +
      '</div>', F.resorts.length);

    /* 9. Тип отдыха */
    html += group('type', t('flt.stayType'),
      anyline('type', !F.types.length, base.length) +
      Data.HOTEL_TYPES.map(function (ty) {
        return checkline('type', ty.id, nm(ty.name),
          count('type', function (x) { return Data.hotel(x.hotelId).types.indexOf(ty.id) !== -1; }),
          F.types.indexOf(ty.id) !== -1);
      }).join(''), F.types.length);

    /* 10. Линия пляжа */
    html += group('line', t('flt.beachLine'),
      anyline('line', !F.lines.length, base.length) +
      Data.BEACH_LINES.map(function (b) {
        return checkline('line', b.id, nm(b.name),
          count('line', function (x) { return Data.hotel(x.hotelId).line === b.line; }),
          F.lines.indexOf(b.id) !== -1);
      }).join(''), F.lines.length);

    /* 11. Тип пляжа */
    html += group('beach', t('flt.beachType'),
      anyline('beach', !F.beach.length, base.length) +
      Data.BEACH_TYPES.concat(Data.BEACH_OPTS).map(function (b) {
        return checkline('beach', b.id, nm(b.name), count('beach', function (x) {
          var h = Data.hotel(x.hotelId);
          if (b.id === 'own') return h.line === 1;
          if (b.id === 'near') return h.dist <= 500;
          return h.beach === b.id;
        }), F.beach.indexOf(b.id) !== -1);
      }).join(''), F.beach.length);

    /* 12. Оценка по отзывам — пороги со словесной оценкой, а не голые цифры */
    html += group('rating', t('flt.reviewScore'),
      [0, 9, 8, 7].map(function (v) {
        var n = v ? count('rating', function (x) { return Data.hotel(x.hotelId).rate >= v; }) : base.length;
        if (!v) return anyline('rating', !F.rating, n);
        return '<label class="checkline" data-key="rating:' + v + '">' +
          '<input type="radio" name="rating" data-rating value="' + v + '"' + (F.rating === v ? ' checked' : '') + '>' +
          '<span class="check__box">' + icon('check') + '</span>' +
          '<span class="checkline__label"><b class="score-pill">' + Fmt.ratingNum(v) + '</b> ' + esc(t('flt.score' + v)) + '</span>' +
          '<span class="checkline__count">' + n + '</span></label>';
      }).join(''), F.rating ? 1 : 0);

    /* 13. Удобства */
    html += group('svc', t('flt.amenities'),
      Data.SERVICES.map(function (s) {
        return checkline('svc', s.id, nm(s.name),
          count('svc', function (x) { return Data.hotel(x.hotelId).svc.indexOf(s.id) !== -1; }),
          F.svc.indexOf(s.id) !== -1);
      }).join(''), F.svc.length);

    /* 14. Водные развлечения */
    html += group('water', t('flt.waterFun'),
      Data.WATER_FUN.map(function (s) {
        return checkline('water', s.id, nm(s.name),
          count('water', function (x) { return Data.hotel(x.hotelId).water.indexOf(s.id) !== -1; }),
          F.water.indexOf(s.id) !== -1);
      }).join(''), F.water.length);

    /* 15. Туроператоры */
    html += group('op', t('flt.operators'),
      anyline('op', !F.operators.length, base.length) +
      Data.OPERATORS.map(function (o) {
        return checkline('op', o.id, o.name, count('op', function (x) { return x.operatorId === o.id; }),
          F.operators.indexOf(o.id) !== -1);
      }).join(''), F.operators.length);

    host.innerHTML = html;

    if (lastKey) {
      var back = qs('[data-key="' + lastKey + '"] input, [data-key="' + lastKey + '"]', host);
      if (back && back.focus) back.focus();
    }
    bindRanges(host);
  }

  /* Бюджет вводят числом, а не ползунком: «до 400 000» набирают точнее, чем
     ловят ручкой, а быстрые пороги закрывают самый частый случай. */
  function bindRanges(host) {
    var box = qs('[data-range="price"]', host);
    if (!box) return;
    var lo = qs('[data-lo-input]', box), hi = qs('[data-hi-input]', box);
    function num(el, fallback) {
      var v = parseInt(String(el.value).replace(/[^0-9]/g, ''), 10);
      return isNaN(v) ? fallback : v;
    }
    function commit() {
      var a = num(lo, bounds.min), b = num(hi, bounds.max);
      F.priceMin = Math.max(bounds.min, Math.min(a, b));
      F.priceMax = Math.min(bounds.max, Math.max(a, b));
      update();
    }
    [lo, hi].forEach(function (el) {
      el.addEventListener('change', commit);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    });
  }

  /* Активные фильтры чипами */
  function activeChips() {
    var out = [];
    var add = function (key, value, label) {
      out.push('<button class="chip-x" type="button" data-drop="' + key + '" data-val="' + esc(value) + '">' +
        esc(label) + icon('close') + '</button>');
    };
    F.resorts.forEach(function (id) {
      var r = Data.resort((params.to || '').split(':')[0] || findCountryOfResort(id), id);
      add('resort', id, r ? nm(r.name) : id);
    });
    F.stars.forEach(function (s) { add('stars', s, t('flt.stars' + s)); });
    if (F.rating) add('rating', F.rating, t('flt.score' + F.rating));
    F.meals.forEach(function (m) { add('meal', m, nm(Data.meal(m).name)); });
    F.opening.forEach(function (o) { add('open', o, nm(Data.byId(Data.OPENING, o).name)); });
    F.types.forEach(function (x) { add('type', x, nm(Data.hotelType(x).name)); });
    F.lines.forEach(function (l) { add('line', l, nm(Data.byId(Data.BEACH_LINES, l).name)); });
    F.beach.forEach(function (b) {
      var o = Data.byId(Data.BEACH_TYPES, b) || Data.byId(Data.BEACH_OPTS, b);
      add('beach', b, o ? nm(o.name) : b);
    });
    F.svc.forEach(function (s) { add('svc', s, nm(Data.service(s).name)); });
    F.water.forEach(function (s) { add('water', s, nm(Data.service(s).name)); });
    F.operators.forEach(function (o) { add('op', o, Data.operator(o).name); });
    if (F.direct) add('direct', '1', t('flt.directFlights'));
    if (F.bonus) add('bonus', '1', t('flt.bonus'));
    if (F.exclusive) add('excl', '1', t('flt.exclusive'));
    if (F.priceMax < bounds.max || F.priceMin > bounds.min) {
      add('price', '1', Fmt.money(F.priceMin) + ' — ' + Fmt.money(F.priceMax));
    }
    return out;
  }
  function findCountryOfResort(id) {
    var found = '';
    Data.COUNTRIES.forEach(function (c) {
      c.resorts.forEach(function (r) { if (r.id === id) found = c.id; });
    });
    return found;
  }

  function renderSortbar() {
    var chips = activeChips();
    qs('[data-count]').textContent = t('search.found', { n: shown.length });
    qs('[data-chips]').innerHTML = chips.join('') +
      (chips.length ? '<button class="chip-x" type="button" data-reset-all>' + esc(t('search.resetAll')) + '</button>' : '');
    var sel = qs('[data-sort]');
    if (!sel.dataset.filled) {
      sel.dataset.filled = '1';
      sel.addEventListener('change', function () { sort = sel.value; apply(); renderResults(); writeURL(true); });
    }
    sel.innerHTML = SORTS.map(function (s) {
      return '<option value="' + s + '"' + (s === sort ? ' selected' : '') + '>' + esc(t('search.sort.' + s)) + '</option>';
    }).join('');
    qsa('[data-view]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view));
    });
    var mb = qs('[data-sheet-count]');
    if (mb) mb.textContent = t('search.showN', { n: shown.length });
  }

  /* ==========================================================================
     Результаты
     ======================================================================== */
  function skeletons(n) {
    var one = '<div class="sk-row"><div class="skeleton sk-media"></div>' +
      '<div class="sk-col"><div class="skeleton sk-line" style="width:60%"></div>' +
      '<div class="skeleton sk-line" style="width:40%"></div>' +
      '<div class="skeleton sk-line" style="width:80%"></div>' +
      '<div class="skeleton sk-line" style="width:52%"></div></div>' +
      '<div class="sk-col"><div class="skeleton sk-line" style="width:70%;height:24px"></div>' +
      '<div class="skeleton sk-line" style="width:90%"></div>' +
      '<div class="skeleton sk-line" style="width:100%;height:44px;border-radius:100px"></div></div></div>';
    return new Array(n).fill(one).join('');
  }

  function hintCheaper() {
    var countryId = (params.to || '').split(':')[0] || 'tr';
    var days = Data.daysLow(params.from, countryId, F.date, 9);
    var min = days.reduce(function (a, b) { return a.price < b.price ? a : b; });
    var here = days[Math.floor(days.length / 2)];
    var diff = here.price - min.price;
    if (diff <= 0) return '';
    return '<div class="result-hint">' +
      '<span class="result-hint__lead">' + icon('percent') +
        '<span>' + t('search.hint.cheaper', { sum: '<b>' + Fmt.money(diff) + '</b>' }) + '</span></span>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-set-date="' + min.date + '">' +
        esc(t('search.hint.cheaperAct')) + '</button></div>';
  }

  function hintCalendar() {
    var countryId = (params.to || '').split(':')[0] || 'tr';
    var days = Data.daysLow(params.from, countryId, F.date, 9);
    var min = Math.min.apply(null, days.map(function (d) { return d.price; }));
    return '<div class="result-hint" style="flex-direction:column;align-items:stretch">' +
      '<span class="result-hint__lead">' + icon('calendar') + '<span>' + esc(t('search.hint.calendar')) + '</span></span>' +
      '<div class="days">' + days.map(function (d) {
        return '<button class="day-col' + (d.price === min ? ' day-col--min' : '') +
          (d.date === F.date ? ' day-col--sel' : '') + '" type="button" data-set-date="' + d.date + '">' +
          '<span class="day-col__dow">' + Fmt.weekday(d.date) + '</span>' +
          '<span class="day-col__date">' + Fmt.dayMonth(d.date) + '</span>' +
          '<span class="day-col__price">' + Math.round(d.price / 1000) + 'к</span></button>';
      }).join('') + '</div></div>';
  }

  function renderResults() {
    var box = qs('[data-results]');
    var mapBox = qs('[data-map]');
    box.hidden = view === 'map';
    mapBox.hidden = view !== 'map';
    qs('[data-more-wrap]').hidden = view === 'map';

    if (view === 'map') { renderMap(); return; }

    box.className = 'results' + (view === 'grid' ? ' results--grid' : '');

    if (loading) { box.innerHTML = skeletons(4); qs('[data-more-wrap]').hidden = true; return; }

    if (failed) {
      box.innerHTML = '<div class="error-state" role="alert">' +
        '<h3>' + esc(t('search.error.title')) + '</h3>' +
        '<p>' + esc(t('search.error.lead')) + '</p>' +
        '<button class="btn btn--primary" type="button" data-retry>' + esc(t('search.error.retry')) + '</button></div>';
      qs('[data-more-wrap]').hidden = true;
      return;
    }

    if (!shown.length) {
      var chips = activeChips();
      var firstFilterLabel = chips.length
        ? qs('[data-chips] .chip-x') && qs('[data-chips] .chip-x').textContent.trim()
        : '';
      box.innerHTML = '<div class="empty-state">' +
        '<p class="t-h5">' + esc(t('search.empty.title')) + '</p>' +
        '<p>' + esc(t('search.empty.lead')) + '</p>' +
        '<div class="row" style="justify-content:center">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-widen>' + esc(t('search.empty.a')) + '</button>' +
          (firstFilterLabel ? '<button class="btn btn--ghost btn--sm" type="button" data-drop-first>' +
            esc(t('search.empty.b', { f: firstFilterLabel })) + '</button>' : '') +
          '<button class="btn btn--ghost btn--sm" type="button" data-reset-all>' + esc(t('search.resetAll')) + '</button>' +
        '</div></div>';
      qs('[data-more-wrap]').hidden = true;
      return;
    }

    var list = shown.slice(0, page * PER);
    var minPrice = shown[0] ? Math.min.apply(null, shown.map(function (x) { return x.price; })) : 0;
    var html = '';
    list.forEach(function (x, i) {
      html += App.tourRow(x, { min: x.price === minPrice });
      if (i === 1 && view === 'list') html += hintCheaper();
      if (i === 4 && view === 'list') html += hintCalendar();
    });
    box.innerHTML = html;

    var more = qs('[data-more-wrap]');
    more.hidden = list.length >= shown.length;
    qs('[data-more-btn]').textContent = t('search.more');
    document.dispatchEvent(new CustomEvent('cards:render'));
  }

  function renderMap() {
    var canvas = qs('[data-map-canvas]'), list = qs('[data-map-list]');
    /* На карте отель — это точка, а не строка выдачи: несколько предложений
       одного отеля свелись бы в один пин и читались бы как дубли. */
    var seen = {}, top = [];
    shown.forEach(function (x) {
      if (seen[x.hotelId] || top.length >= 12) return;
      seen[x.hotelId] = 1;
      top.push(x);
    });
    canvas.innerHTML = '<span class="map-note">' + esc(t('search.map.hint')) + '</span>' +
      top.map(function (x) {
        return '<button class="pin" type="button" data-pin="' + x.id + '" style="left:' + (x.mapX * 100) + '%;top:' + (x.mapY * 100) + '%">' +
          Fmt.money(x.price) + '</button>';
      }).join('') +
      (shown.length > top.length
        ? '<button class="pin pin--cluster" type="button" style="left:78%;top:22%">+' + (shown.length - top.length) + '</button>'
        : '');
    list.innerHTML = top.map(function (x) {
      var h = Data.hotel(x.hotelId);
      return '<article class="map-card" data-card="' + x.id + '">' +
        '<div class="map-card__media">' + App.photo(h.img, h.name) + '</div>' +
        '<div><b class="t-h6">' + esc(h.name) + '</b> ' + App.starsHTML(h.s) +
          '<div class="t-meta">' + Fmt.range(x.date, x.nights) + ' · ' + Fmt.nights(x.nights) + '</div>' +
          '<div class="price-line"><span class="t-price" style="font-size:var(--t-h6)">' + Fmt.money(x.price) + '</span></div>' +
        '</div></article>';
    }).join('');
  }

  /* ==========================================================================
     Обновление и загрузка
     ======================================================================== */
  function update(rebuildFilters) {
    apply();
    renderSortbar();
    renderResults();
    if (rebuildFilters !== false) renderFilters();
    writeURL(true);
  }

  function runSearch() {
    /* Быстрая смена параметров не должна оставлять позади живой таймер:
       иначе прошлый «опрос» дорисует свой счётчик поверх нового. */
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    loading = true;
    failed = new URLSearchParams(location.search).get('state') === 'error';
    page = 1;
    buildBase();
    apply();
    renderHead();
    renderSortbar();
    renderResults();
    renderFilters();

    var bar = qs('[data-progress-bar]'), label = qs('[data-progress-label]');
    var target = shown.length, step = 0;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var steps = reduce ? 1 : 6;
    pollTimer = setInterval(function () {
      step++;
      var k = step / steps;
      bar.style.transform = 'scaleX(' + k + ')';
      label.textContent = k < 1
        ? t('search.progress', { n: Math.round(target * k) })
        : t('search.done', { n: target });
      if (step >= steps) {
        clearInterval(pollTimer);
        pollTimer = null;
        loading = false;
        renderResults();
        setTimeout(function () { qs('[data-progress]').hidden = true; }, 800);
      }
    }, reduce ? 0 : 240);
  }

  /* ==========================================================================
     Шторка фильтров на телефоне: тот же узел, а не вторая копия
     ======================================================================== */
  function initSheet() {
    var sheet = qs('.sheet'), host = qs('[data-filters-host]'), body = qs('[data-sheet-body]');
    var node = qs('[data-filters]');
    var open = function () { body.appendChild(node); sheet.setAttribute('data-open', 'true'); };
    var close = function () { host.appendChild(node); sheet.setAttribute('data-open', 'false'); };
    qsa('[data-open-filters]').forEach(function (b) { b.addEventListener('click', open); });
    qsa('[data-close-filters]').forEach(function (b) { b.addEventListener('click', close); });
    qs('.sheet__scrim').addEventListener('click', close);
  }

  /* ==========================================================================
     Старт
     ======================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    App.boot();
    readURL();
    /* Все группы открыты с самого начала: свёрнутый фильтр не читается как
       «есть, но закрыт» — он читается как «такого фильтра здесь нет». Свернуть
       ненужное пользователь может сам, а вот догадаться о скрытом — нет. */
    openGroups = ['stars', 'meal', 'open', 'price', 'resort', 'type', 'line',
                  'beach', 'rating', 'svc', 'water', 'op'];

    form = new App.SearchForm(qs('#search-form'), params, function (p) {
      location.href = 'search.html?' + App.paramsToQuery(p);
    });

    initSheet();
    runSearch();
    App.bindCards(document.body);

    /* раскрытие полной формы поиска */
    var bar = qs('.searchbar');
    qs('[data-expand]').addEventListener('click', function () {
      var open = bar.getAttribute('data-expanded') === 'true';
      bar.setAttribute('data-expanded', String(!open));
      this.textContent = t(open ? 'search.change' : 'search.hide');
    });

    /* делегация по фильтрам и панели управления */
    document.addEventListener('change', function (e) {
      var c = e.target.closest('[data-check]');
      if (c) {
        var key = c.getAttribute('data-check'), v = c.value;
        lastKey = key + ':' + v;
        var arr = F[LIST_OF[key]];
        var val = key === 'stars' ? +v : v;
        var i = arr.indexOf(val);
        if (c.checked && i === -1) arr.push(val);
        if (!c.checked && i !== -1) arr.splice(i, 1);
        page = 1;
        update();
        return;
      }
      var anyBox = e.target.closest('[data-any]');
      if (anyBox) {
        var ak = anyBox.getAttribute('data-any');
        if (ak === 'rating') F.rating = 0; else F[LIST_OF[ak]] = [];
        lastKey = ak + ':any'; page = 1; update(); return;
      }
      var tg = e.target.closest('[data-toggle]');
      if (tg) {
        var tk = tg.getAttribute('data-toggle');
        if (tk === 'direct') F.direct = tg.checked;
        if (tk === 'bonus') F.bonus = tg.checked;
        if (tk === 'excl') F.exclusive = tg.checked;
        lastKey = tk + ':1'; page = 1; update(); return;
      }
      if (e.target.matches('[data-rating]')) {
        F.rating = +e.target.value; lastKey = 'rating:' + e.target.value; page = 1; update(); return;
      }
      if (e.target.matches('[data-flex]')) {
        F.flex = e.target.checked; lastKey = 'flex'; page = 1; buildBase(); update(); return;
      }
    });

    document.addEventListener('input', function (e) {
      if (e.target.matches('[data-resort-filter]')) {
        var v = e.target.value.trim().toLowerCase();
        qsa('[data-resort-list] .checkline').forEach(function (l) {
          l.hidden = v && l.textContent.toLowerCase().indexOf(v) === -1;
        });
      }
    });

    document.addEventListener('click', function (e) {
      var star = e.target.closest('[data-star]');
      if (star) {
        var s = +star.getAttribute('data-star'), i = F.stars.indexOf(s);
        if (i === -1) F.stars.push(s); else F.stars.splice(i, 1);
        lastKey = 'stars:' + s; page = 1; update(); return;
      }
      var only = e.target.closest('[data-only]');
      if (only) {
        e.preventDefault();
        var parts = only.getAttribute('data-only').split(':');
        var ok = parts[0], ov = parts.slice(1).join(':');
        F[LIST_OF[ok]] = [ok === 'stars' ? +ov : ov];
        lastKey = ok + ':' + ov; page = 1; update(); return;
      }
      var cap = e.target.closest('[data-price-cap]');
      if (cap) {
        var capV = +cap.getAttribute('data-price-cap');
        F.priceMin = bounds.min;
        F.priceMax = F.priceMax === capV ? bounds.max : capV;
        page = 1; update(); return;
      }
      var openList = e.target.closest('[data-open-list]');
      if (openList) {
        openLists[openList.getAttribute('data-open-list')] = true;
        renderFilters(); return;
      }
      var per = e.target.closest('[data-per]');
      if (per) { F.perOne = per.getAttribute('data-per') === 'one'; update(); return; }
      var setDate = e.target.closest('[data-set-date]');
      if (setDate) {
        F.date = setDate.getAttribute('data-set-date');
        page = 1; buildBase(); renderHead(); update(); return;
      }
      var drop = e.target.closest('[data-drop]');
      if (drop) { dropFilter(drop.getAttribute('data-drop'), drop.getAttribute('data-val')); return; }
      if (e.target.closest('[data-drop-first]')) {
        var first = qs('[data-chips] .chip-x[data-drop]');
        if (first) dropFilter(first.getAttribute('data-drop'), first.getAttribute('data-val'));
        return;
      }
      if (e.target.closest('[data-reset-all]')) {
        F = emptyFilters(params); page = 1; buildBase(); update(); return;
      }
      if (e.target.closest('[data-widen]')) {
        F.flex = true; page = 1; buildBase(); update(); return;
      }
      var v = e.target.closest('[data-view]');
      if (v) { view = v.getAttribute('data-view'); renderSortbar(); renderResults(); writeURL(true); return; }
      if (e.target.closest('[data-more-btn]')) { page++; renderResults(); return; }
      if (e.target.closest('[data-retry]')) {
        failed = false;
        history.replaceState({}, '', location.pathname + '?' + App.paramsToQuery(params));
        qs('[data-progress]').hidden = false;
        runSearch();
        return;
      }
      var pin = e.target.closest('[data-pin]');
      if (pin) {
        var card = qs('[data-card="' + pin.getAttribute('data-pin') + '"]');
        if (card) { card.scrollIntoView({ block: 'nearest' }); highlight(pin.getAttribute('data-pin')); }
      }
    });

    document.addEventListener('mouseover', function (e) {
      var card = e.target.closest('[data-card]');
      if (card) highlight(card.getAttribute('data-card'));
    });

    document.addEventListener('city:change', function () {
      params.from = App.state.city;
      page = 1;
      qs('[data-progress]').hidden = false;
      qs('[data-progress-bar]').style.transform = 'scaleX(0)';
      runSearch();
    });
    document.addEventListener('currency:change', function () { renderSortbar(); renderResults(); renderFilters(); });
    document.addEventListener('lang:change', function () {
      form.render(); form.refreshValues();
      renderHead(); update();
    });
    window.addEventListener('popstate', function () { readURL(); runSearch(); });
  });

  function highlight(id) {
    qsa('[data-pin]').forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-pin') === id); });
    qsa('[data-card]').forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-card') === id); });
  }

  function dropFilter(key, val) {
    if (LIST_OF[key]) {
      var arr = F[LIST_OF[key]];
      var v = key === 'stars' ? +val : val;
      var i = arr.indexOf(v);
      if (i !== -1) arr.splice(i, 1);
    }
    if (key === 'rating') F.rating = 0;
    if (key === 'direct') F.direct = false;
    if (key === 'bonus') F.bonus = false;
    if (key === 'excl') F.exclusive = false;
    if (key === 'price') { F.priceMin = bounds.min; F.priceMax = bounds.max; }
    page = 1;
    update();
  }
})();
