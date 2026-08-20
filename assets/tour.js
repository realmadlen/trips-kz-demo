/* ==========================================================================
   Страница отеля — то, что открывается по «Подробнее» из выдачи.

   THESIS: карточка выдачи отвечает «сколько», страница отеля — «как он
   выглядит, сколько стоит в другие даты и что говорят те, кто там был».
   Отсюда порядок: галерея с главным об отеле и ценой на первом экране,
   затем таблица «ночей × дат вылета» со списком предложений, затем сам
   отель, отзывы и похожие туры.

   Набор предложений детерминирован: та же пара «город вылета + опорная
   дата», что была в выдаче, даёт тот же список туров. Поэтому в адрес
   страницы кладутся from и anchor — без них id тура не нашёлся бы.

   Цена в таблице и цена в списке под ней — одно и то же число: ячейка
   показывает минимум по тому самому списку, который откроется под ней.
   Разойтись они не могут, потому что считает их одна функция.
   ========================================================================== */
(function () {
  var qs = App.qs, qsa = App.qsa, esc = App.esc, icon = App.icon;
  var t = App.t, nm = App.nm, nmGen = App.nmGen;

  var tour = null, hotel = null, cnt = null, res = null;
  var all = [], mine = [];          /* весь набор и предложения этого отеля */

  var shots = [], shot = 0;         /* галерея и текущий кадр */
  var params = null;                /* условия поиска для полосы наверху */

  /* Таблица: одиннадцать дат вылета и семь длительностей подряд — столько
     помещается в ширину без второго уровня прокрутки на десктопе. */
  var GRID_COLS = 11, GRID_ROWS = 7;
  var gridFrom = '', gridNights = 7;
  var sel = { date: '', nights: 0 };
  var offers = [];
  var filters = { meal: '', airline: '' };
  /* Формы создаются один раз: SearchForm вешает слушатели на document, и
     новый экземпляр на каждую смену языка накапливал бы их. При перерисовке
     форме достаточно перерисовать собственную разметку. */
  var searchForm = null, hotelForm = null;

  /* Номера и отзывы держим под рукой: по клику надо открыть кадры именно той
     карточки, по которой попали, а не пересобирать набор заново. */
  var rooms = [], reviews = [];

  /* Сторис: индекс темы, индекс кадра внутри темы и таймер автоперелистывания */
  var tales = [], tale = { i: 0, f: 0, timer: null };
  var TALE_MS = 4000;

  /* --- Какой тур показываем ----------------------------------------------
     Три ступени подстраховки: точный id, затем любой тур того же отеля,
     затем самый дешёвый в наборе. Пустая страница — худший исход из всех:
     по ссылке из чужой сессии id может не совпасть. */
  function pick() {
    var p = new URLSearchParams(location.search);
    var from = p.get('from');
    if (from && Data.byId(Data.CITIES, from)) App.state.city = from;
    all = Data.build(App.state.city, p.get('anchor') || '');
    window.__tours = all;

    var id = p.get('id') || '';
    var found = all.filter(function (x) { return x.id === id; })[0];
    if (!found) {
      var hid = id.split('-')[0];
      found = all.filter(function (x) { return x.hotelId === hid; })
        .sort(function (a, b) { return a.price - b.price; })[0];
    }
    if (!found) found = all[0];
    tour = found;
    hotel = Data.hotel(tour.hotelId);
    cnt = Data.country(tour.countryId);
    res = Data.resort(tour.countryId, tour.resortId);
    mine = all.filter(function (x) { return x.hotelId === hotel.id; });

    shots = Data.gallery(hotel.id);
    shot = 0;

    /* Таблица открывается на дате выбранного тура: человек пришёл за ней,
       и первая колонка обязана быть той, о которой он думает. */
    sel.date = tour.date;
    sel.nights = tour.nights;
    gridFrom = tour.date;
    gridNights = Math.max(2, tour.nights - 1);
    filters.meal = '';
    filters.airline = '';
    refreshOffers();

    /* Условия поиска для полосы наверху: город и дата — те же, что привели
       сюда, направление — курорт этого отеля. Полоса не ищет заново, она
       называет раздел выдачи, в котором отель был найден. */
    params = App.paramsFromURL();
    params.from = App.state.city;
    params.to = cnt.id + ':' + res.id;
    params.date = tour.date;
    params.nightsMin = tour.nights;
    params.nightsMax = tour.nights + 3;
  }

  /* Ссылка на другой тур сохраняет тот же набор: иначе с новой страницы
     нельзя было бы вернуться к соседним датам того же отеля. */
  function href(id) {
    var p = new URLSearchParams(location.search);
    p.set('id', id);
    return 'tour.html?' + p.toString();
  }

  function lineName() {
    var b = Data.byId(Data.BEACH_LINES, String(hotel.line));
    return b ? nm(b.name) : '';
  }
  /* «1-я линия: 0—200 метров» → «1-я линия»: в узкой ячейке фактов метры
     дублируют соседнюю карточку «до пляжа». */
  function lineShort() { return lineName().replace(/\s*:.*$/, ''); }
  function beachName() { return nm(Data.beachType(hotel.beach).name); }
  function mealName(x) { return nm(Data.meal((x || tour).meal).name); }
  function roomName(x) { return nm(Data.room((x || tour).room).name); }

  /* --- Предложения на дату и длительность ---------------------------------
     К сгенерированному списку добавляются настоящие туры из набора выдачи:
     тот, по которому сюда пришли, обязан остаться в списке под своей ценой —
     иначе страница показала бы не ту цену, что карточка, с которой нажали. */
  function offersFor(dateISO, nightsCount) {
    var list = Data.hotelOffers(hotel.id, App.state.city, dateISO, nightsCount);
    mine.forEach(function (x) {
      if (x.date !== dateISO || x.nights !== nightsCount) return;
      var same = list.filter(function (o) { return o.meal === x.meal && o.room === x.room; })[0];
      if (same) list.splice(list.indexOf(same), 1);
      list.push(x);
    });
    list.sort(function (a, b) { return a.price - b.price; });
    return list;
  }

  function refreshOffers() {
    offers = offersFor(sel.date, sel.nights);
  }
  function visibleOffers() {
    return offers.filter(function (o) {
      if (filters.meal && o.meal !== filters.meal) return false;
      if (filters.airline && o.airline !== filters.airline) return false;
      return true;
    });
  }

  /* --- Хлебные крошки ----------------------------------------------------- */
  function renderCrumbs() {
    var q = App.paramsToQuery(App.defaults());
    qs('[data-crumbs]').innerHTML =
      '<a href="index.html">' + esc(t('search.crumbs.home')) + '</a>' +
      '<a href="search.html?' + q + '&to=' + cnt.id + '">' + esc(nm(cnt.name)) + '</a>' +
      '<a href="search.html?' + q + '&to=' + cnt.id + ':' + res.id + '">' + esc(nm(res.name)) + '</a>' +
      '<span aria-current="page">' + esc(hotel.name) + '</span>';
  }

  /* --- Полоса поиска ------------------------------------------------------ */
  function renderSearchbar() {
    qs('[data-summary]').innerHTML = App.summaryLine(params);
    if (searchForm) { searchForm.p = params; searchForm.render(); }
    else searchForm = new App.SearchForm(qs('#search-form'), params);
  }

  /* --- Галерея ------------------------------------------------------------
     Снимков конкретного отеля в наборе нет и быть не может: отели вымышлены.
     Кадры собирает Data.gallery — своим курортом, соседями по стране и
     нейтральными видами. Счётчик называет ровно столько кадров, сколько их
     в галерее: обещать двадцать четыре и открыть двенадцать нельзя. */
  /* Кадр в шапке — самое крупное изображение первого экрана, и грузиться
     ленивым ему нельзя: именно он определяет момент, когда страница выглядит
     готовой. Миниатюры остаются ленивыми. */
  function frameHTML(name, alt, eager) {
    var html = App.photo(name, alt, nm(res.name) + ', ' + nm(cnt.name));
    return eager ? html.replace('loading="lazy"', 'fetchpriority="high"') : html;
  }

  function renderGallery() {
    var host = qs('[data-tp-gallery]');
    host.innerHTML =
      '<div class="tp-gallery__stage">' +
        '<button class="tp-gallery__main" type="button" data-gal-open ' +
          'aria-label="' + esc(t('tp.galleryOpen')) + '">' + frameHTML(shots[shot], hotel.name, true) + '</button>' +
        (shots.length > 1
          ? '<button class="tp-gallery__nav tp-gallery__nav--prev" type="button" data-shot="-1" ' +
              'aria-label="' + esc(t('tp.galleryPrev')) + '">' + icon('chev-l') + '</button>' +
            '<button class="tp-gallery__nav tp-gallery__nav--next" type="button" data-shot="1" ' +
              'aria-label="' + esc(t('tp.galleryNext')) + '">' + icon('chev-r') + '</button>'
          : '') +
        /* Сердечко там же, где на карточках выдачи, — в правом верхнем углу
           снимка. Ярлык тот же самый, data-fav с номером предложения, поэтому
           отмеченный здесь тур горит красным и в выдаче, и на главной. */
        '<button class="fav tp-gallery__fav" type="button" data-fav="' + esc(tour.id) + '" ' +
          'aria-pressed="' + App.isFav(tour.id) + '" ' +
          'aria-label="' + esc(t(App.isFav(tour.id) ? 'card.favOn' : 'card.fav')) + '">' +
          icon('heart') + '</button>' +
        '<span class="tp-gallery__count">' +
          esc(t('tp.galleryOf', { i: shot + 1, n: shots.length })) + '</span>' +
        '<button class="tp-gallery__zoom" type="button" data-gal-open>' +
          icon('expand') + '<span>' + esc(t('card.photos', { n: shots.length })) + '</span></button>' +
      '</div>' +
      '<div class="tp-thumbs" role="tablist" aria-label="' + esc(t('tp.galleryOpen')) + '">' +
        shots.map(function (name, i) {
          return '<button class="tp-thumb" type="button" role="tab" data-thumb="' + i + '" ' +
            'aria-selected="' + (i === shot) + '" tabindex="' + (i === shot ? 0 : -1) + '">' +
            App.photo(Data.cover(name), '', '') + '</button>';
        }).join('') +
      '</div>';
  }

  function setShot(i) {
    if (!shots.length) return;
    shot = (i + shots.length) % shots.length;
    renderGallery();
    var active = qs('.tp-thumb[aria-selected="true"]');
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  /* Просмотр во весь экран. Отдельное окно, а не общий App.modal: тот рассчитан
     на форму шириной 560px, а здесь кадр обязан занять экран целиком.

     Окно одно на всю страницу и не знает, чьи кадры показывает: галереи
     отеля, категории номера или снимков под отзывом. Иначе к третьему месту,
     откуда «открыть кадр покрупнее», в файле лежали бы три почти одинаковых
     окна с тремя наборами клавиш. */
  var view = { list: [], i: 0, title: '', sync: false };

  function openLightbox(list, start, title, sync) {
    if (!list || !list.length) return;
    view = {
      list: list,
      i: Math.max(0, Math.min(list.length - 1, start || 0)),
      title: title || '',
      /* sync — признак «это кадры шапки»: закрывая окно, страница обязана
         остаться на том кадре, до которого долистали внутри. */
      sync: !!sync
    };
    var host = document.createElement('div');
    host.className = 'gal';
    host.setAttribute('data-gal', '');
    document.body.appendChild(host);
    document.body.style.overflow = 'hidden';
    drawGallery();

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-gal-close]')) { closeGallery(); return; }
      var step = e.target.closest('[data-gal-step]');
      if (step) { stepLightbox(+step.getAttribute('data-gal-step')); return; }
      var th = e.target.closest('[data-gal-thumb]');
      if (th) { view.i = +th.getAttribute('data-gal-thumb'); drawGallery(); }
    });
    document.addEventListener('keydown', galKeys);
  }

  function stepLightbox(d) {
    view.i = (view.i + d + view.list.length) % view.list.length;
    drawGallery();
  }

  function openGallery() { openLightbox(shots, shot, hotel.name, true); }

  function galKeys(e) {
    if (!qs('[data-gal]')) return;
    if (e.key === 'Escape') closeGallery();
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  }

  function closeGallery() {
    var host = qs('[data-gal]');
    if (host) host.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', galKeys);
    if (view.sync) setShot(view.i);
    view = { list: [], i: 0, title: '', sync: false };
  }

  function drawGallery() {
    var host = qs('[data-gal]');
    if (!host) return;
    host.innerHTML =
      '<div class="gal__scrim" data-gal-close></div>' +
      '<div class="gal__body" role="dialog" aria-modal="true" aria-label="' + esc(view.title) + '">' +
        '<div class="gal__bar">' +
          '<span class="gal__title">' + esc(view.title) + '</span>' +
          '<span class="gal__count">' + esc(t('tp.galleryOf', { i: view.i + 1, n: view.list.length })) + '</span>' +
          '<button class="btn-icon gal__x" type="button" data-gal-close ' +
            'aria-label="' + esc(t('modal.close')) + '">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="gal__stage">' +
          (view.list.length > 1
            ? '<button class="gal__nav" type="button" data-gal-step="-1" ' +
                'aria-label="' + esc(t('tp.galleryPrev')) + '">' + icon('chev-l') + '</button>'
            : '') +
          '<figure class="gal__frame">' + frameHTML(view.list[view.i], view.title, true) + '</figure>' +
          (view.list.length > 1
            ? '<button class="gal__nav" type="button" data-gal-step="1" ' +
                'aria-label="' + esc(t('tp.galleryNext')) + '">' + icon('chev-r') + '</button>'
            : '') +
        '</div>' +
        '<div class="gal__thumbs">' + view.list.map(function (name, i) {
          return '<button class="gal__thumb" type="button" data-gal-thumb="' + i + '" ' +
            'aria-selected="' + (i === view.i) + '">' + App.photo(Data.cover(name), '', '') + '</button>';
        }).join('') + '</div>' +
      '</div>';
  }

  /* --- Сторис -------------------------------------------------------------
     Круглая лента под галереей. Каждая тема появляется только если она у отеля
     есть: аквапарк — где он есть в наборе, спа — где есть спа, пляж — где
     вообще есть море. Кадры сняты под тему, поэтому подпись под кружком
     говорит о снимке правду. */
  function renderStories() {
    tales = Data.stories(hotel.id);
    var host = qs('[data-tp-stories]');
    if (!tales.length) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = tales.map(function (x, i) {
      return '<button class="tp-story" type="button" data-tale="' + i + '" ' +
        'aria-label="' + esc(t('tp.storyOpen', { name: nm(x.name) })) + '">' +
        '<span class="tp-story__ring">' + App.photo(x.cover, '', '') + '</span>' +
        '<span class="tp-story__name">' + esc(nm(x.name)) + '</span>' +
      '</button>';
    }).join('');
  }

  /* Оболочка просмотра строится один раз, дальше меняются только снимок,
     заголовок и полоски. Перерисовывать разметку целиком на каждом кадре
     нельзя: браузер каждый раз создавал новый <img>, заново тянул файл и
     показывал чёрный прямоугольник между кадрами. */
  function openTale(i) {
    tale.i = i; tale.f = 0;
    var first = tales[i];
    var host = document.createElement('div');
    host.className = 'st';
    host.setAttribute('data-st', '');
    host.innerHTML =
      '<div class="st__scrim" data-st-close></div>' +
      '<div class="st__box" role="dialog" aria-modal="true" aria-label="' + esc(hotel.name) + '">' +
        '<figure class="st__frame">' +
          /* Первый кадр стоит прямо в разметке: <img> без src — это пустая
             рамка, пусть и на один тик до showTale. eager, а не lazy: этот
             кадр и есть то, ради чего окно открыли. */
          '<img src="assets/img/' + esc(first.shots[0]) + '.webp" ' +
            'alt="' + esc(nm(first.name)) + '" ' +
            'decoding="async" fetchpriority="high" data-st-img>' +
        '</figure>' +
        '<div class="st__bars" data-st-bars></div>' +
        '<div class="st__top">' +
          '<span class="st__who"><b data-st-name></b><span>' + esc(hotel.name) + '</span></span>' +
          '<button class="btn-icon st__x" type="button" data-st-close ' +
            'aria-label="' + esc(t('modal.close')) + '">' + icon('close') + '</button>' +
        '</div>' +
        '<button class="st__tap st__tap--prev" type="button" data-st-step="-1" ' +
          'aria-label="' + esc(t('tp.galleryPrev')) + '"></button>' +
        '<button class="st__tap st__tap--next" type="button" data-st-step="1" ' +
          'aria-label="' + esc(t('tp.galleryNext')) + '"></button>' +
      '</div>';
    document.body.appendChild(host);
    document.body.style.overflow = 'hidden';
    showTale();

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-st-close]')) { closeTale(); return; }
      var step = e.target.closest('[data-st-step]');
      if (step) stepTale(+step.getAttribute('data-st-step'));
    });
    document.addEventListener('keydown', taleKeys);
  }

  function taleKeys(e) {
    if (!qs('[data-st]')) return;
    if (e.key === 'Escape') closeTale();
    if (e.key === 'ArrowLeft') stepTale(-1);
    if (e.key === 'ArrowRight') stepTale(1);
  }

  function closeTale() {
    clearTimeout(tale.timer);
    var host = qs('[data-st]');
    if (host) host.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', taleKeys);
  }

  /* Шаг вперёд с последнего кадра темы переходит к следующей теме, а с
     последнего кадра последней темы закрывает просмотр: лента должна
     кончаться, а не крутиться по кругу. */
  function stepTale(dir) {
    var f = tale.f + dir;
    if (f < 0) {
      if (tale.i === 0) { tale.f = 0; showTale(); return; }
      tale.i--; tale.f = tales[tale.i].shots.length - 1;
    } else if (f >= tales[tale.i].shots.length) {
      if (tale.i === tales.length - 1) { closeTale(); return; }
      tale.i++; tale.f = 0;
    } else {
      tale.f = f;
    }
    showTale();
  }

  function showTale() {
    var host = qs('[data-st]');
    if (!host) return;
    var cur = tales[tale.i];
    clearTimeout(tale.timer);

    qs('[data-st-name]', host).textContent = nm(cur.name);
    /* Полоски пересобираются целиком: так CSS-анимация текущей полоски
       начинается заново, а не продолжает предыдущий отсчёт. */
    qs('[data-st-bars]', host).innerHTML = cur.shots.map(function (x, k) {
      return '<span class="st__bar" data-state="' +
        (k < tale.f ? 'done' : (k === tale.f ? 'run' : 'wait')) + '"><i></i></span>';
    }).join('');

    var img = qs('[data-st-img]', host);
    img.src = 'assets/img/' + cur.shots[tale.f] + '.webp';
    img.alt = nm(cur.name);

    /* Следующий кадр подгружается заранее — иначе на переходе видно пустоту */
    var nextShot = cur.shots[tale.f + 1] ||
      (tales[tale.i + 1] && tales[tale.i + 1].shots[0]);
    if (nextShot) { new Image().src = 'assets/img/' + nextShot + '.webp'; }

    tale.timer = setTimeout(function () { stepTale(1); }, TALE_MS);
  }

  /* --- Главное об отеле: то, что спрашивают до цены ------------------------ */
  function renderInfo() {
    document.title = hotel.name + ' — ' + nm(res.name) + ', ' + nm(cnt.name) + ' — trips.kz';

    var facts = [
      ['water', hotel.dist + ' ' + t('unit.m'), t('tp.toSea')],
      ['beach', lineShort(), t('tp.factLine')],
      ['sun', beachName(), t('flt.beachType')],
      ['plane', hotel.air + ' ' + t('unit.km'), t('tp.toAir')],
      ['home', String(hotel.opened), t('tp.built')],
      /* Тип отдыха — только первый: полный список стоит тегами в «Об отеле»,
         а три слова через запятую растягивали карточку факта на три строки
         и ломали ровную линию ряда. */
      ['mark', nm(Data.hotelType(hotel.types[0]).name), t('tp.factType')]
    ];

    var about = t('tp.aboutMain', {
      stars: hotel.s, resort: nm(res.name), dist: hotel.dist,
      line: lineName().toLowerCase(), beach: beachName().toLowerCase(),
      air: hotel.air, opened: hotel.opened
    });

    qs('[data-tp-info]').innerHTML =
      '<div class="tp-info__top">' +
        '<a class="tp-info__rate" href="#tp-reviews">' +
          '<span class="rate-value">' + Fmt.ratingNum(hotel.rate) + '</span>' +
          '<span><b>' + esc(Fmt.rating(hotel.rate)) + '</b>' +
            '<span>' + esc(t('tp.seeReviews', { n: hotel.rev })) + '</span></span>' +
        '</a>' +
        (tour.seats ? '<span class="badge-plain">' +
          (tour.seats === 1 ? esc(t('card.seats1')) : esc(t('card.seats', { n: tour.seats }))) + '</span>' : '') +
      '</div>' +

      '<div class="tp-info__cat">' + App.starsHTML(hotel.s) +
        (hotel.renov ? '<span class="t-body-s">' + esc(t('tp.renovYear', { y: hotel.renov })) + '</span>' : '') +
      '</div>' +

      '<h1 class="t-h3 tp-info__name" itemprop="name">' + esc(hotel.name) + '</h1>' +

      '<div class="tp-info__place">' + icon('pin') +
        '<span>' + esc(nm(cnt.name)) + ', ' + esc(nm(res.name)) + '</span>' +
        '<a class="link-blue" href="#tp-map">' + esc(t('tp.hotelOnMap')) + '</a></div>' +

      '<p class="tp-info__text">' + esc(about) + '</p>' +
      /* Раньше это была ссылка-якорь на раздел «Об отеле» ниже: нажатие
         уносило страницу вниз, человек терял место и возвращался скроллом.
         Текст короткий, разворачивать его есть смысл прямо здесь. */
      '<button class="link-btn" type="button" data-about-more aria-expanded="false">' +
        esc(t('card.more')) + '</button>' +

      '<div class="tp-info__facts">' + facts.map(function (x) {
        return '<div class="tp-fact">' +
          '<span class="tp-fact__icon">' + icon(x[0]) + '</span>' +
          '<b class="tp-fact__value">' + esc(x[1]) + '</b>' +
          '<span class="tp-fact__label">' + esc(x[2]) + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* --- Цена: колонка справа на десктопе и полоса снизу на телефоне -------- */
  function priceCard() {
    var perMonth = Math.round(tour.price / 12 / 1000) * 1000;
    /* «от» здесь не пишется: в карточке стоит цена выбранного предложения —
       того самого, по которому сюда пришли из выдачи. Минимум по датам живёт
       в таблице ниже, и обещать его в шапке значило бы подменить число. */
    return '<div class="tp-price__row">' +
        '<span class="t-price">' + Fmt.money(tour.price) + '</span>' +
        (tour.discount ? '<span class="badge-plain">−' + tour.discount + '%</span>' : '') +
      '</div>' +
      '<div class="tp-price__per">' +
        (tour.oldPrice ? '<s class="t-price--old">' + Fmt.money(tour.oldPrice) + '</s> · ' : '') +
        esc(t('card.perTwo')) + '</div>' +
      '<ul class="tp-price__facts">' +
        '<li>' + icon('calendar') + '<span>' + Fmt.range(tour.date, tour.nights) + ' · ' + Fmt.nights(tour.nights) + '</span></li>' +
        '<li>' + icon('meal') + '<span>' + esc(mealName()) + '</span></li>' +
        '<li>' + icon('bed') + '<span>' + esc(roomName()) + '</span></li>' +
        '<li>' + icon('users') + '<span>' + esc(App.guestsLabel(params || App.defaults())) + '</span></li>' +
      '</ul>' +
      '<button class="btn btn--blue btn--lg btn--block" type="button" data-buy>' + esc(t('card.buy')) + '</button>' +
      '<a class="btn btn--ghost btn--block" href="#tp-tours">' + icon('calendar') +
        '<span>' + esc(t('tp.toTours')) + '</span></a>' +
      '<p class="tp-price__note">' + esc(t('card.installment', { sum: Fmt.money(perMonth) })) + '</p>' +
      '<div class="tp-price__acts">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-fav="' + tour.id + '" ' +
          'aria-pressed="' + App.isFav(tour.id) + '">' + icon('heart') +
          '<span>' + esc(t('card.fav')) + '</span></button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-demo>' + icon('arrow-ur') +
          '<span>' + esc(t('tp.share')) + '</span></button>' +
      '</div>' +
      '<ul class="tp-price__marks">' +
        (tour.instant ? '<li>' + icon('check') + esc(t('card.instant')) + '</li>' : '') +
        '<li>' + icon('doc') + esc(t('card.operator')) + ': ' + esc(Data.operator(tour.operatorId).name) + '</li>' +
      '</ul>';
  }

  function renderPrice() {
    qs('[data-tp-price]').innerHTML = priceCard();
  }

  /* --- Таблица «ночей × дат вылета» ---------------------------------------
     Цена отеля меняется от даты сильнее, чем от чего-либо ещё, и одной
     строкой этого не показать. В ячейке — минимум по списку предложений
     того дня; список открывается под таблицей по нажатию на ячейку. */
  function renderToursHead() {
    qs('[data-tp-tours-title]').textContent =
      t('tp.toursIn', { name: hotel.name + ' ' + hotel.s + '★' });
  }

  function renderGrid() {
    var rows = [], min = Infinity;
    for (var r = 0; r < GRID_ROWS; r++) {
      var n = gridNights + r;
      var cells = [];
      for (var c = 0; c < GRID_COLS; c++) {
        var iso = Fmt.toISO(Fmt.addDays(Fmt.parseISO(gridFrom), c));
        var list = offersFor(iso, n);
        var price = list.length ? list[0].price : 0;
        if (price && price < min) min = price;
        cells.push({ date: iso, nights: n, price: price });
      }
      rows.push({ nights: n, cells: cells });
    }

    var head = '<tr><th class="tp-grid__corner">' + esc(t('f.nights')) + '</th>' +
      rows[0].cells.map(function (c) {
        var d = Fmt.parseISO(c.date);
        return '<th' + (c.date === sel.date ? ' data-on="true"' : '') + '>' +
          '<b>' + d.getDate() + ' ' + esc(Fmt.weekday(c.date)) + '</b>' +
          '<span>' + esc(Fmt.monthNom(d.getMonth())) + '</span></th>';
      }).join('') + '</tr>';

    /* Отмечается ровно одна ячейка на строку и ровно одна на таблицу. У
       дешёвых направлений цена упирается в нижнюю границу коридора, и
       десяток одинаковых сумм подряд закрасился бы лаймом целиком — правило
       одного кислотного пятна на экран держится этой парой флагов. */
    var allMarked = false;
    var body = rows.map(function (row) {
      var prices = row.cells.map(function (c) { return c.price || Infinity; });
      var rowMin = Math.min.apply(null, prices);
      var flat = Math.max.apply(null, prices) === rowMin;   /* вся строка по одной цене */
      var rowMarked = false;
      return '<tr><th' + (row.nights === sel.nights ? ' data-on="true"' : '') + '>' + row.nights + '</th>' +
        row.cells.map(function (c) {
          var mark = '';
          if (!allMarked && c.price === min) { mark = 'all'; allMarked = true; }
          else if (!rowMarked && !flat && c.price === rowMin) { mark = 'row'; rowMarked = true; }
          var on = c.date === sel.date && c.nights === sel.nights;
          return '<td><button class="tp-cell" type="button" ' +
            'data-cell="' + c.date + '|' + c.nights + '" data-min="' + mark + '" ' +
            'aria-pressed="' + on + '" ' +
            'aria-label="' + esc(t('tp.gridPick', { date: Fmt.dayMonthFull(c.date), n: Fmt.nights(c.nights) })) + '">' +
            Fmt.money(c.price) + '</button></td>';
        }).join('') + '</tr>';
    }).join('');

    qs('[data-tp-grid]').innerHTML =
      '<div class="tp-grid">' +
        '<div class="tp-grid__head">' +
          '<p class="t-body-s tp-grid__hint">' + esc(t('tp.gridHint')) + '</p>' +
          '<div class="tp-grid__nav">' +
            '<button class="btn-icon" type="button" data-grid="-7" ' +
              'aria-label="' + esc(t('tp.gridPrev')) + '">' + icon('chev-l') + '</button>' +
            '<button class="btn-icon" type="button" data-grid="7" ' +
              'aria-label="' + esc(t('tp.gridNext')) + '">' + icon('chev-r') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="tp-grid__scroll">' +
          '<table class="tp-grid__table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' +
        '</div>' +
      '</div>';
  }

  /* --- Список предложений выбранной ячейки --------------------------------
     Строка читается слева направо одним движением: сначала метки, потом пять
     фактов через разделители, потом за вертикальной линейкой — деньги и два
     действия. Цена и кнопки прижаты влево внутри своей зоны, а не к правому
     краю: рваная правая колонка не выстраивалась в столбец и выглядела
     случайным набором элементов. */
  function offerRow(o) {
    var on = o.id === tour.id;
    var fav = App.isFav(o.id);
    return '<article class="tp-offer" data-offer="' + esc(o.id) + '" data-on="' + on + '">' +
      '<div class="tp-offer__marks">' +
        App.badges(o) +
        (o.instant ? '<span class="tag tag--outline">' + icon('check') + esc(t('card.instant')) + '</span>' : '') +
        (o.seats ? '<span class="tag">' + esc(App.seatsLabel(o.seats)) + '</span>' : '') +
        (on ? '<span class="tag tag--dark">' + esc(t('tp.selected')) + '</span>' : '') +
      '</div>' +
      '<div class="tp-offer__facts">' +
        '<div><span>' + esc(t('f.dates')) + '</span><b>' + Fmt.range(o.date, o.nights) + '</b></div>' +
        '<div><span>' + esc(t('tp.offerDays')) + '</span><b>' + esc(Fmt.nights(o.nights)) + '</b></div>' +
        '<div><span>' + esc(t('flt.meal')) + '</span><b>' + esc(nm(Data.meal(o.meal).name)) + '</b></div>' +
        '<div><span>' + esc(t('tp.offerRoom')) + '</span><b>' + esc(nm(Data.room(o.room).name)) + '</b></div>' +
        '<div><span>' + esc(t('tp.offerFlight')) + '</span><b>' + esc(o.airline) + '</b>' +
          '<small>' + esc(t(o.direct ? 'card.direct' : 'tp.stop')) + '</small></div>' +
      '</div>' +
      '<div class="tp-offer__buy">' +
        '<div class="tp-offer__sum">' +
          '<span class="t-price">' + Fmt.money(o.price) + '</span>' +
          (o.oldPrice ? '<s class="t-price--old">' + Fmt.money(o.oldPrice) + '</s>' : '') +
          /* Короткая подпись: перевозчик назван соседней колонкой, и «перелёт
             включён» восемь раз подряд — не забота, а шум. Полная формулировка
             осталась в карточке цены наверху. */
          '<span class="tp-offer__per">' + esc(t('card.perTwoShort')) + '</span>' +
        '</div>' +
        '<div class="tp-offer__acts">' +
          /* Сердце — иконкой без подписи: подпись пришлось бы менять на всех
             языках и в двух состояниях, а знак понятен без слов. */
          '<button class="btn-icon tp-offer__fav" type="button" data-fav="' + esc(o.id) + '" ' +
            'aria-pressed="' + fav + '" ' +
            'aria-label="' + esc(t(fav ? 'card.favOn' : 'card.fav')) + '" ' +
            'title="' + esc(t(fav ? 'card.favOn' : 'card.fav')) + '">' + icon('heart') + '</button>' +
          '<button class="btn ' + (on ? 'btn--ghost' : 'btn--blue') + '" type="button" data-pick="' + esc(o.id) + '">' +
            esc(t(on ? 'tp.selected' : 'card.choose')) + '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderOffers() {
    var list = visibleOffers();
    var meals = [], airs = [];
    offers.forEach(function (o) {
      if (meals.indexOf(o.meal) === -1) meals.push(o.meal);
      if (airs.indexOf(o.airline) === -1) airs.push(o.airline);
    });

    qs('[data-tp-offers]').innerHTML =
      '<div class="tp-offers__head">' +
        '<h3 class="t-h6">' + esc(t('tp.offersFor', {
          dates: Fmt.range(sel.date, sel.nights) + ' · ' + Fmt.nights(sel.nights)
        })) + '</h3>' +
        '<span class="t-meta">' + esc(t('tp.offersCount', { n: list.length })) + '</span>' +
      '</div>' +
      '<div class="tp-offers__filters">' +
        '<label class="tp-filter"><span>' + esc(t('flt.meal')) + '</span>' +
          '<select class="select" data-filter="meal">' +
            '<option value="">' + esc(t('tp.filterAny')) + '</option>' +
            meals.map(function (m) {
              return '<option value="' + m + '"' + (filters.meal === m ? ' selected' : '') + '>' +
                esc(nm(Data.meal(m).name)) + '</option>';
            }).join('') +
          '</select></label>' +
        '<label class="tp-filter"><span>' + esc(t('tp.filterAir')) + '</span>' +
          '<select class="select" data-filter="airline">' +
            '<option value="">' + esc(t('tp.filterAnyAir')) + '</option>' +
            airs.map(function (a) {
              return '<option value="' + esc(a) + '"' + (filters.airline === a ? ' selected' : '') + '>' + esc(a) + '</option>';
            }).join('') +
          '</select></label>' +
      '</div>' +
      (list.length
        ? '<div class="tp-offers__list">' + list.map(offerRow).join('') + '</div>'
        : '<p class="tp-offers__empty t-body-s">' + esc(t('tp.offersNone')) + '</p>');
  }

  /* --- Что входит в цену и что оплачивается отдельно ---------------------- */
  function renderIncluded() {
    var inc = [
      ['plane', t('tp.incFlight', { city: nmGen(Data.city(App.state.city)) })],
      ['bed', t('tp.incStay', { n: Fmt.nights(tour.nights), room: roomName() })],
      ['meal', t('tp.incMeal', { meal: mealName() })],
      ['map', t('tp.incTransfer')],
      ['shield', t('tp.incIns')]
    ];
    var ex = [t('tp.exVisa'), t('tp.exFee'), t('tp.exEarly'), t('tp.exExtra')];
    qs('[data-tp-included]').innerHTML =
      '<ul class="tp-inc">' + inc.map(function (x) {
        return '<li>' + icon(x[0]) + '<span>' + esc(x[1]) + '</span></li>';
      }).join('') + '</ul>' +
      '<div class="tp-ex">' +
        '<h3 class="t-h6">' + esc(t('tp.notIncluded')) + '</h3>' +
        '<ul>' + ex.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '</div>';
  }

  /* --- Перелёт: две строки, туда и обратно -------------------------------- */
  function renderFlight() {
    var back = Fmt.addDays(Fmt.parseISO(tour.date), tour.nights);
    var city = Data.city(App.state.city);
    var timeName = t('tp.time.' + tour.departTime);
    function leg(title, dateISO, a, b) {
      return '<div class="tp-leg">' +
        '<span class="tp-leg__title">' + esc(title) + '</span>' +
        '<span class="tp-leg__date">' + esc(Fmt.dayMonthFull(dateISO)) + ', ' + esc(Fmt.weekday(dateISO)) + '</span>' +
        '<span class="tp-leg__route">' + esc(nm(a)) + ' → ' + esc(nm(b)) + '</span>' +
        '<span class="tp-leg__when">' + esc(timeName) + '</span>' +
      '</div>';
    }
    qs('[data-tp-flight]').innerHTML =
      '<div class="tp-legs">' +
        leg(t('tp.there'), tour.date, city.name, res.name) +
        leg(t('tp.back'), Fmt.toISO(back), res.name, city.name) +
      '</div>' +
      '<ul class="tp-marks">' +
        '<li>' + icon('plane') + esc(tour.airline) + '</li>' +
        '<li>' + icon(tour.direct ? 'check' : 'mark') + esc(t(tour.direct ? 'card.direct' : 'tp.stop')) + '</li>' +
        '<li>' + icon(tour.baggage ? 'check' : 'mark') + esc(t(tour.baggage ? 'tp.baggage' : 'tp.noBaggage')) + '</li>' +
      '</ul>' +
      '<p class="t-meta">' + esc(t('tp.flightNote')) + '</p>';
  }

  /* --- Об отеле ------------------------------------------------------------
     Раньше это был один абзац, собранный из четырёх полей. Разделов теперь
     пять, и каждый отвечает на отдельный вопрос: где стоит, что на территории,
     какой пляж, чем кормят, кому подойдёт. Ни одна фраза не выходит за
     пределы набора: где у страны нет моря, абзацы про воду не появляются. */
  function aboutSections() {
    var out = [];
    /* Дорога от аэропорта: до полутора часов считаем минутами, дальше часами —
       «около 145 минут» читается как ошибка, а не как оценка времени. */
    var mins = Math.max(15, Math.round(hotel.air / 55 * 60));
    var road = mins <= 90
      ? t('tp.txtWhereMin', { n: Math.round(mins / 5) * 5 })
      : t('tp.txtWhereHour', { n: (Math.round(mins / 30) / 2).toFixed(1).replace('.', ',') });

    /* Расположение */
    var where = t('tp.txtWhere', {
      resort: nm(res.name), country: nm(cnt.name), air: hotel.air
    }) + ' ' + road;
    if (cnt.water) {
      where += ' ' + t('tp.txtWhereSea', { dist: hotel.dist, line: lineName().toLowerCase() });
    }
    out.push([t('tp.aboutWhere'), where]);

    /* Территория и номера */
    var site = t('tp.txtSite', {
      land: String(hotel.land).replace('.', ','),
      floors: hotel.floors, rooms: hotel.roomsN
    });
    if (hotel.water.length) {
      site += ' ' + t('tp.txtSiteWater', {
        list: hotel.water.map(function (id) { return nm(Data.service(id).name).toLowerCase(); }).join(', ')
      });
    }
    if (hotel.renov) site += ' ' + t('tp.aboutRenov', { y: hotel.renov });
    out.push([t('tp.aboutSite'), site]);

    /* Пляж — только там, где есть море */
    if (cnt.water) {
      var beach = t('tp.txtBeach', { beach: beachName().toLowerCase(), line: lineName().toLowerCase() });
      beach += ' ' + t('tp.txtBeachSea', { n: cnt.water });
      out.push([t('tp.aboutBeach'), beach]);
    }

    /* Питание: не выдуманное описание ресторанов, а то, что реально стоит в
       списке предложений выше — от простого варианта к полному. */
    var order = Data.MEALS.map(function (m) { return m.id; });
    var seen = [];
    offers.forEach(function (o) { if (seen.indexOf(o.meal) === -1) seen.push(o.meal); });
    seen.sort(function (a, b) { return order.indexOf(b) - order.indexOf(a); });
    if (seen.length > 1) {
      out.push([t('tp.aboutFood'), t('tp.txtFood', {
        min: nm(Data.meal(seen[0]).name), max: nm(Data.meal(seen[seen.length - 1]).name)
      })]);
    } else if (seen.length === 1) {
      out.push([t('tp.aboutFood'), t('tp.txtFoodOne', { meal: nm(Data.meal(seen[0]).name) })]);
    }

    /* Кому подойдёт */
    var who = '';
    if (hotel.svc.indexOf('adults') !== -1) {
      who = t('tp.txtAdults');
    } else if (hotel.svc.indexOf('kids') !== -1) {
      /* Перечисляем только то, что добавляет к «принимает с детьми» смысл:
         горки и аквапарк. Сама услуга «отдых с детьми» в списке дала бы
         «принимает семьи с детьми: отдых с детьми». */
      var kidsList = hotel.water.filter(function (id) {
        return id === 'aquapark' || id === 'slides';
      }).map(function (id) { return nm(Data.service(id).name).toLowerCase(); });
      who = kidsList.length
        ? t('tp.txtKidsWater', { list: kidsList.join(', ') })
        : t('tp.txtKids');
    }
    if (hotel.svc.indexOf('couples') !== -1) {
      who = (who ? who + ' ' : '') + t('tp.txtCouples');
    }
    if (who) out.push([t('tp.aboutKids'), who]);

    return out;
  }

  function aboutFacts() {
    var f = [
      [t('tp.f.checkin'), t('tp.f.checkinVal')],
      [t('tp.f.checkout'), t('tp.f.checkoutVal')],
      [t('tp.built'), String(hotel.opened)],
      [t('tp.f.rooms'), String(hotel.roomsN)],
      [t('tp.f.floors'), String(hotel.floors)],
      [t('tp.f.land'), t('tp.f.landVal', { n: String(hotel.land).replace('.', ',') })],
      [t('tp.f.langs'), hotel.langs.map(function (l) { return t('tp.lang.' + l); }).join(', ')]
    ];
    if (hotel.renov) f.splice(3, 0, [t('tp.f.renov'), String(hotel.renov)]);
    return f;
  }

  function renderAbout() {
    qs('[data-tp-about]').innerHTML =
      aboutSections().map(function (x) {
        return '<section class="tp-about__part">' +
          '<h3 class="t-h6">' + esc(x[0]) + '</h3>' +
          '<p class="t-long">' + esc(x[1]) + '</p>' +
        '</section>';
      }).join('') +
      '<div class="tp-types">' + hotel.types.map(function (id) {
        return '<span class="tag">' + esc(nm(Data.hotelType(id).name)) + '</span>';
      }).join('') + '</div>' +
      '<div class="tp-figures">' +
        '<h3 class="t-h6">' + esc(t('tp.aboutShort')) + '</h3>' +
        '<dl>' + aboutFacts().map(function (x) {
          return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>';
        }).join('') + '</dl>' +
      '</div>';
  }

  /* --- Услуги: две группы, отель и вода ----------------------------------- */
  function renderServices() {
    function group(title, ids) {
      if (!ids.length) return '';
      return '<div class="tp-svc__group">' +
        '<h4 class="t-h6">' + esc(title) + '</h4>' +
        '<ul class="tp-svc__list">' + ids.map(function (id) {
          var s = Data.service(id);
          return '<li>' + icon(s.icon) + '<span>' + esc(nm(s.name)) + '</span></li>';
        }).join('') + '</ul>' +
      '</div>';
    }
    qs('[data-tp-services]').innerHTML =
      group(t('flt.amenities'), hotel.svc) +
      group(t('flt.waterFun'), hotel.water);
  }

  /* --- Номера --------------------------------------------------------------
     Категории те же, что в списке предложений: в таблице выше выбирают номер,
     и раздел обязан объяснить, чем они отличаются. */
  function renderRooms() {
    rooms = Data.hotelRooms(hotel.id);
    qs('[data-tp-rooms]').innerHTML = rooms.map(function (r, i) {
      var name = nm(Data.room(r.id).name);
      /* Снимок — кнопка: по нему открывается тот же просмотрщик, что и у
         галереи отеля, только с кадрами этой категории. Стрелка в углу
         говорит, что за карточкой что-то есть, — на телефоне, где карточки
         листаются вбок, без неё это неочевидно. */
      return '<article class="tp-room">' +
        '<button class="tp-room__media" type="button" data-room="' + i + '" ' +
          'aria-label="' + esc(t('tp.roomOpen', { name: name })) + '">' +
          App.photo(r.img, name, '') +
          '<span class="tp-room__count">' + esc(t('card.photos', { n: r.shots.length })) + '</span>' +
          '<span class="tp-room__more" aria-hidden="true">' + icon('chev-r') + '</span>' +
        '</button>' +
        '<h4 class="t-h6">' + esc(name) + '</h4>' +
        '<div class="tp-room__meta">' +
          '<span>' + esc(t('tp.roomArea', { n: r.area })) + '</span>' +
          '<span>' + esc(t('tp.roomCap', { n: r.cap })) + '</span>' +
        '</div>' +
        '<ul class="tp-room__feats">' + r.feats.map(function (f) {
          return '<li>' + icon('check') + '<span>' + esc(t('tp.rf.' + f)) + '</span></li>';
        }).join('') + '</ul>' +
      '</article>';
    }).join('');
  }

  /* --- Расположение: то же демо-полотно, что в выдаче --------------------- */
  function renderMap() {
    qs('[data-tp-map]').innerHTML =
      '<span class="map-note">' + esc(nm(res.name)) + ', ' + esc(nm(cnt.name)) + '</span>' +
      '<button class="pin" type="button" data-demo style="left:' + (tour.mapX * 100) + '%;top:' + (tour.mapY * 100) + '%">' +
        esc(hotel.name) + '</button>';
    qs('[data-tp-dist]').innerHTML =
      '<li>' + icon('water') + esc(t('card.toBeach', { n: hotel.dist })) + '</li>' +
      '<li>' + icon('plane') + esc(t('card.toAirport', { n: hotel.air })) + '</li>' +
      /* Температура воды показывается только там, где есть море: у Борового
         и Сарыагаша в наборе стоит ноль, и строка «около 0°» была бы ложью. */
      (cnt.water ? '<li>' + icon('sun') + esc(t('tp.water', { n: cnt.water })) + '</li>' : '') +
      '<li>' + icon('mark') + esc(t(cnt.visaFree ? 'dest.visaFree' : 'dest.visa')) + '</li>';
  }

  /* --- Оценка и отзывы ----------------------------------------------------
     Разбивка по критериям считается от общей оценки отеля, тексты собраны из
     полей этого же отеля — см. Data.hotelReviews. Ни одна фраза не говорит
     о том, чего в наборе нет. */
  function renderRate() {
    var keys = ['clean', 'meal', 'staff', 'beach', 'value'];
    var base = hotel.rate;
    var out = keys.map(function (k, i) {
      /* Разброс детерминирован: у одного отеля критерии не пляшут при
         каждой перерисовке, но и не выглядят одинаковой полосой. */
      var v = Math.max(5, Math.min(10, base + [0.3, -0.2, 0.4, -0.3, -0.1][i]));
      return '<li>' +
        '<span class="tp-rate__name">' + esc(t('tp.rate.' + k)) + '</span>' +
        '<span class="tp-rate__bar"><i style="width:' + (v * 10) + '%"></i></span>' +
        '<b class="tp-rate__num">' + Fmt.ratingNum(Math.round(v * 10) / 10) + '</b>' +
      '</li>';
    }).join('');
    qs('[data-tp-rate]').innerHTML =
      '<div class="tp-rate__total">' +
        '<span class="rate-value rate-value--lg">' + Fmt.ratingNum(hotel.rate) + '</span>' +
        '<span><b class="t-h6">' + esc(Fmt.rating(hotel.rate)) + '</b>' +
          '<span class="t-meta" style="display:block">' + esc(t('card.reviews', { n: hotel.rev })) + '</span></span>' +
      '</div>' +
      '<ul class="tp-rate__list">' + out + '</ul>';
  }

  function monthYear(when) {
    var parts = String(when).split('-');
    return Fmt.monthNom(+parts[1] - 1) + ' ' + parts[0];
  }

  function renderReviews() {
    var data = Data.hotelReviews(hotel.id);

    qs('[data-tp-tags]').innerHTML =
      '<h3 class="t-h6">' + esc(t('tp.mentions')) + '</h3>' +
      '<div class="tp-tags__list">' + data.tags.map(function (x) {
        return '<span class="tag-count">' + esc(nm(x.name)) + '<sup>' + x.n + '</sup></span>';
      }).join('') + '</div>';

    reviews = data.list;
    qs('[data-tp-reviews]').innerHTML = data.list.map(function (r, ri) {
      function part(kind, title, items) {
        if (!items.length) return '';
        return '<div class="tp-review__part" data-kind="' + kind + '">' +
          '<h4>' + esc(title) + '</h4>' +
          '<ul>' + items.map(function (x) { return '<li>' + esc(nm(x)) + '</li>'; }).join('') + '</ul>' +
        '</div>';
      }
      return '<article class="tp-review">' +
        '<div class="tp-review__head">' +
          '<span class="rate-value">' + Fmt.ratingNum(r.rate) + '</span>' +
          '<span class="tp-review__who">' +
            '<b>' + esc(nm(r.who)) + '</b>' +
            '<span class="t-meta">' + esc(monthYear(r.when)) + ' · ' +
              esc(t('tp.reviewStay', { nights: Fmt.nights(r.nights), room: nm(Data.room(r.room).name) })) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="tp-review__body">' +
          part('pro', t('tp.pros'), r.pros) +
          part('con', t('tp.cons'), r.cons) +
        '</div>' +
        /* Снимки есть не под каждым отзывом: их прикладывают двое-трое из
           пяти, и ряд миниатюр там, где он есть, читается как «этот человек
           действительно там был». */
        (r.photos.length
          ? '<div class="tp-review__pics">' + r.photos.map(function (name, pi) {
              return '<button class="tp-review__pic" type="button" data-rvpic="' + ri + '|' + pi + '" ' +
                'aria-label="' + esc(t('tp.photoOpen')) + '">' +
                App.photo(Data.cover(name), t('tp.reviewPhotos'), '') + '</button>';
            }).join('') + '</div>'
          : '') +
        '<div class="tp-review__foot">' +
          '<button class="link-btn" type="button" data-demo>' + icon('like') +
            '<span>' + esc(t('tp.helpful')) + ' · ' + r.likes + '</span></button>' +
        '</div>' +
      '</article>';
    }).join('') +
      '<a class="btn btn--ghost" href="index.html#reviews">' + esc(t('tp.reviewsAll')) + '</a>';
  }

  /* --- Похожие туры: тот же курорт, другой отель --------------------------
     Не сетка, а лента: на курорте соседей больше, чем помещается в ряд, и
     обрубать список до четырёх ради ровной сетки — терять ровно то, ради
     чего этот блок стоит внизу страницы. */
  var SIMILAR_MAX = 8;

  function renderSimilar() {
    var seen = {}, out = [];
    all.forEach(function (x) {
      if (x.hotelId === hotel.id || seen[x.hotelId] || out.length >= SIMILAR_MAX) return;
      if (x.resortId !== tour.resortId) return;
      seen[x.hotelId] = 1;
      out.push(x);
    });
    /* На курорте может не набраться восьми отелей — тогда добираем страной. */
    if (out.length < SIMILAR_MAX) {
      all.forEach(function (x) {
        if (x.hotelId === hotel.id || seen[x.hotelId] || out.length >= SIMILAR_MAX) return;
        if (x.countryId !== tour.countryId) return;
        seen[x.hotelId] = 1;
        out.push(x);
      });
    }
    if (!out.length) { qs('#tp-similar').hidden = true; return; }
    qs('[data-tp-similar]').innerHTML = out.map(function (x) { return App.tourCard(x); }).join('');
    document.dispatchEvent(new CustomEvent('cards:render'));
    syncRail();
  }

  /* --- Стрелки ленты ------------------------------------------------------
     Шаг — ровно одна карточка: лента прилипает к её началу, и прыжок «на
     экран» она откатывает назад. Стрелки гаснут на краях: доехать дальше
     конца кнопка обещать не должна. На телефоне их нет вовсе — там листают
     пальцем, и две кнопки в заголовке только съедают ширину. */
  function syncRail() {
    var rail = qs('[data-tp-similar]'), nav = qs('[data-rail-nav]');
    if (!rail || !nav) return;
    var max = rail.scrollWidth - rail.clientWidth - 1;
    qs('[data-rail-prev]', nav).disabled = rail.scrollLeft <= 0;
    qs('[data-rail-next]', nav).disabled = rail.scrollLeft >= max;
  }

  function initRail() {
    var rail = qs('[data-tp-similar]'), nav = qs('[data-rail-nav]');
    if (!rail || !nav) return;
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var first = rail.firstElementChild;
      if (!first) return;
      var step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || 0);
      var max = rail.scrollWidth - rail.clientWidth;
      var target = rail.scrollLeft + (b.hasAttribute('data-rail-prev') ? -step : step);
      rail.scrollTo({ left: Math.max(0, Math.min(max, Math.round(target))), behavior: 'smooth' });
    });
    rail.addEventListener('scroll', syncRail, { passive: true });
    window.addEventListener('resize', syncRail);
    syncRail();
  }

  /* --- Вопросы, которые задают перед оплатой ------------------------------ */
  function renderFaq() {
    var items = ['pay', 'docs', 'cancel', 'ins'];
    qs('[data-tp-faq]').innerHTML = items.map(function (k, i) {
      return '<div class="accordion__item" data-open="' + (i === 0) + '">' +
        '<h3>' +
          '<button class="accordion__trigger" type="button" aria-expanded="' + (i === 0) + '" aria-controls="tp-faq-' + i + '">' +
            '<span>' + esc(t('tp.faq.' + k)) + '</span>' +
            '<svg class="accordion__sign" aria-hidden="true"><use href="#i-plus"></use></svg>' +
          '</button>' +
        '</h3>' +
        '<div class="accordion__panel" id="tp-faq-' + i + '"><div>' +
          '<div class="accordion__content t-body-s">' + esc(t('tp.faq.' + k + '.a')) + '</div>' +
        '</div></div>' +
      '</div>';
    }).join('');
  }

  /* --- Поведение ---------------------------------------------------------- */

  /* Мини-форма над таблицей. Наследует поля общего поиска, но без вкладок и
     без «Куда»: отель уже выбран, и спрашивать направление второй раз — это
     предлагать уйти со страницы. */
  function HotelForm(root, p, cb) { App.SearchForm.call(this, root, p, cb); }
  HotelForm.prototype = Object.create(App.SearchForm.prototype);
  HotelForm.prototype.constructor = HotelForm;
  HotelForm.prototype.render = function () {
    this.root.innerHTML =
      '<div class="search__row">' +
        this.fieldCity() + this.fieldDates() + this.fieldNights() + this.fieldGuests() +
        '<button class="btn btn--lime btn--lg search__submit" type="submit" data-submit>' +
          esc(t('f.search')) + '</button>' +
      '</div>';
  };

  function hotelFormParams() {
    var p = App.paramsFromURL();
    p.from = App.state.city;
    p.date = gridFrom;
    p.nightsMin = sel.nights;
    p.nightsMax = Math.min(21, sel.nights + 3);
    p.adults = params.adults;
    p.kids = params.kids;
    return p;
  }

  /* Подпись свёрнутой формы повторяет её поля одной строкой: на телефоне
     кнопка обязана сказать, что под ней, иначе это просто «Фильтр». */
  function hotelFormLabel() {
    var p = hotelForm ? hotelForm.p : hotelFormParams();
    return [
      nm(Data.city(p.from).name),
      Fmt.dayMonthFull(p.date),
      p.nightsMin + '–' + p.nightsMax + ' ' + t('f.nights').toLowerCase(),
      App.guestsLabel(p)
    ].join(' · ');
  }

  function initHotelForm() {
    var p = hotelFormParams();
    if (hotelForm) {
      hotelForm.p = p;
      hotelForm.render();
      qs('[data-hform-label]').textContent = hotelFormLabel();
      return;
    }
    hotelForm = new HotelForm(qs('#hotel-form'), p, function (np) {
      /* Форма не уводит на выдачу: она пересобирает таблицу и список прямо
         здесь — отель уже выбран, и уходить со страницы незачем. */
      params.adults = np.adults;
      params.kids = np.kids;
      gridFrom = np.date;
      gridNights = Math.max(2, np.nightsMin);
      sel.date = np.date;
      sel.nights = np.nightsMin;
      filters.meal = '';
      filters.airline = '';
      refreshOffers();
      if (offers.length) tour = offers[0];
      renderGrid();
      renderOffers();
      renderPrice();
      renderIncluded();
      renderFlight();
      renderAbout();
      qs('[data-hform-label]').textContent = hotelFormLabel();
    });
    qs('[data-hform-label]').textContent = hotelFormLabel();
  }

  function selectCell(dateISO, nightsCount) {
    sel.date = dateISO;
    sel.nights = nightsCount;
    filters.meal = '';
    filters.airline = '';
    refreshOffers();
    if (offers.length) tour = offers[0];
    renderGrid();
    renderOffers();
    renderPrice();
    renderIncluded();
    renderFlight();
  }

  function selectOffer(id) {
    var o = offers.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    tour = o;
    renderOffers();
    renderPrice();
    renderIncluded();
    renderFlight();
    App.toast(t('tp.selected') + ': ' + Fmt.range(o.date, o.nights) + ' · ' + Fmt.money(o.price));
  }

  function bind() {
    var main = qs('main');

    /* Галерея */
    qs('[data-tp-gallery]').addEventListener('click', function (e) {
      var step = e.target.closest('[data-shot]');
      if (step) { setShot(shot + +step.getAttribute('data-shot')); return; }
      var th = e.target.closest('[data-thumb]');
      if (th) { setShot(+th.getAttribute('data-thumb')); return; }
      if (e.target.closest('[data-gal-open]')) openGallery();
    });

    /* Сторис */
    qs('[data-tp-stories]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tale]');
      if (b) openTale(+b.getAttribute('data-tale'));
    });

    /* Таблица и список */
    main.addEventListener('click', function (e) {
      /* «Подробнее» под описанием отеля: разворачивает абзац на месте. */
      var aboutBtn = e.target.closest('[data-about-more]');
      if (aboutBtn) {
        var txt = qs('.tp-info__text');
        var open = aboutBtn.getAttribute('aria-expanded') === 'true';
        txt.classList.toggle('is-open', !open);
        aboutBtn.setAttribute('aria-expanded', String(!open));
        aboutBtn.textContent = t(open ? 'card.more' : 'seo.less');
        return;
      }
      var shift = e.target.closest('[data-grid]');
      if (shift) {
        gridFrom = Fmt.toISO(Fmt.addDays(Fmt.parseISO(gridFrom), +shift.getAttribute('data-grid')));
        renderGrid();
        return;
      }
      var cell = e.target.closest('[data-cell]');
      if (cell) {
        var parts = cell.getAttribute('data-cell').split('|');
        selectCell(parts[0], +parts[1]);
        return;
      }
      var pickBtn = e.target.closest('[data-pick]');
      if (pickBtn) { selectOffer(pickBtn.getAttribute('data-pick')); return; }

      /* Номер: те же кадры, что и в галерее, только этой категории */
      var roomBtn = e.target.closest('[data-room]');
      if (roomBtn) {
        var r = rooms[+roomBtn.getAttribute('data-room')];
        if (r) openLightbox(r.shots, 0, nm(Data.room(r.id).name));
        return;
      }

      /* Снимок под отзывом: открывается вся пачка этого отзыва, а не один кадр */
      var picBtn = e.target.closest('[data-rvpic]');
      if (picBtn) {
        var at = picBtn.getAttribute('data-rvpic').split('|');
        var rv = reviews[+at[0]];
        if (rv) openLightbox(rv.photos, +at[1], nm(rv.who));
        return;
      }

      /* Свёрнутая форма над таблицей — только на узких экранах */
      var hToggle = e.target.closest('[data-hform-toggle]');
      if (hToggle) {
        var box = qs('[data-toursearch]');
        var open = box.getAttribute('data-open') === 'true';
        box.setAttribute('data-open', String(!open));
        hToggle.setAttribute('aria-expanded', String(!open));
      }
    });

    main.addEventListener('change', function (e) {
      var f = e.target.closest('[data-filter]');
      if (!f) return;
      filters[f.getAttribute('data-filter')] = f.value;
      renderOffers();
    });

    /* Полоса поиска: «Изменить» раскрывает форму, как в выдаче */
    var bar = qs('.searchbar');
    qs('[data-expand]').addEventListener('click', function () {
      var open = bar.getAttribute('data-expanded') === 'true';
      bar.setAttribute('data-expanded', String(!open));
    });

    /* Вопросы перед оплатой */
    qs('[data-tp-faq]').addEventListener('click', function (e) {
      var trig = e.target.closest('.accordion__trigger');
      if (!trig) return;
      var item = trig.closest('.accordion__item');
      var open = item.getAttribute('data-open') === 'true';
      item.setAttribute('data-open', String(!open));
      trig.setAttribute('aria-expanded', String(!open));
    });
  }

  function renderAll() {
    renderCrumbs();
    renderSearchbar();
    renderGallery();
    renderStories();
    renderInfo();
    renderPrice();
    renderToursHead();
    initHotelForm();
    renderGrid();
    renderOffers();
    renderIncluded();
    renderFlight();
    renderAbout();
    renderServices();
    renderRooms();
    renderMap();
    renderRate();
    renderReviews();
    renderSimilar();
    renderFaq();
  }

  function init() {
    App.boot();
    pick();
    renderAll();
    bind();
    initRail();
    App.bindCards(qs('main'));
    /* Язык, город и валюта перерисовывают страницу целиком: половина текста
       здесь собрана в JS, и точечное обновление разошлось бы с разметкой. */
    document.addEventListener('lang:change', renderAll);
    document.addEventListener('currency:change', renderAll);
    document.addEventListener('city:change', function () { pick(); renderAll(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
