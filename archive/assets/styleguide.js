/* Поведение стайлгайда: язык демо-строк, аккордеон, появление секций, кривые движения.
   Нативный JS, без зависимостей — ограничение стека из PRODUCT.md. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  /* --- Переключатель языка демонстрационных строк ------------------------- */
  var langButtons = document.querySelectorAll('.lang [data-lang]');
  var i18nNodes = document.querySelectorAll('[data-i18n]');

  function setLang(lang) {
    langButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    i18nNodes.forEach(function (n) {
      var value = n.dataset[lang];
      if (value) n.textContent = value;
    });
    document.documentElement.lang = lang === 'kk' ? 'kk' : lang === 'en' ? 'en' : 'ru';
  }

  langButtons.forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.dataset.lang); });
  });

  /* --- Аккордеон ---------------------------------------------------------- */
  document.querySelectorAll('[data-accordion] .accordion__trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var item = trigger.closest('.accordion__item');
      var open = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!open));
      item.dataset.open = String(!open);
    });
  });

  /* --- Появление секций: одно общее движение ------------------------------ */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* --- Демонстрация кривых ------------------------------------------------ */
  document.querySelectorAll('[data-motion]').forEach(function (track) {
    function play() {
      track.classList.remove('is-running');
      void track.offsetWidth;
      track.classList.add('is-running');
    }
    track.addEventListener('click', play);
    track.addEventListener('mouseenter', play);
  });
})();
