/* ============================================================================
   trips.kz — главная страница. Все блоки с числами перерисовываются при смене
   города вылета, языка и валюты: цена без города вылета в этой категории
   бессмысленна.
   ========================================================================== */
(function () {
  var qs = App.qs, qsa = App.qsa, esc = App.esc, icon = App.icon, t = App.t, nm = App.nm;
  var nmGen = App.nmGen, nmAcc = App.nmAcc;
  var tours = [], mins = {}, hotTab = 'all';

  /* Выбранная вкладка горящих живёт в адресе страницы. Так подобранную
     подборку можно отправить ссылкой и вернуться к ней кнопкой «назад» —
     ровно то же правило, что уже действует в выдаче. replaceState, а не
     push: щёлканье по вкладкам не должно набивать историю. */
  function hotFromURL() {
    var v = new URLSearchParams(location.search).get('hot');
    return v || 'all';
  }
  function setHotInURL(id) {
    var p = new URLSearchParams(location.search);
    if (id && id !== 'all') p.set('hot', id); else p.delete('hot');
    var q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }

  /* Счётчики отзывов и оценок — те же разряды, что и у цен: неразрывный пробел */
  function num(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, Fmt.NBSP);
  }

  function build() {
    tours = Data.build(App.state.city);
    window.__tours = tours;
    window.__toursAnchor = '';
    mins = Data.minByCountry(tours);
  }

  /* --- Горящие туры ------------------------------------------------------- */
  function renderHotTabs() {
    var ids = ['tr', 'eg', 'ae', 'th', 'vn', 'cn', 'mv', 'kz'];
    var box = qs('[data-hot-tabs]');
    box.innerHTML =
      '<button class="tag tag-btn" type="button" data-hot="all" aria-pressed="' + (hotTab === 'all') + '">' +
        esc(t('hot.all')) + '</button>' +
      ids.map(function (id) {
        var c = Data.country(id);
        return '<button class="tag tag-btn" type="button" data-hot="' + id + '" aria-pressed="' + (hotTab === id) + '">' +
          esc(nm(c.name)) + '</button>';
      }).join('');
  }

  function renderHot() {
    var list = tours.filter(function (x) { return x.hot; });
    if (hotTab !== 'all') list = list.filter(function (x) { return x.countryId === hotTab; });
    /* Один отель — одна карточка: две строки одного отеля в витрине читаются
       как ошибка выдачи. Снимок, если он есть, показывается раньше заглушки. */
    var seen = {};
    list = list.filter(function (x) {
      if (seen[x.hotelId]) return false;
      seen[x.hotelId] = 1;
      return true;
    }).sort(function (a, b) {
      var pa = Data.hotel(a.hotelId).img ? 1 : 0, pb = Data.hotel(b.hotelId).img ? 1 : 0;
      return pb - pa || b.discount - a.discount;
    }).slice(0, 8);

    var box = qs('[data-hot-list]');
    if (!list.length) {
      box.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1">' +
        '<p class="t-h5">' + esc(t('search.empty.title')) + '</p>' +
        '<p>' + esc(t('search.empty.c')) + '</p></div>';
      return;
    }
    box.innerHTML = list.map(function (x) { return App.tourCard(x); }).join('');
    document.dispatchEvent(new CustomEvent('cards:render'));
  }

  /* --- Плитки направлений --------------------------------------------------
     Девять стран и десятой — выход в полную выдачу: ряд из двенадцати колонок
     закрывается ровно, а «Все направления» стоит там, где взгляд его ищет. */
  function renderTiles() {
    var order = ['tr', 'eg', 'ae', 'th', 'cn', 'mv', 'vn', 'ge', 'kz'];
    var city = nmGen(Data.city(App.state.city));
    var html = order.map(function (id, i) {
      var c = Data.country(id);
      var price = mins[id];
      var wide = i === 0 || i === 3;
      var hasPhoto = !!c.img;
      return '<a class="tile reveal' + (wide ? ' tile--wide' : '') + (hasPhoto ? '' : ' tile--stub') + '" ' +
        'href="' + destHref(id) + '">' +
        (hasPhoto
          ? '<img src="../assets/img/' + c.img + '.webp" alt="' + esc(nm(c.name)) + '"' +
            App.imgDim(c.img) + ' loading="lazy" decoding="async">' +
            '<span class="tile__scrim"></span>'
          : '') +
        '<span class="tile__body">' +
          '<span class="tile__name">' + esc(nm(c.name)) + '</span>' +
          (price ? '<span class="tile__price">' +
            t('tile.price', { city: esc(city), sum: Fmt.money(price) }) + '</span>' : '') +
          '<span class="tile__meta">' +
            (c.water ? '<span>' + icon('water') + ' ' + c.water + '°</span>' : '') +
            '<span>' + icon('sun') + ' ' + c.air + '°</span>' +
            '<span>' + icon('plane') + ' ' + String(c.flight).replace('.', ',') + ' ' + esc(t('unit.h')) + '</span>' +
          '</span>' +
          '<span class="tile__visa">' + esc(t(c.visaFree ? 'dest.visaFree' : 'dest.visa')) + '</span>' +
        '</span>' +
      '</a>';
    }).join('');

    /* Стрелка стоит у самого текста, а не отдельным кружком в пустом верху
       плитки: на узкой колонке между ними оставалась половина высоты, и знак
       читался как случайно уехавший элемент, а не как «перейти отсюда». */
    html += '<a class="tile tile--all reveal" href="' + destHref('') + '">' +
        '<span class="tile--all__text">' +
          '<span class="tile__name" style="display:block">' + esc(t('sec.dest.all')) + '</span>' +
          '<span class="tile__note" style="display:block">' + esc(t('dest.allNote')) + '</span>' +
        '</span>' +
        '<span class="tile__go">' + icon('arrow-ur') + '</span>' +
      '</a>';

    qs('[data-tiles]').innerHTML = html;
    document.dispatchEvent(new CustomEvent('cards:render'));
  }

  function destHref(countryId, extra) {
    var p = App.defaults();
    p.from = App.state.city;
    p.to = countryId || '';
    return 'search.html?' + App.paramsToQuery(p, extra);
  }

  /* --- Календарь низких цен ------------------------------------------------ */
  function renderMonths() {
    var countryId = (qs('[data-months]').getAttribute('data-country') || 'tr');
    var rows = Data.monthsLow(App.state.city, countryId, 6);
    var min = Math.min.apply(null, rows.map(function (r) { return r.price; }));
    var minShown = false;
    qs('[data-months]').innerHTML = rows.map(function (r) {
      /* Кислотная линия минимума ставится один раз: два пятна обесценивают оба. */
      var isMin = !minShown && r.price === min;
      if (isMin) minShown = true;
      return '<button class="month' + (isMin ? ' month--min' : '') + '" type="button" data-month="' + r.date + '">' +
        '<span class="month__name">' + esc(Fmt.monthNom(r.month)) + ' ' + r.year + '</span>' +
        '<span class="month__price">' +
          t('price.from', { sum: Fmt.money(r.price) }) + '</span>' +
        '<span class="month__note">' + (isMin ? esc(t('f.minPrice')) : '') + '</span>' +
      '</button>';
    }).join('');

    var pick = qs('[data-months-country]');
    if (pick && !pick.dataset.filled) {
      pick.dataset.filled = '1';
      pick.innerHTML = ['tr', 'eg', 'ae', 'th', 'cn', 'kz'].map(function (id) {
        return '<option value="' + id + '">' + esc(nm(Data.country(id).name)) + '</option>';
      }).join('');
      pick.value = countryId;
      pick.addEventListener('change', function () {
        qs('[data-months]').setAttribute('data-country', pick.value);
        renderMonths();
      });
    } else if (pick) {
      var v = pick.value;
      pick.innerHTML = ['tr', 'eg', 'ae', 'th', 'cn', 'kz'].map(function (id) {
        return '<option value="' + id + '">' + esc(nm(Data.country(id).name)) + '</option>';
      }).join('');
      pick.value = v;
    }
  }

  /* --- Подборки, отзывы, статьи -------------------------------------------- */
  /* Подборка — это готовый набор фильтров, а не отдельная страница: ссылка
     разворачивает свой q в параметры выдачи, и человек попадает сразу в неё. */
  function collExtra(c) {
    var extra = {};
    (c.q || '').split('&').forEach(function (pair) {
      if (!pair) return;
      var kv = pair.split('=');
      extra[kv[0]] = kv[1];
    });
    /* Новогодняя подборка — это не фильтр, а даты: ближайшее 28 декабря. */
    if (extra.ny) {
      delete extra.ny;
      var now = new Date();
      var year = now.getFullYear() + (now.getMonth() === 11 && now.getDate() > 20 ? 1 : 0);
      extra.date = year + '-12-28';
    }
    return extra;
  }

  function renderCollections() {
    qs('[data-collections]').innerHTML = Data.COLLECTIONS.map(function (c) {
      return '<a class="coll-card reveal" href="' + destHref('', collExtra(c)) + '">' +
        '<div class="coll-card__media">' + App.photo(c.img, nm(c.name)) + '</div>' +
        '<div class="coll-card__body">' +
          '<div class="coll-card__text">' +
            '<h3 class="t-h5">' + esc(nm(c.name)) + '</h3>' +
            '<p class="t-body-s">' + esc(nm(c.note)) + '</p>' +
          '</div>' +
          '<span class="coll-card__go" aria-hidden="true">' + icon('arrow-ur') + '</span>' +
        '</div></a>';
    }).join('');
    document.dispatchEvent(new CustomEvent('cards:render'));
  }

  /* --- Итог по отзывам: оценка слева, источники справа ---------------------
     Пять звёзд рисуются дважды: серый ряд снизу и цветной поверх, обрезанный
     по доле оценки. Так 4,7 видно как 4,7, а не как «пять звёзд». */
  function starsFrac(score, max) {
    var row = '';
    for (var i = 0; i < 5; i++) row += icon('star');
    return '<span class="stars-frac" style="--fill:' + (score / max * 100).toFixed(1) + '%" aria-hidden="true">' +
      '<span class="stars-frac__base">' + row + '</span>' +
      '<span class="stars-frac__on">' + row + '</span>' +
    '</span>';
  }

  function renderRevSummary() {
    var box = qs('[data-rev-summary]');
    if (!box) return;
    var s = Data.REVIEW_STATS;

    /* Сводка — одна панель в два яруса, а не четыре одинаковых столбца.
       Верхний ярус: подпись слева, крупная оценка рядом с ней, счётчики
       прижаты к правому краю панели — четырьмя строками в узкой колонке
       итог компании ничем не отличался от площадки. Нижний ярус: три
       площадки, разделённые линиями, каждая — имя слева, оценка справа. */
    box.innerHTML =
      '<div class="rev-score">' +
        '<span class="t-caps rev-score__label">' + esc(t('rev.score')) + '</span>' +
        '<span class="rev-score__main">' +
          '<span class="rev-score__row">' +
            '<b class="rev-score__value">' + Fmt.ratingNum(s.score) + '</b>' +
            '<span class="rev-score__max">/ ' + s.max + '</span>' +
          '</span>' +
          starsFrac(s.score, s.max) +
        '</span>' +
        '<span class="rev-score__counts">' +
          '<span><b>' + num(s.reviews) + '</b> ' + esc(t('rev.reviewsLabel')) + '</span>' +
          '<span><b>' + num(s.rates) + '</b> ' + esc(t('rev.ratesLabel')) + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="rev-plats">' +
      s.platforms.map(function (p) {
        return '<div class="rev-plat">' +
          '<span class="rev-plat__head">' +
            '<span class="rev-plat__mark" aria-hidden="true">' + esc(p.mark) + '</span>' +
            '<span class="rev-plat__name">' + esc(p.name) + '</span>' +
          '</span>' +
          '<span class="rev-plat__row">' +
            '<b class="rev-plat__val">' + Fmt.ratingNum(p.score) + '</b>' +
            starsFrac(p.score, p.max) +
          '</span>' +
          '<span class="rev-plat__n">' + esc(t('card.reviews', { n: p.n })) + '</span>' +
        '</div>';
      }).join('') +
      '</div>';
  }

  /* Форма отзыва: пятибалльная шкала — та же, в которой считается рейтинг
     компании и опубликованные отзывы. Двух шкал на одном экране не бывает. */
  function openReviewForm() {
    var rate = 5;
    var host = App.modal(
      '<div class="modal__head">' +
        '<h2 class="t-h3">' + esc(t('rev.form.title')) + '</h2>' +
        '<p class="t-body-s">' + esc(t('rev.form.lead')) + '</p>' +
      '</div>' +
      '<form class="modal__form" data-review-form novalidate>' +
        '<div class="modal__row">' +
          '<label class="field">' +
            '<span class="field__label">' + esc(t('rev.form.name')) + '</span>' +
            '<span class="field__control"><input class="field__input" type="text" data-rev-name autocomplete="name"></span>' +
          '</label>' +
          '<label class="field">' +
            '<span class="field__label">' + esc(t('rev.form.trip')) + '</span>' +
            '<span class="field__control"><input class="field__input" type="text" data-rev-trip ' +
              'placeholder="' + esc(t('rev.form.tripPh')) + '"></span>' +
          '</label>' +
        '</div>' +
        '<div class="field">' +
          '<span class="field__label">' + esc(t('rev.form.rate')) + '</span>' +
          '<div class="rate-picker" role="group" aria-label="' + esc(t('rev.form.rate')) + '">' +
            [1,2,3,4,5].map(function (n) {
              return '<button type="button" data-rate="' + n + '" aria-pressed="' + (n === rate) + '">' + n + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<label class="field">' +
          '<span class="field__label">' + esc(t('rev.form.text')) + '</span>' +
          '<span class="field__control field__control--area">' +
            '<textarea class="field__input" data-rev-text placeholder="' + esc(t('rev.form.textPh')) + '"></textarea>' +
          '</span>' +
          '<span class="field__hint" data-rev-hint role="status"></span>' +
        '</label>' +
        '<label class="check">' +
          '<input type="checkbox" data-rev-agree>' +
          '<span class="check__box">' + icon('check') + '</span>' +
          '<span>' + esc(t('foot.subAgree')) + '</span>' +
        '</label>' +
        '<div class="modal__foot">' +
          '<button class="btn btn--primary" type="submit">' + esc(t('rev.form.send')) + '</button>' +
        '</div>' +
      '</form>', t('rev.form.title'));

    var form = qs('[data-review-form]', host);
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rate]');
      if (!b) return;
      rate = +b.getAttribute('data-rate');
      qsa('[data-rate]', form).forEach(function (x) {
        x.setAttribute('aria-pressed', String(+x.getAttribute('data-rate') === rate));
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = qs('[data-rev-name]', form), text = qs('[data-rev-text]', form);
      var agree = qs('[data-rev-agree]', form), hint = qs('[data-rev-hint]', form);
      if (!name.value.trim()) {
        hint.textContent = t('rev.form.errName');
        name.closest('.field').classList.add('field--error');
        name.focus();
        return;
      }
      name.closest('.field').classList.remove('field--error');
      if (text.value.trim().length < 20) {
        hint.textContent = t('rev.form.errText');
        text.closest('.field').classList.add('field--error');
        text.focus();
        return;
      }
      if (!agree.checked) {
        hint.textContent = t('form.agreeErr');
        agree.closest('.check').classList.add('check--err');
        return;
      }
      App.closeModal();
      App.toast(t('rev.form.ok'));
    });
  }

  /* Заявка на подбор: тот же макет окна, другой состав полей */
  function openLeadForm() {
    var host = App.modal(
      '<div class="modal__head">' +
        '<h2 class="t-h3">' + esc(t('lead.title')) + '</h2>' +
        '<p class="t-body-s">' + esc(t('lead.lead')) + '</p>' +
      '</div>' +
      '<form class="modal__form" data-lead-form novalidate>' +
        '<div class="modal__row">' +
          '<label class="field">' +
            '<span class="field__label">' + esc(t('lead.name')) + '</span>' +
            '<span class="field__control"><input class="field__input" type="text" data-lead-name autocomplete="name"></span>' +
          '</label>' +
          '<label class="field">' +
            '<span class="field__label">' + esc(t('lead.phone')) + '</span>' +
            '<span class="field__control">' + icon('phone') +
              '<input class="field__input" type="tel" data-lead-phone placeholder="+7 700 000-00-00" autocomplete="tel"></span>' +
          '</label>' +
        '</div>' +
        '<label class="field">' +
          '<span class="field__label">' + esc(t('lead.comment')) + '</span>' +
          '<span class="field__control field__control--area">' +
            '<textarea class="field__input" data-lead-text placeholder="' + esc(t('lead.commentPh')) + '"></textarea>' +
          '</span>' +
          '<span class="field__hint" data-lead-hint role="status"></span>' +
        '</label>' +
        '<label class="check">' +
          '<input type="checkbox" data-lead-agree>' +
          '<span class="check__box">' + icon('check') + '</span>' +
          '<span>' + esc(t('foot.subAgree')) + '</span>' +
        '</label>' +
        '<div class="modal__foot">' +
          '<button class="btn btn--lime" type="submit">' + esc(t('lead.send')) + '</button>' +
        '</div>' +
      '</form>', t('lead.title'));

    var form = qs('[data-lead-form]', host);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = qs('[data-lead-name]', form), phone = qs('[data-lead-phone]', form);
      var agree = qs('[data-lead-agree]', form), hint = qs('[data-lead-hint]', form);
      if (!name.value.trim()) {
        hint.textContent = t('lead.errName');
        name.closest('.field').classList.add('field--error');
        name.focus();
        return;
      }
      name.closest('.field').classList.remove('field--error');
      /* Достаточно десяти цифр: формат ввода человек выбирает сам */
      if ((phone.value.match(/\d/g) || []).length < 10) {
        hint.textContent = t('lead.errPhone');
        phone.closest('.field').classList.add('field--error');
        phone.focus();
        return;
      }
      phone.closest('.field').classList.remove('field--error');
      if (!agree.checked) {
        hint.textContent = t('form.agreeErr');
        agree.closest('.check').classList.add('check--err');
        return;
      }
      App.closeModal();
      App.toast(t('lead.ok'));
    });
  }

  /* Отметки «полезно» живут в памяти вкладки: сервера у макета нет, а врать
     о том, что голос где-то сохранён, PRODUCT.md запрещает. */
  var LIKED = {};

  /* Отзывы про работу агентства не должны лежать в хвосте: их читают именно
     те, кто уже выбрал отель и сомневается в продавце. Ставим их вторым,
     шестым и десятым — так они попадаются в каждом экране прокрутки. */
  function reviewOrder() {
    var about = [], rest = [];
    Data.REVIEWS.forEach(function (r) { (r.about === 'agency' ? about : rest).push(r); });
    var out = rest.slice();
    about.forEach(function (r, i) {
      var at = Math.min(1 + i * 4, out.length);
      out.splice(at, 0, r);
    });
    return out;
  }

  function renderReviews() {
    var box = qs('[data-reviews]');
    box.innerHTML = reviewOrder().map(function (r) {
      var who = nm(r.who);
      var initials = who.split(' ').map(function (w) { return w[0]; }).join('');
      var d = r.when.split('-');
      var on = !!LIKED[r.id];
      return '<article class="review reveal" data-review="' + r.id + '">' +
        '<div class="review__who">' +
          '<span class="avatar" aria-hidden="true">' + esc(initials) + '</span>' +
          '<span><b class="t-h6">' + esc(who) + '</b>' +
            '<span class="t-meta" style="display:block">' + esc(nm(r.place)) + ' · ' +
              esc(Fmt.monthNom(+d[1] - 1)) + ' ' + d[0] + '</span></span>' +
          '<span class="rate-value" style="margin-left:auto">' + Fmt.ratingNum(r.rate) + '</span>' +
        '</div>' +
        '<div class="review__body">' +
          '<p class="t-body-s review__text">' + esc(nm(r.text)) + '</p>' +
          /* Кнопку показывает не длина строки, а факт обрезки: она зависит от
             языка, ширины колонки и загруженного шрифта — считаем по факту. */
          '<button class="review__more" type="button" data-review-more hidden>' +
            esc(t('rev.readAll')) + '</button>' +
        '</div>' +
        '<div class="review__foot">' +
          '<span class="review__hotel">' + esc(r.hotel) + '</span>' +
          '<button class="review__like" type="button" data-review-like ' +
            'aria-pressed="' + on + '" aria-label="' + esc(t('rev.helpful')) + '" ' +
            'title="' + esc(t('rev.helpful')) + '">' +
            icon('like') + '<span data-like-count>' + (r.likes + (on ? 1 : 0)) + '</span>' +
          '</button>' +
        '</div>' +
      '</article>';
    }).join('');
    syncReviewClamp();
    document.dispatchEvent(new CustomEvent('cards:render'));
  }

  /* Считается синхронно: чтение scrollHeight само вынуждает раскладку.
     Второй проход — после загрузки шрифта: Onest режет строки иначе, чем
     системный гротеск, и граница «влезло / не влезло» смещается. */
  function syncReviewClamp() {
    var box = qs('[data-reviews]');
    if (!box) return;
    qsa('.review', box).forEach(function (card) {
      if (card.classList.contains('is-open')) return;
      var text = qs('.review__text', card), btn = qs('[data-review-more]', card);
      btn.hidden = text.scrollHeight - text.clientHeight < 4;
    });
  }

  function bindReviews() {
    var box = qs('[data-reviews]');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var more = e.target.closest('[data-review-more]');
      if (more) {
        var card = more.closest('.review');
        var open = card.classList.toggle('is-open');
        more.textContent = t(open ? 'rev.collapse' : 'rev.readAll');
        return;
      }
      var like = e.target.closest('[data-review-like]');
      if (!like) return;
      var id = like.closest('[data-review]').getAttribute('data-review');
      var was = !!LIKED[id];
      LIKED[id] = !was;
      like.setAttribute('aria-pressed', String(!was));
      var out = qs('[data-like-count]', like);
      out.textContent = String(+out.textContent + (was ? -1 : 1));
    });
    window.addEventListener('resize', syncReviewClamp);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncReviewClamp);
  }

  function renderArticles() {
    qs('[data-articles]').innerHTML = Data.ARTICLES.map(function (a) {
      return '<a class="article reveal" href="#" data-demo>' +
        /* На снимке остаётся только рубрика. Время чтения — не подпись к кадру,
           а свойство текста: оно встало в строку выходных данных рядом с датой,
           где его и ищут глазами перед тем, как открыть статью. */
        '<div class="article__media">' + App.photo(a.img, nm(a.title)) +
          '<span class="article__tags">' +
            '<span class="article__tag">' + esc(nm(a.cat)) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="article__meta">' +
          '<span>' + esc(Fmt.dayMonthFull(a.date)) + ' ' + a.date.slice(0, 4) + '</span>' +
          '<span class="article__dot" aria-hidden="true"></span>' +
          '<span>' + esc(t('blog.min', { n: a.min })) + '</span>' +
        '</div>' +
        '<h3 class="t-h5">' + esc(nm(a.title)) + '</h3>' +
        '<p class="t-body-s article__excerpt">' + esc(nm(a.lead)) + '</p>' +
        '<span class="article__read">' + esc(t('blog.read')) + icon('arrow-r') + '</span>' +
      '</a>';
    }).join('');
    syncRail('articles');
    document.dispatchEvent(new CustomEvent('cards:render'));
  }

  /* Карусели с ленты: статьи и команда. Прокрутка на одну карточку, стрелки
     гаснут на краях — доехать «дальше конца» кнопка обещать не должна.
     Пар несколько, поэтому лента и её стрелки связаны ключом, а не порядком
     в разметке: qs('[data-rail-nav]') брал бы первую попавшуюся. */
  var RAILS = [
    { key: 'articles', box: '[data-articles]' },
    { key: 'team', box: '[data-team]' }
  ];

  function railPair(key) {
    var r = null, i;
    for (i = 0; i < RAILS.length; i++) { if (RAILS[i].key === key) r = RAILS[i]; }
    if (!r) return null;
    var rail = qs(r.box), nav = qs('[data-rail-nav="' + key + '"]');
    return rail && nav ? { rail: rail, nav: nav } : null;
  }

  function syncRail(key) {
    var p = railPair(key);
    if (!p) return;
    var max = p.rail.scrollWidth - p.rail.clientWidth - 1;
    qs('[data-rail-prev]', p.nav).disabled = p.rail.scrollLeft <= 0;
    qs('[data-rail-next]', p.nav).disabled = p.rail.scrollLeft >= max;
  }

  function initRail(key) {
    var p = railPair(key);
    if (!p) return;
    var rail = p.rail;
    p.nav.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      /* Шаг — ровно одна карточка: лента прилипает к началу карточки
         (scroll-snap: mandatory), и прыжок «на экран» она откатывает назад. */
      var first = rail.firstElementChild;
      if (!first) return;
      var step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || 0);
      var max = rail.scrollWidth - rail.clientWidth;
      var target = rail.scrollLeft + (b.hasAttribute('data-rail-prev') ? -step : step);
      rail.scrollTo({ left: Math.max(0, Math.min(max, Math.round(target))), behavior: 'smooth' });
    });
    rail.addEventListener('scroll', function () { syncRail(key); }, { passive: true });
    window.addEventListener('resize', function () { syncRail(key); });
    syncRail(key);
  }

  function initRails() {
    RAILS.forEach(function (r) { initRail(r.key); });
  }

  function bindSeoMore() {
    var btn = qs('[data-seo-more]'), box = qs('[data-seo-links]');
    if (!btn || !box) return;
    btn.addEventListener('click', function () {
      var open = box.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = t(open ? 'seo.less' : 'seo.more');
    });
  }

  /* --- Перелинковка: страны × города вылета -------------------------------- */
  function renderSeoLinks() {
    var countries = ['tr', 'eg', 'ae', 'th', 'cn'];
    var cities = Data.CITIES.slice(0, 6);
    qs('[data-seo-links]').innerHTML = countries.map(function (id) {
      var c = Data.country(id);
      return '<div><h3>' + esc(nm(c.name)) + '</h3>' +
        cities.map(function (city) {
          var p = App.defaults();
          p.from = city.id; p.to = id;
          return '<a href="search.html?' + App.paramsToQuery(p) + '">' +
            esc(t('seo.link', { country: nmAcc(c), city: nmGen(city) })) + '</a>';
        }).join('') + '</div>';
    }).join('');
  }

  /* --- Команда -------------------------------------------------------------
     Снимок сверху, под ним имя, должность и одна строка о том, чем человек
     занимается на деле. Ниже — год прихода и языки: это то немногое, что
     клиент действительно спрашивает, когда выбирает, кому позвонить. */
  /* Действие в карточке человека. У того, кто ведёт направление, — ссылка на
     выдачу именно по нему (город вылета берётся текущий, как везде на сайте),
     у остальных — кнопка заявки. Ссылка, а не кнопка: её можно открыть
     в новой вкладке и отправить себе. */
  function teamAction(m) {
    if (m.to) {
      var c = Data.country(m.to);
      var prm = App.defaults();
      prm.from = App.state.city;
      prm.to = m.to;
      return '<a class="team-card__act" href="search.html?' + App.paramsToQuery(prm) + '">' +
        esc(t('team.toursTo', { country: nmAcc(c), name: nm(m.name).split(' ')[0] })) +
        icon('arrow-r') + '</a>';
    }
    return '<button class="team-card__act" type="button" data-lead-open>' +
      esc(t('team.ask')) + icon('arrow-r') + '</button>';
  }

  function renderTeam() {
    qs('[data-team]').innerHTML = Data.TEAM.map(function (m) {
      var langs = m.langs.map(function (l) { return t('tp.lang.' + l); }).join(', ');
      return '<article class="team-card reveal">' +
        '<div class="team-card__media">' + App.photo(m.img, nm(m.name)) + '</div>' +
        '<div class="team-card__body">' +
          '<h3 class="team-card__name">' + esc(nm(m.name)) + '</h3>' +
          '<div class="team-card__role">' + esc(nm(m.role)) + '</div>' +
          '<p class="team-card__note">' + esc(nm(m.note)) + '</p>' +
          '<dl class="team-card__meta">' +
            '<dt class="u-visually-hidden">' + esc(t('sec.team.eyebrow')) + '</dt>' +
            '<dd>' + esc(t('team.since', { y: m.since })) + '</dd>' +
            '<dd>' + esc(t('team.speaks', { list: langs })) + '</dd>' +
          '</dl>' +
          teamAction(m) +
        '</div>' +
      '</article>';
    }).join('');
    syncRail('team');
    document.dispatchEvent(new CustomEvent('cards:render'));
  }

  function renderAll() {
    build();
    hotTab = hotFromURL();
    renderHotTabs();
    renderHot();
    renderTiles();
    renderMonths();
    renderCollections();
    renderTeam();
    renderRevSummary();
    renderReviews();
    renderArticles();
    renderSeoLinks();
    bindSeoMore();
  }

  document.addEventListener('DOMContentLoaded', function () {
    App.boot();

    var params = App.paramsFromURL();
    params.from = App.state.city;
    var form = new App.SearchForm(qs('#search-form'), params);

    renderAll();
    initRails();
    bindReviews();

    /* Клик по табу горящих, по месяцу, по карточке — общая делегация */
    document.addEventListener('click', function (e) {
      var hot = e.target.closest('[data-hot]');
      if (hot) {
        hotTab = hot.getAttribute('data-hot');
        qsa('[data-hot]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-hot') === hotTab));
        });
        setHotInURL(hotTab);
        renderHot();
        return;
      }
      if (e.target.closest('[data-review-open]')) { openReviewForm(); return; }
      if (e.target.closest('[data-lead-open]')) { openLeadForm(); return; }
      var month = e.target.closest('[data-month]');
      if (month) {
        var p = App.defaults();
        p.from = App.state.city;
        p.to = qs('[data-months]').getAttribute('data-country');
        p.date = month.getAttribute('data-month');
        location.href = 'search.html?' + App.paramsToQuery(p);
      }
    });
    App.bindCards(document.body);

    /* Подписка: разметка формы честная — ошибка называет проблему и выход */
    var sub = qs('[data-subscribe]');
    if (sub) {
      sub.addEventListener('submit', function (e) {
        e.preventDefault();
        var mail = qs('[data-sub-mail]', sub), agree = qs('[data-sub-agree]', sub);
        var hint = qs('[data-sub-hint]', sub);
        var ok = /.+@.+\..+/.test(mail.value.trim());
        sub.classList.toggle('field--error', !ok);
        if (!ok) { hint.textContent = t('foot.subErr'); mail.focus(); return; }
        if (!agree.checked) {
          hint.textContent = t('foot.subAgreeErr');
          agree.closest('.check').classList.add('check--err');
          return;
        }
        hint.textContent = '';
        agree.closest('.check').classList.remove('check--err');
        App.toast(t('foot.subOk'));
        sub.reset();
      });
    }

    document.addEventListener('city:change', function () {
      form.p.from = App.state.city;
      form.refreshValues();
      renderAll();
    });
    document.addEventListener('currency:change', renderAll);
    document.addEventListener('lang:change', function () {
      form.render();
      form.refreshValues();
      renderAll();
    });
  });
})();
