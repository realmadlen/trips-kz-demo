/* ============================================================================
   trips.kz — общий слой обеих страниц: служебная строка, шапка, состояние
   (город вылета, валюта, язык, избранное), поисковый модуль и отрисовка
   карточек. Одна реализация на две страницы — разметка не копируется.
   ========================================================================== */
window.App = (function () {
  var t = function (k, v) { return I18N.t(k, v); };
  var nm = function (o) { return I18N.name(o); };
  /* Русский требует падежей: «туры в Турцию из Астаны». Казахский обходится
     послелогом, английский — предлогом, поэтому формы нужны только для ru. */
  var nmGen = function (city) {
    return I18N.current === 'ru' && city.gen ? city.gen : nm(city.name);
  };
  var nmAcc = function (country) {
    return I18N.current === 'ru' && country.acc ? country.acc : nm(country.name);
  };

  /* --- мелочи ------------------------------------------------------------ */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name, cls) {
    return '<svg class="' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  /* --- состояние --------------------------------------------------------- */
  var state = {
    city: 'ala',
    favorites: []
  };
  function load() {
    try {
      var c = localStorage.getItem('trips.city');
      if (c && Data.byId(Data.CITIES, c)) state.city = c;
      var f = localStorage.getItem('trips.fav');
      if (f) state.favorites = JSON.parse(f);
    } catch (e) {}
  }
  function saveCity(id) {
    state.city = id;
    try { localStorage.setItem('trips.city', id); } catch (e) {}
    document.dispatchEvent(new CustomEvent('city:change', { detail: { city: id } }));
  }
  function isFav(id) { return state.favorites.indexOf(id) !== -1; }
  function toggleFav(id) {
    var i = state.favorites.indexOf(id);
    if (i === -1) state.favorites.push(id); else state.favorites.splice(i, 1);
    try { localStorage.setItem('trips.fav', JSON.stringify(state.favorites)); } catch (e) {}
    renderFavCount();
    toast(t(i === -1 ? 'toast.fav' : 'toast.unfav'));
    return i === -1;
  }
  function renderFavCount() {
    qsa('[data-fav-count]').forEach(function (n) {
      n.textContent = state.favorites.length ? String(state.favorites.length) : '';
    });
  }

  /* --- тосты ------------------------------------------------------------- */
  function toast(text) {
    var box = qs('.toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  /* --- модальное окно ------------------------------------------------------
     Одно на весь сайт: отзыв и заявка отличаются только содержимым формы.
     Возврат фокуса и Esc обязательны — окно перекрывает страницу целиком. */
  var modalReturn = null;
  function closeModal() {
    var m = qs('[data-modal]');
    if (!m) return;
    m.remove();
    document.documentElement.classList.remove('is-locked');
    if (modalReturn && modalReturn.focus) modalReturn.focus();
    modalReturn = null;
  }
  function modal(html, label) {
    closeModal();
    modalReturn = document.activeElement;
    var host = document.createElement('div');
    host.className = 'modal';
    host.setAttribute('data-modal', '');
    host.innerHTML =
      '<div class="modal__scrim" data-modal-close></div>' +
      '<div class="modal__card" role="dialog" aria-modal="true" aria-label="' + esc(label || '') + '">' +
        '<button class="btn-icon modal__x" type="button" data-modal-close ' +
          'aria-label="' + esc(t('modal.close')) + '">' + icon('close') + '</button>' +
        html +
      '</div>';
    document.body.appendChild(host);
    document.documentElement.classList.add('is-locked');
    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-modal-close]')) closeModal();
    });
    /* Tab не должен уходить на страницу под окном */
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = qsa('button, [href], input, textarea, select', host)
        .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    var start = qs('input, textarea', host) || qs('.modal__card button:not([data-modal-close])', host);
    if (start) start.focus();
    return host;
  }

  /* --- боковая панель ------------------------------------------------------
     Чат, избранное и личный кабинет — три обращения к одному и тому же: они
     не прерывают страницу, а выдвигаются рядом с ней. На телефоне это шторка
     снизу (большой палец достаёт до неё от нижней панели, откуда её и
     открывают), на десктопе — колонка справа. Одна реализация на все три:
     отличается только содержимое. */
  var panelReturn = null;
  function closePanel() {
    var p = qs('[data-panel]');
    if (!p) return;
    p.remove();
    document.documentElement.classList.remove('is-locked');
    if (panelReturn && panelReturn.focus) panelReturn.focus();
    panelReturn = null;
  }
  /* opts.cls — модификатор шторки, opts.sub — вторая строка заголовка
     (готовая разметка: её собирает тот, кто открывает панель). */
  function panel(label, bodyHTML, footHTML, opts) {
    opts = opts || {};
    var wasOpen = !!qs('[data-panel]');
    closePanel();
    if (!wasOpen) panelReturn = document.activeElement;
    var host = document.createElement('div');
    host.className = 'sheet sheet--panel' + (opts.cls ? ' ' + opts.cls : '');
    host.setAttribute('data-panel', '');
    host.setAttribute('data-open', 'true');
    host.innerHTML =
      '<div class="sheet__scrim" data-panel-close></div>' +
      '<div class="sheet__panel" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' +
        '<div class="sheet__head">' +
          '<span class="sheet__headText">' +
            '<b class="t-h6">' + esc(label) + '</b>' +
            (opts.sub ? '<span class="sheet__sub">' + opts.sub + '</span>' : '') +
          '</span>' +
          '<button class="btn-icon" type="button" data-panel-close aria-label="' +
            esc(t('nav.close')) + '">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="sheet__body">' + bodyHTML + '</div>' +
        (footHTML ? '<div class="sheet__foot">' + footHTML + '</div>' : '') +
      '</div>';
    document.body.appendChild(host);
    document.documentElement.classList.add('is-locked');
    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-panel-close]')) closePanel();
    });
    /* Tab не уходит на страницу под панелью */
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = qsa('button, [href], input, textarea, select', host)
        .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    return host;
  }

  /* --- Чат ------------------------------------------------------------------
     Кнопка «Чат» в нижней панели открывает переписку, а не форму заявки:
     сообщение уходит в ленту, ответ приходит туда же — то, чего от чата и
     ждут. Форма «контакт + сообщение» стояла на месте чата и требовала
     заполнить два поля прежде, чем задать вопрос; теперь телефон спрашивают
     репликой, когда вопрос уже задан.

     Обещаний вроде «ответим за минуту» здесь нет: над лентой стоит реальный
     статус по графику работы, а ночная заявка честно названа утренней.
     Ответы менеджера в макете — заготовленный сценарий (сервера у макета
     нет); он повторяет то, что на самом деле спрашивают в первую очередь.

     Ниже ленты — WhatsApp, Telegram и номер телефона: чат не должен быть
     единственной дверью, а мессенджер часто удобнее, чем окно на сайте. */
  var PHONE = '+7 (727) 000-00-00';
  var chat = null;   /* переписка живёт, пока открыта вкладка */

  function chatOpenNow() {
    var d = new Date(), day = d.getDay(), h = d.getHours() + d.getMinutes() / 60;
    if (day >= 1 && day <= 5) return h >= 10 && h < 19;
    if (day === 6) return h >= 10 && h < 15;
    return false;
  }
  function chatTime(d) {
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  /* Смена языка обнуляет переписку: половина реплик по-русски, половина
     по-казахски — это не двуязычие, а сломанный экран. */
  document.addEventListener('lang:change', function () { chat = null; });

  function chatReset() {
    var live = chatOpenNow();
    chat = {
      asked: false,
      gotPhone: false,
      msgs: [
        { who: 'in', text: t('chat.hello'), time: chatTime(new Date()) },
        { who: 'in', text: t(live ? 'chat.helloOn' : 'chat.helloOff'), time: chatTime(new Date()) }
      ]
    };
  }

  function openChat() {
    if (!chat) chatReset();
    var live = chatOpenNow();

    var chan = function (href, ico, name, note, cls) {
      return '<a class="chan' + (cls ? ' ' + cls : '') + '" href="' + href + '"' +
        (href === '#' ? ' data-demo' : '') + '>' +
        '<span class="chan__ico">' + icon(ico) + '</span>' +
        '<span class="chan__text"><b>' + esc(name) + '</b><span>' + esc(note) + '</span></span>' +
        icon('chev-r', 'chan__go') +
      '</a>';
    };

    var host = panel(t('chat.title'),
      '<div class="chat">' +
        '<div class="chat__thread" data-chat-thread>' +
          '<div class="chat__day">' + esc(t('chat.today')) + '</div>' +
          '<div class="chat__msgs" data-chat-msgs></div>' +
          '<div class="chat__chips" data-chat-chips>' +
            ['chat.chipTour', 'chat.chipBooking', 'chat.chipPay', 'chat.chipDocs'].map(function (k) {
              return '<button class="chat__chip" type="button" data-chat-chip>' + esc(t(k)) + '</button>';
            }).join('') +
          '</div>' +
          /* Другие двери — под перепиской, а не вместо неё */
          '<div class="chat__more">' +
            '<div class="panel__sep"><span>' + esc(t('chat.more')) + '</span></div>' +
            '<div class="chan-list">' +
              chan('#', 'whatsapp', t('chat.wa'), t('chat.waNote'), 'chan--wa') +
              chan('#', 'telegram', t('chat.tg'), t('chat.tgNote'), 'chan--tg') +
              chan('tel:+77270000000', 'phone', t('chat.call'), PHONE) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>',
      '<form class="composer" data-chat-form novalidate>' +
        '<label class="u-visually-hidden" for="chat-text">' + esc(t('chat.msg')) + '</label>' +
        '<textarea class="composer__input" id="chat-text" rows="1" data-chat-text ' +
          'placeholder="' + esc(t('chat.ph')) + '"></textarea>' +
        '<button class="composer__send" type="submit" data-chat-send ' +
          'aria-label="' + esc(t('chat.send')) + '" title="' + esc(t('chat.send')) + '">' +
          icon('send') + '</button>' +
      '</form>',
      {
        cls: 'sheet--chat',
        sub: '<span class="chat-status' + (live ? ' is-on' : '') + '">' +
               '<i aria-hidden="true"></i>' + esc(t(live ? 'chat.online' : 'chat.offline')) +
             '</span>'
      });

    var thread = qs('[data-chat-thread]', host);
    var msgs = qs('[data-chat-msgs]', host);
    var chips = qs('[data-chat-chips]', host);
    var input = qs('[data-chat-text]', host);

    function draw() {
      msgs.innerHTML = chat.msgs.map(function (m, i) {
        /* Кружок стоит у последней реплики подряд идущих, а не у первой:
           так он оказывается на одной линии с тем, что человек дочитал. */
        var next = chat.msgs[i + 1];
        var last = m.who === 'in' && (!next || next.who !== 'in');
        return '<div class="msg msg--' + m.who + '">' +
          (m.who === 'in'
            ? '<span class="msg__ava' + (last ? '' : ' msg__ava--tail') + '" aria-hidden="true">' +
                (last ? esc(t('chat.agentInitial')) : '') + '</span>'
            : '') +
          '<span class="msg__bubble">' + esc(m.text) +
            '<span class="msg__time">' + esc(m.time) + '</span>' +
          '</span>' +
        '</div>';
      }).join('');
    }
    function toBottom() { thread.scrollTop = thread.scrollHeight; }
    function typing(on) {
      var node = qs('[data-chat-typing]', host);
      if (on && !node) {
        msgs.insertAdjacentHTML('beforeend',
          '<div class="msg msg--in" data-chat-typing>' +
            '<span class="msg__ava msg__ava--tail" aria-hidden="true"></span>' +
            '<span class="msg__bubble msg__bubble--typing" role="status" aria-label="' +
              esc(t('chat.typing')) + '"><i></i><i></i><i></i></span>' +
          '</div>');
        toBottom();
      }
      if (!on && node) node.remove();
    }
    function answer(text) {
      /* Что ответить, решает то, чего в переписке ещё не хватает: сначала —
         как с человеком связаться, дальше — подтверждение и график. */
      var digits = (text.match(/\d/g) || []).length;
      if (digits >= 10) { chat.gotPhone = true; return t('chat.replyPhone'); }
      if (!chat.asked) { chat.asked = true; return t('chat.replyAsk'); }
      return t(chatOpenNow() ? 'chat.replyDay' : 'chat.replyNight');
    }
    function send(text) {
      text = String(text).trim();
      if (!text) return;
      chat.msgs.push({ who: 'out', text: text, time: chatTime(new Date()) });
      draw();
      chips.hidden = true;
      toBottom();
      typing(true);
      setTimeout(function () {
        typing(false);
        chat.msgs.push({ who: 'in', text: answer(text), time: chatTime(new Date()) });
        if (!qs('[data-chat-msgs]')) return;   /* панель успели закрыть */
        draw();
        toBottom();
      }, 900);
    }

    draw();
    var started = chat.msgs.some(function (m) { return m.who === 'out'; });
    chips.hidden = started;
    /* Начатую переписку открываем на последней реплике, новую — с приветствия:
       иначе первое, что видит человек, — конец списка мессенджеров под ней. */
    if (started) toBottom();

    host.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-chat-chip]');
      if (chip) { send(chip.textContent); return; }
    });
    qs('[data-chat-form]', host).addEventListener('submit', function (e) {
      e.preventDefault();
      send(input.value);
      input.value = '';
      input.style.height = 'auto';
      input.focus();
    });
    /* Enter отправляет, Shift+Enter переносит строку — привычка мессенджера.
       На телефоне экранная клавиатура шлёт enter только явной кнопкой. */
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        qs('[data-chat-form]', host).requestSubmit();
      }
    });
    /* Поле растёт до четырёх строк, дальше прокручивается внутри себя */
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 112) + 'px';
    });
    if (window.matchMedia('(min-width: 768px)').matches) input.focus();
  }

  /* Избранное: список отложенного с настоящими ценами текущего города вылета.
     Пустое состояние объясняет, откуда там что берётся, и уводит в поиск —
     тупика «здесь ничего нет» быть не должно. */
  function openFavorites() {
    var ids = state.favorites.slice();
    var body;
    if (!ids.length) {
      body =
        '<div class="panel__empty">' +
          '<span class="panel__emptyIco">' + icon('heart') + '</span>' +
          '<b class="t-h5">' + esc(t('fav.empty')) + '</b>' +
          '<p>' + esc(t('fav.emptyLead')) + '</p>' +
          '<a class="btn btn--lime" href="index.html#search-form" data-panel-close>' +
            esc(t('fav.emptyBtn')) + '</a>' +
        '</div>';
    } else {
      var tours = Data.build(state.city);
      var byId = {};
      tours.forEach(function (x) { byId[x.id] = x; });
      body =
        '<p class="panel__lead">' + esc(t('fav.count', { n: ids.length })) + '</p>' +
        '<div class="fav-list">' + ids.map(function (id) {
          /* Строки со страницы отеля в наборе выдачи не лежат: они считаются
             от «отель + город + дата + ночи» и восстанавливаются по id. Без
             этого всё, отмеченное в списке предложений, сразу показывалось бы
             как пропавшее. */
          var x = byId[id] || Data.offerById(id);
          if (!x) {
            return '<div class="fav-row fav-row--gone"><span class="fav-row__text">' +
              '<b>' + esc(t('fav.gone')) + '</b></span>' +
              '<button class="btn-icon fav-row__x" type="button" data-unfav="' + esc(id) + '" ' +
              'aria-label="' + esc(t('fav.remove')) + '">' + icon('close') + '</button></div>';
          }
          var h = Data.hotel(x.hotelId);
          var c = Data.country(x.countryId), r = Data.resort(x.countryId, x.resortId);
          return '<div class="fav-row">' +
            '<span class="fav-row__media">' + tourPhoto(x) + '</span>' +
            '<span class="fav-row__text">' +
              '<b>' + esc(h.name) + '</b>' +
              '<span class="t-meta">' + esc(nm(r.name) + ', ' + nm(c.name)) + '</span>' +
              '<span class="t-meta">' + Fmt.range(x.date, x.nights) + ' · ' + Fmt.nights(x.nights) + '</span>' +
            '</span>' +
            '<span class="fav-row__side">' +
              '<b class="t-price">' + Fmt.money(x.price) + '</b>' +
              '<button class="btn-icon fav-row__x" type="button" data-unfav="' + esc(id) + '" ' +
                'aria-label="' + esc(t('fav.remove')) + '">' + icon('close') + '</button>' +
            '</span>' +
          '</div>';
        }).join('') + '</div>';
    }
    var foot = ids.length
      ? '<a class="btn btn--ghost" href="search.html?' + paramsToQuery(defaults()) + '">' +
          esc(t('fav.all')) + '</a>'
      : '';
    var host = panel(t('fav.title'), body, foot);
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-unfav]');
      if (!b) return;
      toggleFav(b.getAttribute('data-unfav'));
      qsa('[data-fav="' + b.getAttribute('data-unfav') + '"]').forEach(function (n) {
        n.setAttribute('aria-pressed', 'false');
      });
      openFavorites();
    });
  }

  /* Личный кабинет: вход по номеру — то, как это работает у казахстанских
     сервисов. Разделы названы, но помечены «после входа»: обещать готовый
     кабинет в макете нечестно. */
  function openProfile() {
    var link = function (ico, name) {
      return '<span class="chan chan--off">' +
        '<span class="chan__ico">' + icon(ico) + '</span>' +
        '<span class="chan__text"><b>' + esc(name) + '</b><span>' + esc(t('prof.soon')) + '</span></span>' +
      '</span>';
    };
    var host = panel(t('prof.title'),
      '<p class="panel__lead">' + esc(t('prof.lead')) + '</p>' +
      '<form class="panel__form" data-prof-form novalidate>' +
        '<label class="field">' +
          '<span class="field__label">' + esc(t('prof.phone')) + '</span>' +
          '<span class="field__control">' + icon('phone') +
            '<input class="field__input" type="tel" data-prof-phone ' +
            'placeholder="' + esc(t('prof.phonePh')) + '" autocomplete="tel"></span>' +
          '<span class="field__hint" data-prof-hint role="status"></span>' +
        '</label>' +
      '</form>' +
      '<div class="chan-list chan-list--muted">' +
        link('doc', t('prof.orders')) +
        link('luggage', t('prof.booked')) +
        link('percent', t('prof.subs')) +
      '</div>',
      '<button class="btn btn--primary" type="button" data-prof-send>' + esc(t('prof.get')) + '</button>');

    qs('[data-prof-send]', host).addEventListener('click', function () {
      var input = qs('[data-prof-phone]', host);
      var hint = qs('[data-prof-hint]', host);
      if (input.value.replace(/\D/g, '').length < 10) {
        hint.textContent = t('prof.err');
        hint.closest('.field').classList.add('field--error');
        input.focus();
        return;
      }
      closePanel();
      toast(t('prof.ok'));
    });
  }

  /* --- параметры поиска: одна модель для формы, адреса и выдачи ----------- */
  function defaults() {
    var start = Fmt.addDays(new Date(), 14);
    return {
      tab: 'tours',
      from: state.city,
      to: '',
      date: Fmt.toISO(start),
      dateEnd: '',
      flex: false,
      nightsMin: 7,
      nightsMax: 10,
      adults: 2,
      kids: []
    };
  }
  function paramsFromURL(search) {
    var p = new URLSearchParams(search === undefined ? location.search : search);
    var d = defaults();
    if (p.get('from') && Data.byId(Data.CITIES, p.get('from'))) d.from = p.get('from');
    if (p.get('to')) d.to = p.get('to');
    if (p.get('date')) d.date = p.get('date');
    if (p.get('dateEnd')) d.dateEnd = p.get('dateEnd');
    if (p.get('flex') === '1') d.flex = true;
    var n = (p.get('nights') || '').split('-');
    if (n.length === 2) { d.nightsMin = +n[0] || 7; d.nightsMax = +n[1] || 10; }
    if (p.get('adults')) d.adults = Math.max(1, Math.min(6, +p.get('adults') || 2));
    if (p.get('kids')) d.kids = p.get('kids').split(',').map(Number).filter(function (x) { return !isNaN(x); });
    if (p.get('tab')) d.tab = p.get('tab');
    return d;
  }
  function paramsToQuery(prm, extra) {
    var p = new URLSearchParams();
    p.set('from', prm.from);
    if (prm.to) p.set('to', prm.to);
    p.set('date', prm.date);
    if (prm.dateEnd) p.set('dateEnd', prm.dateEnd);
    if (prm.flex) p.set('flex', '1');
    p.set('nights', prm.nightsMin + '-' + prm.nightsMax);
    p.set('adults', String(prm.adults));
    if (prm.kids.length) p.set('kids', prm.kids.join(','));
    if (prm.tab && prm.tab !== 'tours') p.set('tab', prm.tab);
    if (extra) Object.keys(extra).forEach(function (k) {
      if (extra[k] !== '' && extra[k] !== null && extra[k] !== undefined) p.set(k, extra[k]);
    });
    if (I18N.current !== 'ru') p.set('lang', I18N.current);
    return p.toString();
  }

  /* Куда: 'tr' — страна, 'tr:antalya' — курорт */
  function destLabel(to) {
    if (!to) return '';
    var parts = to.split(':');
    var c = Data.country(parts[0]);
    if (!c) return '';
    if (parts[1]) {
      var r = Data.resort(parts[0], parts[1]);
      return r ? nm(r.name) + ', ' + nm(c.name) : nm(c.name);
    }
    return nm(c.name);
  }
  function guestsLabel(prm) {
    var s = prm.adults + ' ' + t('g.adults');
    if (prm.kids.length) s += ' · ' + prm.kids.length + ' ' + t('g.kids');
    return s;
  }
  function summaryLine(prm) {
    var city = nm(Data.city(prm.from).name);
    var dest = destLabel(prm.to) || t('f.toPlaceholder');
    var dates = Fmt.range(prm.date, prm.nightsMin);
    /* Каждый разделитель склеен со своим значением в одну ячейку. Голым текстом
       между <b> он становился отдельным элементом флекса и при переносе строки
       на телефоне оставался висеть в конце — «…отель ·» и пустота. */
    var part = function (sep, val) { return '<span><i>' + sep + '</i><b>' + val + '</b></span>'; };
    /* Пустой элемент — управляемое место переноса: на телефоне строка рвётся
       именно здесь, маршрут отдельно, срок и туристы отдельно. */
    return '<b>' + esc(city) + '</b>' +
      part('→', esc(dest)) +
      '<i class="summary-br" aria-hidden="true"></i>' +
      part('·', dates) +
      part('·', Fmt.nights(prm.nightsMin)) +
      part('·', esc(guestsLabel(prm)));
  }

  /* ==========================================================================
     Поисковый модуль. Один класс на обе страницы: на главной он широкий и
     лежит на фотографии, в выдаче — раскрывается кнопкой «Изменить».
     ======================================================================== */
  function SearchForm(root, params, onSubmit) {
    this.root = root;
    this.p = params;
    this.onSubmit = onSubmit;
    this.render();
    this.bind();
  }

  SearchForm.prototype.render = function () {
    var p = this.p;
    var tabs = [['tours', 'tab.tours'], ['hot', 'tab.hot'], ['hotels', 'tab.hotels'], ['excursions', 'tab.excursions']];

    /* Ряда быстрых сценариев под формой нет намеренно: он повторял фильтры
       выдачи и подборки, а на первом экране перебивал главное действие. */
    this.root.innerHTML =
      '<div class="search__tabs" role="tablist" aria-label="' + esc(t('tab.tours')) + '">' +
        tabs.map(function (x) {
          return '<button class="tab" type="button" role="tab" data-tab="' + x[0] + '" ' +
            'aria-selected="' + (p.tab === x[0]) + '">' + esc(t(x[1])) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="search__row">' +
        this.fieldCity() + this.fieldDest() + this.fieldDates() + this.fieldNights() + this.fieldGuests() +
        '<button class="btn btn--lime btn--lg search__submit" type="submit" data-submit>' +
          esc(t('f.search')) + '</button>' +
      '</div>';
  };

  SearchForm.prototype.fieldCity = function () {
    var p = this.p;
    var list = Data.CITIES.slice().sort(function (a, b) { return (b.main ? 1 : 0) - (a.main ? 1 : 0); });
    return '<div class="field" data-field="from">' +
      '<span class="field__label">' + esc(t('f.from')) + '</span>' +
      '<button class="field__control field__control--btn" type="button" aria-haspopup="listbox" aria-expanded="false">' +
        icon('plane-up') +
        '<span class="field__value" data-value>' + esc(nm(Data.city(p.from).name)) + '</span>' +
        icon('chev-d') +
      '</button>' +
      '<div class="pop" role="listbox">' +
        '<div class="fsearch">' + icon('search') +
          '<input type="text" data-filter placeholder="' + esc(t('flt.searchIn')) + '" aria-label="' + esc(t('flt.searchIn')) + '">' +
        '</div>' +
        '<div class="pop__group" data-list>' +
          list.map(function (c) {
            return '<button class="pop__opt" type="button" role="option" data-city="' + c.id + '" ' +
              'aria-selected="' + (c.id === p.from) + '"><span>' + esc(nm(c.name)) + '</span><small>' + c.code + '</small></button>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  };

  /* Сенсорный ввод определяем по типу указателя, а не по ширине окна: на
     планшете с мышью клавиатуре взяться неоткуда, а на узком ноутбуке она
     не нужна. Проверяем каждый раз заново — окно можно перетащить на другой
     экран, да и режим эмуляции в браузере меняется на ходу. */
  function isTouch() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  SearchForm.prototype.fieldDest = function () {
    var p = this.p;
    /* На касании поле открывается «только для чтения»: список выпадает, а
       клавиатура — нет. Она поднимется вторым касанием, когда человек и
       правда собрался печатать, а не просто выбрать страну из списка. */
    return '<div class="field" data-field="to">' +
      '<span class="field__label">' + esc(t('f.to')) + '</span>' +
      '<div class="field__control">' + icon('pin') +
        '<input class="field__input" type="text" data-dest-input autocomplete="off" ' +
          (isTouch() ? 'readonly ' : '') +
          'placeholder="' + esc(t('f.toPlaceholder')) + '" aria-label="' + esc(t('f.to')) + '" ' +
          'value="' + esc(destLabel(p.to)) + '">' +
      '</div>' +
      '<div class="pop" data-dest-pop></div>' +
    '</div>';
  };

  SearchForm.prototype.fieldDates = function () {
    var p = this.p;
    return '<div class="field" data-field="date">' +
      '<span class="field__label">' + esc(t('f.dates')) + '</span>' +
      '<button class="field__control field__control--btn" type="button" aria-expanded="false">' +
        icon('calendar') +
        '<span class="field__value" data-value>' + Fmt.dayMonthFull(p.date) + (p.flex ? ' ' + t('f.plusMinus') : '') + '</span>' +
      '</button>' +
      '<div class="pop" data-cal></div>' +
    '</div>';
  };

  SearchForm.prototype.fieldNights = function () {
    var p = this.p;
    return '<div class="field" data-field="nights">' +
      '<span class="field__label">' + esc(t('f.nights')) + '</span>' +
      '<button class="field__control field__control--btn" type="button" aria-expanded="false">' +
        icon('moon') +
        '<span class="field__value" data-value>' + p.nightsMin + '–' + p.nightsMax + '</span>' +
      '</button>' +
      '<div class="pop" data-nights>' +
        '<div class="pop__title">' + esc(t('f.nights')) + '</div>' +
        '<div class="range" data-range="nights">' +
          '<div class="range__vals"><span data-lo>' + p.nightsMin + '</span><span data-hi>' + p.nightsMax + '</span></div>' +
          '<div class="range__track">' +
            '<div class="range__rail"></div><div class="range__fill" data-fill></div>' +
            '<input type="range" min="1" max="21" value="' + p.nightsMin + '" data-lo-input aria-label="' + esc(t('flt.from')) + '">' +
            '<input type="range" min="1" max="21" value="' + p.nightsMax + '" data-hi-input aria-label="' + esc(t('flt.to')) + '">' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  };

  SearchForm.prototype.fieldGuests = function () {
    var p = this.p;
    return '<div class="field" data-field="guests">' +
      '<span class="field__label">' + esc(t('f.guests')) + '</span>' +
      '<button class="field__control field__control--btn" type="button" aria-expanded="false">' +
        icon('users') +
        '<span class="field__value" data-value>' + esc(guestsLabel(p)) + '</span>' +
      '</button>' +
      '<div class="pop pop--right" data-guests></div>' +
    '</div>';
  };

  /* --- поведение полей --------------------------------------------------- */
  SearchForm.prototype.bind = function () {
    var self = this;
    var root = this.root;

    root.addEventListener('click', function (e) {
      var opener = e.target.closest('.field__control');
      if (opener && root.contains(opener)) {
        var field = opener.closest('.field');
        var open = field.getAttribute('data-open') === 'true';
        var di = qs('[data-dest-input]', opener);
        if (di) {
          /* «Куда» — единственное поле, которое открывается ещё и от фокуса.
             Раньше клик приходил следом и видел уже открытую панель, считал
             это вторым нажатием и закрывал её: список выпадал и тут же
             исчезал, приходилось жать дважды. Клик в пределах того же
             касания пропускаем. */
          if (Date.now() - (self.destAt || 0) < 400) return;
          if (!open) { self.closeAll(); self.open(field); return; }
          /* Список уже открыт — значит это второе нажатие, и человек хочет
             печатать. Снимаем «только чтение», клавиатура поднимается. */
          if (di.hasAttribute('readonly')) { di.removeAttribute('readonly'); di.focus(); }
          return;
        }
        self.closeAll();
        if (!open) self.open(field);
        return;
      }
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        self.p.tab = tab.getAttribute('data-tab');
        qsa('[data-tab]', root).forEach(function (b) {
          b.setAttribute('aria-selected', String(b === tab));
        });
        return;
      }
      var cityBtn = e.target.closest('[data-city]');
      if (cityBtn) {
        self.p.from = cityBtn.getAttribute('data-city');
        saveCity(self.p.from);
        self.refreshValues();
        self.closeAll();
        return;
      }
      var sub = e.target.closest('[data-submit]');
      if (sub) { e.preventDefault(); self.submit(); }
    });

    root.addEventListener('input', function (e) {
      if (e.target.matches('[data-filter]')) {
        var v = e.target.value.trim().toLowerCase();
        qsa('[data-city]', root).forEach(function (b) {
          b.hidden = v && b.textContent.toLowerCase().indexOf(v) === -1;
        });
      }
      if (e.target.matches('[data-dest-input]')) self.renderDest(e.target.value);
    });

    root.addEventListener('focusin', function (e) {
      if (e.target.matches('[data-dest-input]')) {
        var f = e.target.closest('.field');
        self.destAt = Date.now();
        self.closeAll();
        self.open(f);
        self.renderDest(e.target.value);
      }
    });

    /* Ушли из поля — снова «только чтение». Без этого следующее касание
       поднимало бы клавиатуру сразу, с первого раза. */
    root.addEventListener('focusout', function (e) {
      if (isTouch() && e.target.matches('[data-dest-input]')) {
        e.target.setAttribute('readonly', 'readonly');
      }
    });

    root.addEventListener('submit', function (e) { e.preventDefault(); self.submit(); });

    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) self.closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') self.closeAll();
    });
  };

  SearchForm.prototype.open = function (field) {
    field.setAttribute('data-open', 'true');
    var ctrl = qs('.field__control', field);
    if (ctrl && ctrl.hasAttribute('aria-expanded')) ctrl.setAttribute('aria-expanded', 'true');
    var key = field.getAttribute('data-field');
    if (key === 'date') this.renderCal(field);
    if (key === 'guests') this.renderGuests(field);
    if (key === 'nights') this.bindRange(field);
    if (key === 'to') this.renderDest(qs('[data-dest-input]', field).value);
    var first = qs('input, button', qs('.pop', field));
    if (first && key !== 'to') setTimeout(function () { first.focus(); }, 0);
  };
  SearchForm.prototype.closeAll = function () {
    qsa('.field[data-open="true"]', this.root).forEach(function (f) {
      f.removeAttribute('data-open');
      var c = qs('.field__control', f);
      if (c && c.hasAttribute('aria-expanded')) c.setAttribute('aria-expanded', 'false');
    });
    /* Поле закрылось — возвращаем «только чтение», чтобы следующее касание
       снова открыло список без клавиатуры. Кроме поля под курсором: закрытие
       случается и в ответ на фокус, а снимать возможность печатать у того,
       кто только что её попросил, значит гасить клавиатуру на полпути. */
    if (isTouch()) {
      qsa('[data-dest-input]', this.root).forEach(function (i) {
        if (i !== document.activeElement) i.setAttribute('readonly', 'readonly');
      });
    }
  };

  SearchForm.prototype.refreshValues = function () {
    var p = this.p, root = this.root;
    var set = function (field, html) {
      var v = qs('.field[data-field="' + field + '"] [data-value]', root);
      if (v) v.innerHTML = html;
    };
    set('from', esc(nm(Data.city(p.from).name)));
    set('date', Fmt.dayMonthFull(p.date) + (p.flex ? ' ' + t('f.plusMinus') : ''));
    set('nights', p.nightsMin + '–' + p.nightsMax);
    set('guests', esc(guestsLabel(p)));
    var di = qs('[data-dest-input]', root);
    if (di) di.value = destLabel(p.to);
    qsa('[data-city]', root).forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-city') === p.from));
    });
  };

  /* Автокомплит направления: популярные до ввода, группировка и подсветка */
  SearchForm.prototype.renderDest = function (query) {
    var pop = qs('[data-dest-pop]', this.root);
    if (!pop) return;
    var q = (query || '').trim().toLowerCase();
    var self = this;
    var mark = function (text) {
      if (!q) return esc(text);
      var i = text.toLowerCase().indexOf(q);
      if (i === -1) return esc(text);
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
    };
    var tours = Data.build(this.p.from);
    var mins = Data.minByCountry(tours);

    var countries = Data.COUNTRIES.filter(function (c) {
      return !q || nm(c.name).toLowerCase().indexOf(q) !== -1;
    });
    var resorts = [];
    Data.COUNTRIES.forEach(function (c) {
      c.resorts.forEach(function (r) {
        if (q && nm(r.name).toLowerCase().indexOf(q) !== -1) resorts.push({ c: c, r: r });
      });
    });
    var hotels = q ? Data.HOTELS.filter(function (h) { return h.name.toLowerCase().indexOf(q) !== -1; }) : [];

    var html = '';
    if (!q) {
      var pop6 = ['tr', 'eg', 'ae', 'th', 'cn', 'kz'];
      html += '<div class="pop__group"><div class="pop__title">' + esc(t('f.popular')) + '</div>' +
        pop6.map(function (id) {
          var c = Data.country(id);
          return '<button class="pop__opt" type="button" data-dest="' + id + '"><span>' + esc(nm(c.name)) + '</span>' +
            (mins[id] ? '<small>' + t('price.from', { sum: Fmt.money(mins[id]) }) + '</small>' : '') + '</button>';
        }).join('') + '</div>';
    }
    if (countries.length) {
      html += '<div class="pop__group"><div class="pop__title">' + esc(t('f.countries')) + '</div>' +
        countries.slice(0, 8).map(function (c) {
          return '<button class="pop__opt" type="button" data-dest="' + c.id + '"><span>' + mark(nm(c.name)) + '</span>' +
            (mins[c.id] ? '<small>' + t('price.from', { sum: Fmt.money(mins[c.id]) }) + '</small>' : '') + '</button>';
        }).join('') + '</div>';
    }
    if (resorts.length) {
      html += '<div class="pop__group"><div class="pop__title">' + esc(t('f.resorts')) + '</div>' +
        resorts.slice(0, 8).map(function (x) {
          return '<button class="pop__opt" type="button" data-dest="' + x.c.id + ':' + x.r.id + '">' +
            '<span>' + mark(nm(x.r.name)) + '</span><small>' + esc(nm(x.c.name)) + '</small></button>';
        }).join('') + '</div>';
    }
    if (hotels.length) {
      html += '<div class="pop__group"><div class="pop__title">' + esc(t('f.hotelsGroup')) + '</div>' +
        hotels.slice(0, 6).map(function (h) {
          return '<button class="pop__opt" type="button" data-dest="' + h.c + ':' + h.r + '">' +
            '<span>' + mark(h.name) + '</span><small>' + esc(nm(Data.country(h.c).name)) + '</small></button>';
        }).join('') + '</div>';
    }
    if (!html) html = '<div class="pop__group"><p class="t-meta">' + esc(t('f.nothing')) + '</p></div>';
    pop.innerHTML = html;

    qsa('[data-dest]', pop).forEach(function (b) {
      b.addEventListener('click', function () {
        self.p.to = b.getAttribute('data-dest');
        self.refreshValues();
        self.closeAll();
      });
    });
  };

  /* Календарь с ценами по дням и подсветкой минимума */
  SearchForm.prototype.renderCal = function (field) {
    var self = this, p = this.p;
    var pop = qs('[data-cal]', field);
    var base = Fmt.parseISO(p.date);
    var monthsToShow = [new Date(base.getFullYear(), base.getMonth(), 1),
                        new Date(base.getFullYear(), base.getMonth() + 1, 1)];
    var countryId = (p.to || 'tr').split(':')[0];
    var today = new Date(); today.setHours(0, 0, 0, 0);

    /* цены по дням двух месяцев — из того же генератора, что и выдача */
    var prices = {}, min = Infinity;
    monthsToShow.forEach(function (m) {
      var days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (var d = 1; d <= days; d++) {
        var date = new Date(m.getFullYear(), m.getMonth(), d);
        if (date < today) continue;
        var iso = Fmt.toISO(date);
        var row = Data.daysLow(p.from, countryId, iso, 1)[0];
        prices[iso] = row.price;
        if (row.price < min) min = row.price;
      }
    });

    function monthHTML(m) {
      var y = m.getFullYear(), mo = m.getMonth();
      var first = new Date(y, mo, 1);
      var shift = (first.getDay() + 6) % 7;              /* неделя с понедельника */
      var days = new Date(y, mo + 1, 0).getDate();
      var cells = '';
      for (var i = 0; i < shift; i++) cells += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var date = new Date(y, mo, d), iso = Fmt.toISO(date);
        var past = date < today;
        var pr = prices[iso];
        var sel = iso === p.date ? 'edge' : '';
        cells += '<button class="cal__day" type="button" data-date="' + iso + '"' +
          (past ? ' disabled' : '') +
          (sel ? ' data-sel="' + sel + '"' : '') +
          (pr && pr === min ? ' data-min="true"' : '') + '>' +
          d + (pr ? '<small>' + Math.round(pr / 1000) + 'к</small>' : '') + '</button>';
      }
      var dow = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map(function (x) {
        return '<span class="cal__dow">' + x + '</span>';
      }).join('');
      return '<div><div class="cal__head"><span>' + esc(Fmt.monthName(mo)) + ' ' + y + '</span></div>' +
        '<div class="cal__grid">' + dow + cells + '</div></div>';
    }

    pop.innerHTML =
      '<div class="cal">' + monthsToShow.map(monthHTML).join('') + '</div>' +
      '<div class="pop__foot">' +
        '<label class="check"><input type="checkbox" data-flex' + (p.flex ? ' checked' : '') + '>' +
          '<span class="check__box">' + icon('check') + '</span><span>' + esc(t('f.plusMinus')) + '</span></label>' +
        '<div class="row">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-preset="3">' + esc(t('f.presetNear')) + '</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-preset="7">' + esc(t('f.presetWeek')) + '</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-preset="14">' + esc(t('f.presetTwoWeeks')) + '</button>' +
        '</div>' +
      '</div>';

    qsa('[data-date]', pop).forEach(function (b) {
      b.addEventListener('click', function () {
        p.date = b.getAttribute('data-date');
        self.refreshValues();
        self.closeAll();
      });
    });
    qsa('[data-preset]', pop).forEach(function (b) {
      b.addEventListener('click', function () {
        p.date = Fmt.toISO(Fmt.addDays(new Date(), +b.getAttribute('data-preset')));
        self.refreshValues();
        self.closeAll();
      });
    });
    var flex = qs('[data-flex]', pop);
    if (flex) flex.addEventListener('change', function () { p.flex = flex.checked; self.refreshValues(); });
  };

  SearchForm.prototype.renderGuests = function (field) {
    var self = this, p = this.p;
    var pop = qs('[data-guests]', field);
    function row(label, value, key, min, max) {
      return '<div class="stepper"><span>' + esc(label) + '</span><span class="stepper__ctrl">' +
        '<button class="stepper__btn" type="button" data-dec="' + key + '"' + (value <= min ? ' disabled' : '') +
          ' aria-label="−">' + icon('minus') + '</button>' +
        '<span class="stepper__val">' + value + '</span>' +
        '<button class="stepper__btn" type="button" data-inc="' + key + '"' + (value >= max ? ' disabled' : '') +
          ' aria-label="+">' + icon('plus') + '</button>' +
      '</span></div>';
    }
    var kidsAges = p.kids.map(function (age, i) {
      return '<label class="check"><span>' + esc(t('f.kidAge')) + ' ' + (i + 1) + '</span></label>' +
        '<select class="select" data-kid="' + i + '" aria-label="' + esc(t('f.kidAge')) + '">' +
          Array.from({ length: 17 }, function (_, a) {
            return '<option value="' + a + '"' + (a === age ? ' selected' : '') + '>' + a + '</option>';
          }).join('') +
        '</select>';
    }).join('');

    pop.innerHTML =
      row(t('f.adults'), p.adults, 'adults', 1, 6) +
      row(t('f.kids'), p.kids.length, 'kids', 0, 4) +
      (p.kids.length ? '<div class="pop__group">' + kidsAges + '</div>' : '') +
      '<div class="pop__foot"><span class="t-meta">' + esc(t('card.perTwo')) + '</span>' +
        '<button class="btn btn--primary btn--sm" type="button" data-close>' + esc(t('f.apply')) + '</button></div>';

    qsa('[data-inc], [data-dec]', pop).forEach(function (b) {
      b.addEventListener('click', function () {
        var inc = b.hasAttribute('data-inc');
        var key = b.getAttribute(inc ? 'data-inc' : 'data-dec');
        if (key === 'adults') p.adults = Math.max(1, Math.min(6, p.adults + (inc ? 1 : -1)));
        else {
          if (inc && p.kids.length < 4) p.kids.push(7);
          if (!inc && p.kids.length) p.kids.pop();
        }
        self.renderGuests(field);
        self.refreshValues();
      });
    });
    qsa('[data-kid]', pop).forEach(function (s) {
      s.addEventListener('change', function () { p.kids[+s.getAttribute('data-kid')] = +s.value; self.refreshValues(); });
    });
    var close = qs('[data-close]', pop);
    if (close) close.addEventListener('click', function () { self.closeAll(); });
  };

  SearchForm.prototype.bindRange = function (field) {
    var self = this, p = this.p;
    var box = qs('[data-range="nights"]', field);
    if (!box || box.dataset.bound) return;
    box.dataset.bound = '1';
    var lo = qs('[data-lo-input]', box), hi = qs('[data-hi-input]', box);
    var loOut = qs('[data-lo]', box), hiOut = qs('[data-hi]', box), fill = qs('[data-fill]', box);
    function sync() {
      var a = Math.min(+lo.value, +hi.value), b = Math.max(+lo.value, +hi.value);
      p.nightsMin = a; p.nightsMax = b;
      loOut.textContent = a; hiOut.textContent = b;
      var min = +lo.min, max = +lo.max;
      fill.style.left = ((a - min) / (max - min) * 100) + '%';
      fill.style.width = ((b - a) / (max - min) * 100) + '%';
      self.refreshValues();
    }
    lo.addEventListener('input', sync);
    hi.addEventListener('input', sync);
    sync();
  };

  SearchForm.prototype.submit = function () {
    if (this.onSubmit) { this.onSubmit(this.p); return; }
    location.href = 'search.html?' + paramsToQuery(this.p);
  };

  /* ==========================================================================
     Отрисовка карточек
     ======================================================================== */
  function starsHTML(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += icon('star');
    return '<span class="stars" aria-label="' + n + '★">' + s + '</span>';
  }
  function photo(name, alt, caption) {
    if (name) return '<img src="assets/img/' + name + '.webp" alt="' + esc(alt) + '" loading="lazy" decoding="async">';
    /* Снимка нет — ставим #EAEBED с подписью места, а не градиент: DESIGN.md */
    return '<div class="photo-stub">' + icon('pin') +
      (caption ? '<b>' + esc(caption) + '</b>' : '') + '</div>';
  }
  function tourPhoto(tour) {
    var h = Data.hotel(tour.hotelId);
    var r = Data.resort(tour.countryId, tour.resortId);
    return photo(h.img, h.name, nm(r.name) + ', ' + nm(Data.country(tour.countryId).name));
  }

  /* --- Снимки внутри карточки --------------------------------------------
     Лента кадров, которую листают, не уходя со страницы: на телефоне пальцем,
     на десктопе стрелками, что выходят по наведению. Под лентой — точки,
     они же говорят, сколько кадров всего.

     Сделано штатной прокруткой со snap, а не переносом слайдов скриптом:
     инерция, отмена жеста на полпути и возврат к ближайшему кадру достаются
     от браузера и работают там ровно так, как ожидает палец. */
  var SHOTS_MAX = 5;

  function cardShots(tour) {
    var h = Data.hotel(tour.hotelId);
    var r = Data.resort(tour.countryId, tour.resortId);
    var caption = nm(r.name) + ', ' + nm(Data.country(tour.countryId).name);
    var list = Data.gallery(tour.hotelId).slice(0, SHOTS_MAX);
    /* Кадров нет вовсе — остаётся заглушка, и листать нечего. */
    if (!list.length) return photo('', h.name, caption);

    return '<div class="shots" data-shots>' +
      '<div class="shots__track" data-shots-track>' +
        list.map(function (name, i) {
          return '<div class="shots__item">' +
            '<img src="assets/img/' + name + '.webp" alt="' + esc(h.name) + '" ' +
            'loading="lazy" decoding="async"' + (i ? '' : ' fetchpriority="low"') + '>' +
          '</div>';
        }).join('') +
      '</div>' +
      (list.length > 1
        ? '<button class="shots__nav shots__nav--prev" type="button" data-card-shot="-1" ' +
            'aria-label="' + esc(t('card.shotPrev')) + '">' + icon('chev-l') + '</button>' +
          '<button class="shots__nav shots__nav--next" type="button" data-card-shot="1" ' +
            'aria-label="' + esc(t('card.shotNext')) + '">' + icon('chev-r') + '</button>' +
          '<div class="shots__dots" data-shot-dots>' +
            list.map(function (x, i) {
              return '<button type="button" data-card-shot-to="' + i + '"' + (i ? '' : ' data-on="true"') + ' ' +
                'aria-label="' + esc(t('card.shotN', { n: i + 1 })) + '"></button>';
            }).join('') +
          '</div>'
        : '') +
    '</div>';
  }

  /* Точки ведутся от самой прокрутки, а не от нажатий: жест пальцем и клик по
     стрелке приводят к одному и тому же событию, и считать позицию дважды не
     нужно. Слушатель один на документ — карточки перерисовываются при смене
     языка, валюты и фильтров, и переподписываться было бы не на что. */
  function syncShots(track) {
    var box = track.parentNode;
    var dots = qsa('[data-shot-dots] > *', box);
    if (!dots.length) return;
    var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    dots.forEach(function (d, k) {
      if (k === i) d.setAttribute('data-on', 'true'); else d.removeAttribute('data-on');
    });
  }

  function initShots() {
    document.addEventListener('scroll', function (e) {
      var t2 = e.target;
      if (t2 && t2.nodeType === 1 && t2.hasAttribute && t2.hasAttribute('data-shots-track')) syncShots(t2);
    }, true);

    document.addEventListener('click', function (e) {
      var step = e.target.closest('[data-card-shot]');
      if (step) {
        e.preventDefault();
        e.stopPropagation();
        var tr = qs('[data-shots-track]', step.parentNode);
        tr.scrollBy({ left: tr.clientWidth * Number(step.getAttribute('data-card-shot')), behavior: 'smooth' });
        return;
      }
      var to = e.target.closest('[data-card-shot-to]');
      if (to) {
        e.preventDefault();
        e.stopPropagation();
        var tr2 = qs('[data-shots-track]', to.closest('[data-shots]'));
        tr2.scrollTo({ left: tr2.clientWidth * Number(to.getAttribute('data-card-shot-to')), behavior: 'smooth' });
      }
    }, true);
  }

  function priceBlock(tour, opts) {
    opts = opts || {};
    /* Скидка не красит цену: её называют старая цена рядом и плашка процента */
    var html = '<span class="t-price' + (opts.min ? ' min-mark' : '') + '">' + Fmt.money(tour.price) + '</span>';
    if (tour.oldPrice) html += '<s class="t-price--old">' + Fmt.money(tour.oldPrice) + '</s>';
    return html;
  }

  function badges(tour) {
    var out = [];
    /* Лайм — только срочность: горящий тур. Остальные плашки нейтральные,
       иначе кислотный перестаёт что-либо значить (DESIGN.md, правило пятна).
       Слово «Горящий» снято: огонь говорит то же самое, а считают здесь
       процент. Знак — эмодзи, а не иконка обводкой: на 12 пикселях цветной
       символ виден, полуторапиксельная линия — нет. Для экранного диктора
       слово осталось скрытым текстом.
       «Мгновенное подтверждение» с карточки убрано: на витрине оно занимало
       вторую плашку и уводило внимание от цены, а решает его человек уже на
       шаге брони. Признак остался фильтром выдачи. */
    if (tour.hot) {
      out.push('<span class="badge-hot">' +
        '<span class="badge-hot__sign" aria-hidden="true">🔥</span>' +
        '<span class="u-visually-hidden">' + esc(t('card.hot')) + '</span>' +
        '−' + tour.discount + '%</span>');
    } else if (tour.discount) {
      out.push('<span class="badge-plain">−' + tour.discount + '%</span>');
    }
    return out.join('');
  }

  function ratingHTML(hotel) {
    return '<span class="rate-value" itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">' +
        Fmt.ratingNum(hotel.rate) +
        '<meta itemprop="ratingValue" content="' + hotel.rate + '">' +
        '<meta itemprop="bestRating" content="10">' +
        '<meta itemprop="reviewCount" content="' + hotel.rev + '">' +
      '</span>' +
      '<span class="rate-word">' + esc(Fmt.rating(hotel.rate)) + ' · ' + t('card.reviews', { n: hotel.rev }) + '</span>';
  }

  /* Цена в микроразметке всегда в тенге: переключатель валюты — витрина,
     а предложение выражено в валюте расчёта. */
  function offerMeta(tour) {
    return '<span itemprop="offers" itemscope itemtype="https://schema.org/Offer">' +
      '<meta itemprop="price" content="' + tour.price + '">' +
      '<meta itemprop="priceCurrency" content="KZT">' +
      '<link itemprop="availability" href="https://schema.org/' + (tour.seats === 1 ? 'LimitedAvailability' : 'InStock') + '">' +
      '</span>';
  }

  function tourCard(tour) {
    var h = Data.hotel(tour.hotelId);
    var c = Data.country(tour.countryId), r = Data.resort(tour.countryId, tour.resortId);
    return '<article class="tour-card reveal" data-tour="' + tour.id + '" ' +
      'itemscope itemtype="https://schema.org/Product">' +
      '<div class="tour-card__media">' + cardShots(tour) +
        '<div class="tour-card__top"><div class="tour-card__badges">' + badges(tour) + '</div>' +
          favBtn(tour) + '</div>' +
        /* Остаток мест — на снимке, у нижнего края: своей строкой в теле он
           добавлял карточке высоту, а сказать должен ровно то же, что скидка
           в противоположном углу, — «решай быстрее». */
        (tour.seats ? '<div class="tour-card__bottom"><span class="tag tag--onphoto">' +
          seatsLabel(tour.seats) +
          '</span></div>' : '') +
      '</div>' +
      '<div class="tour-card__body">' +
        '<div class="tour-card__place">' + esc(nm(c.name)) + ' · ' + esc(nm(r.name)) + ' ' + starsHTML(h.s) + '</div>' +
        '<h3 class="tour-card__title" itemprop="name">' + esc(h.name) + '</h3>' +
        '<div class="tour-card__rate">' + ratingHTML(h) + '</div>' +
        '<div class="tour-card__facts">' +
          '<span>' + Fmt.range(tour.date, tour.nights) + '</span>' +
          '<span>' + Fmt.nights(tour.nights) + '</span>' +
          '<span>' + esc(nm(Data.meal(tour.meal).name)) + '</span>' +
        '</div>' +
        '<div class="tour-card__price price-line">' + priceBlock(tour) + offerMeta(tour) +
          '<span class="tour-card__per">' + esc(t('card.perTwo')) + '</span></div>' +
        '<div class="tour-card__cta">' +
          '<button class="btn btn--blue" type="button" data-buy>' + esc(t('card.buy')) + '</button>' +
          '<button class="btn btn--ghost" type="button" data-more>' + esc(t('card.more')) + '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  /* «Осталось 3 мест» — так по-русски не говорят. Форма зависит от числа:
     1 место, 2–4 места, 5 и дальше мест; 11–14 всегда «мест». */
  function seatsLabel(n) {
    var d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return t('card.seats1', { n: n });
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return t('card.seats2', { n: n });
    return t('card.seats', { n: n });
  }

  /* Строка факта: подпись и значение — две ячейки одной сетки. */
  function fact(label, value) {
    return '<dt>' + esc(label) + '</dt><dd>' + value + '</dd>';
  }

  function favBtn(tour) {
    var on = isFav(tour.id);
    return '<button class="fav" type="button" data-fav="' + tour.id + '" aria-pressed="' + on + '" ' +
      'aria-label="' + esc(t(on ? 'card.favOn' : 'card.fav')) + '">' + icon('heart') + '</button>';
  }

  function tourRow(tour, opts) {
    opts = opts || {};
    var h = Data.hotel(tour.hotelId);
    var c = Data.country(tour.countryId), r = Data.resort(tour.countryId, tour.resortId);
    var perMonth = Math.round(tour.price / 12 / 1000) * 1000;
    return '<article class="tour-row reveal" data-tour="' + tour.id + '" tabindex="0" ' +
      'itemscope itemtype="https://schema.org/Product">' +
      '<div class="tour-row__media">' + cardShots(tour) +
        '<div class="tour-card__top"><div class="tour-card__badges">' +
          /* Кислотный на карточке появляется один раз: у горящего тура это
             плашка срочности, у самого дешёвого — метка минимума. */
          badges(tour) + (opts.min && !tour.hot ? '<span class="badge-hot">' + t('card.bestPrice') + '</span>' : '') +
        '</div>' + favBtn(tour) + '</div>' +
        '<span class="tour-row__count">' + t('card.photos', { n: tour.photos }) + '</span>' +
      '</div>' +
      '<div class="tour-row__body">' +
        '<h3 class="tour-row__name"><span itemprop="name">' + esc(h.name) + '</span> ' + starsHTML(h.s) + '</h3>' +
        '<div class="tour-row__place">' + esc(nm(r.name)) + ', ' + esc(nm(c.name)) + ' · ' +
          t('card.toBeach', { n: h.dist }) + ' · ' + t('card.toAirport', { n: h.air }) + '</div>' +
        '<div class="tour-row__rate">' + ratingHTML(h) + '</div>' +
        /* Раньше это были шесть значений без подписей, разложенных в две
           колонки: по строке рядом оказывались вылет и тип номера, питание и
           пляж — вещи из разных миров. Читать такое можно только догадками.
           Теперь у каждого факта есть имя, а значения выстроены в столбец. */
        '<dl class="tour-row__facts">' +
          fact(t('card.lblDates'), Fmt.range(tour.date, tour.nights) + ' · ' + Fmt.nights(tour.nights)) +
          fact(t('card.lblFlight'), esc(nm(Data.city(tour.cityId).name))) +
          fact(t('f.room'), esc(nm(Data.room(tour.room).name))) +
          fact(t('flt.meal'), esc(nm(Data.meal(tour.meal).name))) +
          fact(t('flt.beach'), esc(nm(Data.beachType(h.beach).name)) + ', ' +
            esc(nm(Data.byId(Data.BEACH_LINES, String(h.line)).name).replace(/:.*$/, '')).toLowerCase()) +
        '</dl>' +
        /* Метки и значки услуг — в один ряд: раньше это были две отдельные
           строки, хотя обе отвечают на один вопрос «что ещё есть». */
        '<div class="tour-row__marks">' +
          (tour.seats ? '<span class="tag">' + seatsLabel(tour.seats) + '</span>' : '') +
          (tour.top ? '<span class="tag tag--warm">' + t('card.top') + '</span>' : '') +
          (tour.direct ? '<span class="tag tag--outline">' + icon('plane') + t('card.direct') + '</span>' : '') +
          '<span class="tour-row__svc">' + h.svc.map(function (s) {
            var svc = Data.service(s);
            return '<span title="' + esc(nm(svc.name)) + '" aria-label="' + esc(nm(svc.name)) + '">' + icon(svc.icon) + '</span>';
          }).join('') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="tour-row__price">' +
        '<div class="price-line">' + priceBlock(tour, opts) + offerMeta(tour) +
          (tour.discount ? '<span class="tag">−' + tour.discount + '%</span>' : '') +
          /* Короткая пометка: полный состав пакета всё равно идёт строкой ниже,
             и «перелёт включён» дважды подряд — это не забота, а шум. */
          '<span class="price-note">' + esc(t('card.perTwoShort')) + '</span></div>' +
        /* Состав пакета и оператор ушли со всех двадцати карточек выдачи: это
           одинаковый на всю страницу текст, который читают один раз и уже на
           странице тура — там есть и раздел «Что входит в цену», и строка
           оператора. Рассрочка осталась и встала вплотную к цене: она про
           деньги, а не про условия. */
        '<p class="installment">' + t('card.installment', { sum: Fmt.money(perMonth) }) + '</p>' +
        /* Два действия в ряд — тот же приём, что в компактной карточке на
           главной. Ссылкой «Подробнее» выглядела слабее, чем весит. */
        '<div class="tour-row__cta">' +
          '<button class="btn btn--blue" type="button" data-buy>' + esc(t('card.buy')) + '</button>' +
          '<button class="btn btn--ghost" type="button" data-more>' + esc(t('card.more')) + '</button>' +
        '</div>' +
        '<div class="tour-row__links">' +
          '<button class="disclose" type="button" data-alt aria-expanded="false">' +
            esc(t('card.altDates')) + icon('chev-d') + '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  /* Развёрнутая таблица альтернатив — настоящие соседние предложения того же
     отеля из набора, а не выдуманный список. */
  function altTable(tour) {
    var pool = (window.__tours || []).filter(function (x) {
      return x.hotelId === tour.hotelId && x.id !== tour.id;
    }).sort(function (a, b) { return a.price - b.price; }).slice(0, 5);
    if (!pool.length) return '';
    var min = Math.min.apply(null, pool.map(function (r) { return r.price; }));
    return '<div class="alt-table"><table><thead><tr>' +
      '<th>' + esc(t('f.dates')) + '</th><th>' + esc(t('f.nights')) + '</th>' +
      '<th>' + esc(t('flt.meal')) + '</th><th>' + esc(t('f.room')) + '</th>' +
      '<th>' + esc(t('flt.price')) + '</th><th></th></tr></thead><tbody>' +
      pool.map(function (r) {
        return '<tr><td>' + Fmt.range(r.date, r.nights) + '</td><td>' + r.nights + '</td>' +
          '<td>' + esc(nm(Data.meal(r.meal).name)) + '</td>' +
          '<td>' + esc(nm(Data.room(r.room).name)) + '</td>' +
          '<td><b class="' + (r.price === min ? 'min-mark' : '') + '">' + Fmt.money(r.price) + '</b></td>' +
          '<td><button class="btn btn--flat btn--sm" type="button" data-choose>' + esc(t('card.choose')) + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* Адрес страницы тура. anchor — та же опорная дата, на которой собран
     текущий набор: на главной её нет, в выдаче это дата из формы. */
  function tourHref(id) {
    var p = new URLSearchParams();
    p.set('id', id);
    p.set('from', state.city);
    p.set('anchor', window.__toursAnchor || '');
    return 'tour.html?' + p.toString();
  }

  /* Общая обработка кликов по карточкам — избранное, «ещё варианты», демо-CTA */
  function bindCards(scope) {
    scope.addEventListener('click', function (e) {
      var fav = e.target.closest('[data-fav]');
      if (fav) {
        var favId = fav.getAttribute('data-fav');
        var on = toggleFav(favId);
        /* Одно предложение может быть на странице не одной кнопкой: на
           странице отеля это сердечко на снимке и «В избранное» в блоке цены,
           в выдаче — карточка и строка на карте. Красим все разом, иначе
           половина остаётся с прежним видом и человек не понимает, сохранил
           он тур или нет. */
        qsa('[data-fav="' + favId + '"]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(on));
          b.setAttribute('aria-label', t(on ? 'card.favOn' : 'card.fav'));
          var lbl = qs('span', b);
          if (lbl) lbl.textContent = t(on ? 'card.favOn' : 'card.fav');
        });
        return;
      }
      var alt = e.target.closest('[data-alt]');
      if (alt) {
        var card = alt.closest('.tour-row');
        var open = alt.getAttribute('aria-expanded') === 'true';
        var table = qs('.alt-table', card);
        if (open) { if (table) table.remove(); }
        else {
          var id = card.getAttribute('data-tour');
          var tour = (window.__tours || []).filter(function (x) { return x.id === id; })[0];
          if (tour) card.insertAdjacentHTML('beforeend', altTable(tour));
        }
        alt.setAttribute('aria-expanded', String(!open));
        alt.firstChild.nodeValue = t(open ? 'card.altDates' : 'card.altHide');
        return;
      }
      /* «Подробнее» — единственная кнопка карточки, которая ведёт на живую
         страницу, а не показывает заглушку. Адрес несёт город и опорную дату:
         набор предложений детерминирован, и без них id тура не нашёлся бы. */
      var more = e.target.closest('[data-more]');
      if (more) {
        var mCard = more.closest('[data-tour]');
        if (mCard) { location.href = tourHref(mCard.getAttribute('data-tour')); return; }
      }
      if (e.target.closest('[data-buy], [data-choose], [data-demo]')) {
        e.preventDefault();
        toast(t('toast.demo'));
      }
    });
  }

  /* ==========================================================================
     Хром страницы
     ======================================================================== */
  function initChrome() {
    /* язык */
    qsa('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { I18N.set(b.getAttribute('data-lang')); });
    });
    function syncLang() {
      qsa('[data-lang]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === I18N.current));
      });
    }
    document.addEventListener('lang:change', syncLang);
    syncLang();

    /* валюта */
    qsa('[data-cur]').forEach(function (b) {
      b.addEventListener('click', function () { Fmt.setCurrency(b.getAttribute('data-cur')); });
    });
    function syncCur() {
      qsa('[data-cur]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-cur') === Fmt.getCurrency()));
      });
    }
    document.addEventListener('currency:change', syncCur);
    syncCur();

    /* Язык и валюта живут под одной кнопкой шапки: два сегментных
       переключателя рядом занимали треть строки ради выбора, который делают
       один раз. Внутри панели это по-прежнему те же [data-lang] и [data-cur],
       поэтому обработчики выше их уже нашли. */
    qsa('[data-prefs]').forEach(function (box) {
      var btn = qs('.city-pick', box);
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = box.getAttribute('data-open') === 'true';
        box.setAttribute('data-open', open ? 'false' : 'true');
        btn.setAttribute('aria-expanded', String(!open));
      });
      document.addEventListener('click', function (e) {
        if (box.contains(e.target)) return;
        box.setAttribute('data-open', 'false');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
    function syncPrefs() {
      qsa('[data-prefs-label]').forEach(function (n) {
        n.textContent = t('lang.' + I18N.current) + ' · ' + Fmt.getCurrency();
      });
    }
    document.addEventListener('lang:change', syncPrefs);
    document.addEventListener('currency:change', syncPrefs);
    syncPrefs();

    /* выбор города вылета в служебной строке */
    var picker = qs('[data-city-picker]');
    if (picker) {
      var field = picker.closest('.field');
      qs('.city-pick', picker).addEventListener('click', function (e) {
        e.stopPropagation();
        field.setAttribute('data-open', field.getAttribute('data-open') === 'true' ? 'false' : 'true');
      });
      qs('[data-city-list]', picker).innerHTML = Data.CITIES.map(function (c) {
        return '<button class="pop__opt" type="button" data-city-set="' + c.id + '" role="option" ' +
          'aria-selected="' + (c.id === state.city) + '"><span>' + esc(nm(c.name)) + '</span><small>' + c.code + '</small></button>';
      }).join('');
      picker.addEventListener('click', function (e) {
        var b = e.target.closest('[data-city-set]');
        if (!b) return;
        saveCity(b.getAttribute('data-city-set'));
        field.setAttribute('data-open', 'false');
      });
      document.addEventListener('click', function (e) {
        if (!picker.contains(e.target)) field.setAttribute('data-open', 'false');
      });
    }
    function syncCity() {
      qsa('[data-city-label]').forEach(function (n) { n.textContent = nm(Data.city(state.city).name); });
      qsa('[data-city-set]').forEach(function (b) {
        b.setAttribute('aria-selected', String(b.getAttribute('data-city-set') === state.city));
      });
    }
    document.addEventListener('city:change', syncCity);
    document.addEventListener('lang:change', syncCity);
    syncCity();

    /* меню: раскрытие по клику, закрытие по Esc и клику вне */
    qsa('.nav__item').forEach(function (item) {
      var link = qs('.nav__link', item);
      if (!qs('.nav__panel', item)) return;
      link.setAttribute('aria-expanded', 'false');
      link.addEventListener('click', function () {
        var open = item.getAttribute('data-open') === 'true';
        qsa('.nav__item').forEach(function (i) { i.removeAttribute('data-open'); });
        if (!open) { item.setAttribute('data-open', 'true'); link.setAttribute('aria-expanded', 'true'); }
        else link.setAttribute('aria-expanded', 'false');
      });
      item.addEventListener('mouseenter', function () { item.setAttribute('data-open', 'true'); });
      item.addEventListener('mouseleave', function () { item.removeAttribute('data-open'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      qsa('.nav__item').forEach(function (i) { i.removeAttribute('data-open'); });
      var ms = qs('.menu-sheet');
      if (ms) { ms.setAttribute('data-open', 'false'); document.documentElement.classList.remove('is-locked'); }
      qsa('.sheet').forEach(function (s) { s.setAttribute('data-open', 'false'); });
      closeModal();
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav__item')) qsa('.nav__item').forEach(function (i) { i.removeAttribute('data-open'); });
    });

    /* Панели нижней панели и меню: чат, избранное, кабинет */
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-chat-open]')) { e.preventDefault(); openChat(); }
      else if (e.target.closest('[data-favorites-open]')) { e.preventDefault(); openFavorites(); }
      else if (e.target.closest('[data-profile-open]')) { e.preventDefault(); openProfile(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    /* Меню. Шапка при открытии остаётся на месте — закрывает меню тот же
       бургер, поэтому его знак меняется на крестик, а не появляется вторая
       кнопка закрытия внутри листа. */
    var burger = qs('[data-burger]'), sheet = qs('.menu-sheet');
    if (burger && sheet) {
      var burgerIcon = qs('use', burger);
      var setBurger = function (open) {
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', t(open ? 'nav.close' : 'nav.menu'));
        if (burgerIcon) burgerIcon.setAttribute('href', open ? '#i-close' : '#i-list');
        burger.classList.toggle('is-open', open);
      };
      setBurger(false);
      document.addEventListener('lang:change', function () {
        setBurger(sheet.getAttribute('data-open') === 'true');
      });
      /* Общий обработчик Esc выше закрывает лист, но знак кнопки — не его
         забота: синхронизируем его здесь, иначе на шапке остаётся крестик. */
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setBurger(false);
      });
      burger.addEventListener('click', function () {
        var open = sheet.getAttribute('data-open') === 'true';
        sheet.setAttribute('data-open', String(!open));
        document.documentElement.classList.toggle('is-locked', !open);
        setBurger(!open);
      });
      sheet.addEventListener('click', function (e) {
        if (e.target.closest('[data-panel-open], [data-chat-open], [data-favorites-open], [data-profile-open]')) {
          sheet.setAttribute('data-open', 'false');
          document.documentElement.classList.remove('is-locked');
          setBurger(false);
          return;
        }
        /* Любая ссылка внутри карты сайта закрывает её: якорь на этой же
           странице иначе прокрутит страницу под открытым меню. Переключатель
           языка — исключение: он оставляет меню открытым, чтобы было видно,
           что подписи сменились. */
        if (e.target.closest('[data-lang], [data-cur]')) return;
        if (!e.target.closest('[data-menu-close], a')) return;
        sheet.setAttribute('data-open', 'false');
        document.documentElement.classList.remove('is-locked');
        setBurger(false);
        burger.focus();
      });
    }

    /* Нижняя панель телефона: «Поиск» открывает шторку, в которую переезжает
       та же форма, что стоит на первом экране. Второй копии формы нет
       намеренно — иначе город, даты и состав расходились бы между ними. */
    var searchSheet = qs('[data-search-sheet]');
    var searchHost = qs('[data-search-host]');
    var searchBody = qs('[data-search-sheet-body]');
    var searchForm = qs('#search-form');
    if (searchSheet && searchHost && searchBody && searchForm) {
      var openSearchSheet = function () {
        searchBody.appendChild(searchForm);
        searchSheet.setAttribute('data-open', 'true');
        document.documentElement.classList.add('is-locked');
      };
      var closeSearchSheet = function () {
        searchSheet.setAttribute('data-open', 'false');
        document.documentElement.classList.remove('is-locked');
        searchHost.appendChild(searchForm);
      };
      qsa('[data-search-open]').forEach(function (b) {
        b.addEventListener('click', openSearchSheet);
      });
      searchSheet.addEventListener('click', function (e) {
        if (e.target.closest('[data-search-close]')) closeSearchSheet();
      });
      /* Проверяется место формы, а не флаг шторки: общий обработчик Escape
         выше уже мог сбросить data-open, а форму вернуть на место всё равно
         нужно — иначе она осталась бы в закрытой шторке. */
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && searchBody.contains(searchForm)) closeSearchSheet();
      });
    }

    /* компактная шапка */
    var header = qs('.site-header');
    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-compact', window.scrollY > 220);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    /* Лупа в шапке: на выдаче раскрывает свёрнутую строку параметров,
       на главной поднимает к форме поиска. */
    var compact = qs('[data-compact-search]');
    if (compact) compact.addEventListener('click', function () {
      var expand = qs('.searchbar [data-expand]');
      if (expand) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (qs('.searchbar').getAttribute('data-expanded') !== 'true') expand.click();
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      var field = qs('#search-form [data-field="to"] .field__input');
      if (field) setTimeout(function () { field.focus(); }, 400);
    });

    initShots();

    /* появление блоков — одно движение на страницу */
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -10% 0px' });
      var watch = function () { qsa('.reveal:not(.is-in)').forEach(function (n) { io.observe(n); }); };
      watch();
      document.addEventListener('cards:render', watch);
    }

    renderFavCount();
  }

  /* Подменю шапки и колонка направлений в футере — на обеих страницах одни */
  function renderShared() {
    var mins = Data.minByCountry(Data.build(state.city));
    qsa('[data-nav-cities]').forEach(function (box) {
      box.innerHTML = Data.CITIES.slice(0, 8).map(function (c) {
        var p = defaults(); p.from = c.id;
        return '<a href="search.html?' + paramsToQuery(p) + '">' +
          esc(t('from.city', { city: nmGen(c) })) + '</a>';
      }).join('');
    });
    qsa('[data-nav-countries]').forEach(function (box) {
      box.innerHTML = ['tr', 'eg', 'ae', 'th', 'cn', 'mv', 'ge', 'kz'].map(function (id) {
        var c = Data.country(id);
        var p = defaults(); p.from = state.city; p.to = id;
        return '<a href="search.html?' + paramsToQuery(p) + '"><span>' + esc(nm(c.name)) + '</span>' +
          (mins[id] ? '<span>' + t('price.from', { sum: Fmt.money(mins[id]) }) + '</span>' : '') + '</a>';
      }).join('');
    });
    qsa('[data-footer-dest]').forEach(function (box) {
      var pairs = [['tr', 'ala'], ['eg', 'nqz'], ['ae', 'ala'], ['th', 'cit'], ['cn', 'kgf'], ['kz', 'nqz']];
      box.innerHTML = pairs.map(function (pair) {
        var c = Data.country(pair[0]), city = Data.city(pair[1]);
        var p = defaults(); p.from = pair[1]; p.to = pair[0];
        return '<li><a href="search.html?' + paramsToQuery(p) + '">' +
          esc(nm(c.name)) + ' — ' + esc(t('from.city', { city: nmGen(city) })) + '</a></li>';
      }).join('');
    });
  }

  /* Плашка «Ваш город — Алматы?»: показывается один раз, выбор сохраняется */
  function initCityPrompt() {
    var box = qs('.city-prompt');
    if (!box) return;
    var answered;
    try { answered = localStorage.getItem('trips.cityAsked'); } catch (e) {}
    if (answered) return;
    qs('[data-city-q]', box).textContent = t('city.q', { city: nm(Data.city(state.city).name) });
    box.setAttribute('data-open', 'true');
    document.addEventListener('lang:change', function () {
      qs('[data-city-q]', box).textContent = t('city.q', { city: nm(Data.city(state.city).name) });
    });
    qs('[data-city-yes]', box).addEventListener('click', function () {
      try { localStorage.setItem('trips.cityAsked', '1'); } catch (e) {}
      box.setAttribute('data-open', 'false');
    });
    qs('[data-city-other]', box).addEventListener('click', function () {
      try { localStorage.setItem('trips.cityAsked', '1'); } catch (e) {}
      box.setAttribute('data-open', 'false');
      var p = qs('[data-city-picker] .city-pick');
      if (p) { p.click(); p.scrollIntoView({ block: 'center' }); }
    });
  }

  function boot() {
    load();
    Fmt.initCurrency();
    I18N.init();
    initChrome();
    renderShared();
    initCityPrompt();
    document.addEventListener('city:change', renderShared);
    document.addEventListener('lang:change', renderShared);
    document.addEventListener('currency:change', renderShared);
  }

  return {
    qs: qs, qsa: qsa, esc: esc, icon: icon, t: t, nm: nm, nmGen: nmGen, nmAcc: nmAcc,
    state: state, saveCity: saveCity, isFav: isFav, toggleFav: toggleFav,
    toast: toast, boot: boot, renderShared: renderShared,
    modal: modal, closeModal: closeModal,
    defaults: defaults, paramsFromURL: paramsFromURL, paramsToQuery: paramsToQuery,
    destLabel: destLabel, guestsLabel: guestsLabel, summaryLine: summaryLine,
    SearchForm: SearchForm,
    tourCard: tourCard, tourRow: tourRow, bindCards: bindCards, tourHref: tourHref,
    seatsLabel: seatsLabel,
    starsHTML: starsHTML, photo: photo, ratingHTML: ratingHTML, badges: badges, priceBlock: priceBlock
  };
})();
