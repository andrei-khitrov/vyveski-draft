/* VELES — main.js. Lenis + GSAP. Механика пересажена с доноров (см. CASTING.md), тайминги на токенах:
   ease cubic-bezier(.32,.72,0,1) ≡ CustomEase "veles"; длительности .3 / .8 / 1.2 */
(function () {
  'use strict';
  const html = document.documentElement;
  html.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof gsap !== 'undefined';
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger, CustomEase);
    CustomEase.create('veles', 'M0,0 C0.32,0.72 0,1 1,1');
    gsap.defaults({ ease: 'veles', duration: 0.8 });
  }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ── Lenis ── */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !reduce) {
    lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else { window.lenis = null; }
  const scrollTo = (target, opts = {}) => { if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.2, ...opts }); else { const el = typeof target === 'string' ? $(target) : target; if (el) el.scrollIntoView({ behavior: 'smooth' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); } };

  /* ── Переход между страницами (шторка) ──
     Прелоадера нет: первый экран рисуется сразу, иначе он ставил потолок в 2,8 с
     на LCP — а именно первый визит из поиска и меряют поисковики. */
  const curtain = $('[data-curtain]');
  const viaTransition = sessionStorage.getItem('veles:transition');
  sessionStorage.removeItem('veles:transition');
  const startPage = () => {
    html.classList.add('is-loaded');
    window.__velesReady = true;
    requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('veles:ready')));
  };
  const edge = $('[data-curtain-edge]');
  const mainEl = $('#main');
  if (viaTransition && curtain && hasGsap && !reduce) {
    // Приехали по переходу: панель уже закрывает экран, кромка уходит вверх,
    // а содержимое одновременно доезжает на место — движение не обрывается.
    curtain.classList.toggle('is-light', viaTransition === 'light');
    gsap.set(curtain, { clipPath: 'inset(0% 0 0 0)' });
    gsap.set(edge, { yPercent: 0 });
    html.classList.remove('is-arriving'); // дальше состоянием управляет анимация
    gsap.timeline({ onComplete: () => gsap.set(curtain, { clipPath: 'inset(100% 0 0 0)' }) })
      .to(curtain, { clipPath: 'inset(0 0 100% 0)', duration: 0.66, ease: 'power3.inOut' }, 0)
      .to(edge, { yPercent: -100, duration: 0.66, ease: 'power3.inOut' }, 0)
      .fromTo(mainEl, { y: 26, autoAlpha: 0.65 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power2.out' }, 0.06);
  }
  startPage();

  // клики по внутренним ссылкам → шторка → переход
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || !curtain || !hasGsap || reduce) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) { if (url.hash) { e.preventDefault(); scrollTo(url.hash); } return; }
    e.preventDefault();
    closeAllMega();
    const theme = a.dataset.theme || 'dark';
    curtain.classList.toggle('is-light', theme === 'light');
    sessionStorage.setItem('veles:transition', theme);
    const edgeEl = $('[data-curtain-edge]'), main = $('#main');
    gsap.set(curtain, { clipPath: 'inset(100% 0 0 0)' });
    gsap.set(edgeEl, { yPercent: 100 });
    gsap.timeline({ onComplete: () => { location.href = url.href; } })
      .to(curtain, { clipPath: 'inset(0% 0 0 0)', duration: 0.56, ease: 'power3.inOut' }, 0)
      .to(edgeEl, { yPercent: 0, duration: 0.56, ease: 'power3.inOut' }, 0)
      .to(main, { y: -26, autoAlpha: 0.65, duration: 0.5, ease: 'power2.in' }, 0);
  });
  // якоря на той же странице
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => { const id = a.getAttribute('href'); if (id.length > 1 && $(id)) { e.preventDefault(); scrollTo(id); } }));
  $$('[data-to-top]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); scrollTo(0, { offset: 0 }); }));
  window.addEventListener('pageshow', (e) => { if (e.persisted && curtain) { gsap.set(curtain, { clipPath: 'inset(100% 0 0 0)' }); gsap.set($('#main'), { clearProps: 'all' }); } });

  /* ── Шапка (prolibu): скролл-состояние, скрытие, прогресс (nominal) ── */
  const header = $('[data-header]');
  const progress = $('[data-progress]');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY || (lenis ? lenis.scroll : 0);
    header.classList.toggle('is-scrolled', y > 24);
    if (y > 120 && y > lastY + 4 && !header.classList.contains('is-open')) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 120) header.classList.remove('is-hidden');
    lastY = y;
    if (progress) { const h = document.documentElement.scrollHeight - innerHeight; progress.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`; }
  };
  if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // Курсор: помним последнюю позицию, чтобы отличать настоящее наведение от «входа»,
  // который браузер рассылает после перехода на страницу, когда мышь стоит над пунктом.
  let ptr = null, ptrSeen = false;
  addEventListener('pointermove', (e) => { ptr = { x: e.clientX, y: e.clientY }; ptrSeen = true; }, { passive: true });
  const cameFromOutside = (el) => {
    if (!ptrSeen || !ptr) return false; // движения ещё не было — это тот самый «залипший» вход
    const r = el.getBoundingClientRect();
    return ptr.x < r.left || ptr.x > r.right || ptr.y < r.top || ptr.y > r.bottom;
  };
  const closeAllMega = () => $$('.nav__item--mega.is-open').forEach(i => {
    i.classList.remove('is-open');
    $('.nav__link', i).setAttribute('aria-expanded', 'false');
    header.classList.remove('is-open');
  });
  addEventListener('pageshow', closeAllMega); // возврат «назад» из кеша браузера

  // мега-меню (tequila): hover на десктопе, клик/клавиатура везде
  $$('.nav__item--mega').forEach(item => {
    const link = $('.nav__link', item);
    let t;
    const open = () => { clearTimeout(t); $$('.nav__item--mega.is-open').forEach(i => i !== item && close(i)); item.classList.add('is-open'); link.setAttribute('aria-expanded', 'true'); header.classList.add('is-open'); };
    const close = (i = item) => { i.classList.remove('is-open'); $('.nav__link', i).setAttribute('aria-expanded', 'false'); if (!$('.nav__item--mega.is-open')) header.classList.remove('is-open'); };
    if (fine) { item.addEventListener('mouseenter', () => { if (cameFromOutside(item)) open(); }); item.addEventListener('mouseleave', () => { t = setTimeout(() => close(), 120); }); }
    link.addEventListener('click', (e) => { if (!fine || e.detail === 0) { e.preventDefault(); item.classList.contains('is-open') ? close() : open(); } });
    item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  });
  // оверлей-меню (warmnfuzzy)
  const menu = $('#menu'); const burger = $('.burger');
  if (menu && burger) {
    const rows = $$('.mrow, .menu__foot > *', menu);
    const groups = $$('[data-mgroup]', menu);
    const collapse = (g) => { g.classList.remove('is-open'); $('.mrow--toggle', g).setAttribute('aria-expanded', 'false'); };
    const openMenu = () => {
      menu.showModal(); burger.setAttribute('aria-expanded', 'true'); if (lenis) lenis.stop();
      $('.menu__scroll', menu).scrollTop = 0;
      if (hasGsap && !reduce) gsap.fromTo(rows, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'veles', stagger: 0.045, delay: 0.12, overwrite: true });
    };
    const closeMenu = () => menu.close();
    burger.addEventListener('click', () => menu.open ? closeMenu() : openMenu());
    $('.menu__close', menu).addEventListener('click', closeMenu);
    menu.addEventListener('close', () => { burger.setAttribute('aria-expanded', 'false'); if (lenis) lenis.start(); groups.forEach(collapse); });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.close(); });
    // Раскрывающиеся разделы: открыт всегда один, чтобы меню помещалось в экран
    groups.forEach(g => {
      const toggle = $('.mrow--toggle', g);
      toggle.addEventListener('click', () => {
        const willOpen = !g.classList.contains('is-open');
        groups.forEach(collapse);
        if (willOpen) {
          g.classList.add('is-open'); toggle.setAttribute('aria-expanded', 'true');
          setTimeout(() => { const r = g.getBoundingClientRect(); const box = $('.menu__scroll', menu).getBoundingClientRect();
            if (r.bottom > box.bottom) $('.menu__scroll', menu).scrollBy({ top: Math.min(r.top - box.top, r.bottom - box.bottom + 16), behavior: 'smooth' }); }, 460);
        }
      });
    });
  }

  /* ── Появления ──
     Первый экран статичен: он и так открывается из-под шторки перехода, а вылет
     текста поверх неё выглядел как рывок. Ниже по странице — короткий подъём с
     прозрачностью. Строки больше не режутся на части: нарезка давала дрожание
     текста, лишний слой анимаций и гонку при поздней загрузке шрифта. */
  const heroEl = $('.hero');
  const inHero = (el) => !!heroEl && heroEl.contains(el);
  const showAll = () => {
    $$('.split, .reveal').forEach(el => el.classList.add('in'));
    $$('[data-stagger]').forEach(el => el.classList.add('in'));
    $$('.section__head .eyebrow, .section__head .link-bracket').forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
  };
  const ready = () => {
    if (!hasGsap || reduce) {
      showAll();
      $$('[data-count]').forEach(el => { el.textContent = (+el.dataset.count).toLocaleString('ru-RU'); });
      return;
    }
    // первый экран показываем сразу, без анимации
    $$('.hero .split, .hero .reveal', document).forEach(el => el.classList.add('in'));
    const items = [...$$('.split'), ...$$('.reveal'), ...$$('.section__head .eyebrow'), ...$$('.section__head .link-bracket')]
      .filter(el => !inHero(el));
    if (items.length) ScrollTrigger.batch(items, {
      start: 'top 92%', once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'veles', stagger: 0.06, overwrite: 'auto' }),
    });
    $$('[data-stagger]').forEach(list => {
      const kids = [...list.children].filter(el => !inHero(el));
      if (!kids.length) return;
      ScrollTrigger.batch(kids, {
        start: 'top 94%', once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.65, ease: 'veles', stagger: 0.055, overwrite: 'auto' }),
      });
    });
    // счётчики
    $$('[data-count]').forEach(el => {
      const target = +el.dataset.count; const o = { v: 0 };
      ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => gsap.to(o, { v: target, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('ru-RU'); } }) });
    });
    // стек шагов: верхние карточки уходят вглубь (без прозрачности — иначе просвечивают)
    $$('[data-stack] .steps__item').forEach((item, i, arr) => { if (i === arr.length - 1) return; gsap.to(item, { scale: 0.97, ease: 'none', scrollTrigger: { trigger: arr[i + 1], start: 'top 70%', end: 'top 20%', scrub: true } }); });
    // мягкий параллакс фото
    $$('.hero__aside img, .hero__photo img, .about-photo__img img, .showroom__photo img').forEach(im => gsap.fromTo(im, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: im.closest('figure'), start: 'top bottom', end: 'bottom top', scrub: true } }));
    ScrollTrigger.refresh();
    window.__velesTriggers = ScrollTrigger.getAll().length;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    addEventListener('load', () => ScrollTrigger.refresh());
  };

  let readyDone = false;
  const runReady = () => { if (readyDone) return; readyDone = true; ready(); };
  document.addEventListener('veles:ready', runReady, { once: true });
  if (window.__velesReady) runReady(); // событие могло уйти раньше подписки
  setTimeout(() => { if (!readyDone) showAll(); }, 4000); // страховка от полного отказа анимаций

  /* ── Магнитные кнопки (lineaprompt + quickTo) ── */
  if (fine && hasGsap && !reduce) {
    $$('.magnetic').forEach(b => {
      const xTo = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3.out' }), yTo = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3.out' });
      b.addEventListener('mousemove', (e) => { const r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.35); yTo((e.clientY - r.top - r.height / 2) * 0.35); });
      b.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ── Курсор (aerodynamics/hollywood) ── */
  const cursor = $('[data-cursor]');
  if (cursor && fine && hasGsap && !reduce) {
    html.classList.add('has-cursor');
    const label = $('.cursor__label', cursor);
    // Родной курсор скрыт, поэтому точка должна стоять ровно под указателем:
    // прежние 0.18 с давали шлейф — казалось, что курсор съезжает следом за рукой
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.055, ease: 'power2.out' }), yTo = gsap.quickTo(cursor, 'y', { duration: 0.055, ease: 'power2.out' });
    let lx = 0, ly = 0;
    addEventListener('mousemove', (e) => { lx = e.clientX; ly = e.clientY; xTo(lx); yTo(ly); }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('a, button, [data-scene], summary, label, input[type=range]');
      const text = e.target.closest('input:not([type=range]), textarea');
      cursor.classList.toggle('is-text', !!text); // в полях ввода показываем родную «палочку»
      cursor.classList.toggle('is-link', !!t && !text);
      const txt = t?.closest('[data-scene]') ? (t.closest('[data-scene]').dataset.scene === 'building' ? 'листайте' : 'вращайте') : t?.classList.contains('wgrid__btn') ? 'открыть' : '';
      label.textContent = txt; cursor.classList.toggle('has-label', !!txt);
    });
  }

  /* ── Spotlight в тёмных секциях (biofarma) ── */
  // Подсветка тёмных секций — ровный фоновый свет, не следящий за мышью:
  // раньше пятно бежало за курсором и читалось как подмена самого курсора.
  $$('[data-spotlight]').forEach(glow => { glow.style.left = '50%'; glow.style.top = '18%'; });

  /* ── Hover-preview у строк услуг (juliencalot, на своих токенах) ── */
  const rows = $$('[data-rows] .rows__link[data-preview]');
  if (rows.length && fine && hasGsap && !reduce) {
    const pv = document.createElement('div'); pv.className = 'rows-preview'; const im = document.createElement('img'); im.alt = ''; im.width = 260; im.height = 195; im.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; pv.appendChild(im); document.body.appendChild(pv);
    const xTo = gsap.quickTo(pv, 'x', { duration: 0.35, ease: 'power3.out' }), yTo = gsap.quickTo(pv, 'y', { duration: 0.35, ease: 'power3.out' });
    rows.forEach(r => {
      r.addEventListener('mouseenter', () => { im.src = `${window.__BASE || ''}/assets/img/photo/${r.dataset.preview}-m.jpg`; pv.classList.add('is-on'); });
      r.addEventListener('mousemove', (e) => { xTo(e.clientX + 160); yTo(e.clientY); });
      r.addEventListener('mouseleave', () => pv.classList.remove('is-on'));
    });
  }

  /* ── Tilt карточки в фото (invest) ── */
  if (fine && hasGsap && !reduce) $$('[data-tilt]').forEach(card => {
    const fig = card.parentElement;
    fig.addEventListener('mousemove', (e) => { const r = fig.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5; gsap.to(card, { rotateY: px * 10, rotateX: -py * 8, x: px * 10, y: py * 8, duration: 0.6, ease: 'power3.out', transformPerspective: 900 }); });
    fig.addEventListener('mouseleave', () => gsap.to(card, { rotateY: 0, rotateX: 0, x: 0, y: 0, duration: 0.8, ease: 'veles' }));
  });

  /* ── FAQ: плавная высота ── */
  $$('[data-accordion] details').forEach(d => {
    const summary = $('summary', d), body = $('.faq__a', d);
    summary.addEventListener('click', (e) => {
      if (!hasGsap || reduce) return;
      e.preventDefault();
      if (d.open) { gsap.to(body, { height: 0, opacity: 0, duration: 0.5, ease: 'veles', onComplete: () => { d.open = false; body.style.height = ''; body.style.opacity = ''; } }); }
      else { d.open = true; const h = body.scrollHeight; gsap.fromTo(body, { height: 0, opacity: 0 }, { height: h, opacity: 1, duration: 0.5, ease: 'veles', onComplete: () => { body.style.height = ''; body.style.opacity = ''; ScrollTrigger.refresh(); } }); }
    });
  });

  /* ── Переключатель типов продукта ── */
  $$('[data-types]').forEach(tabs => {
    const box = tabs.closest('.showcase');
    const shot = $('[data-showcase-img]', box), label = $('[data-type-label]', box);
    $$('.types__tab', tabs).forEach(tab => tab.addEventListener('click', () => {
      if (tab.classList.contains('is-active')) return;
      $$('.types__tab', tabs).forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active'); tab.setAttribute('aria-selected', 'true');
      const swap = () => { shot.src = tab.dataset.img; shot.alt = tab.dataset.name; if (label) label.textContent = tab.dataset.name; };
      if (hasGsap && !reduce) gsap.to(shot, { autoAlpha: 0, scale: 0.97, duration: 0.22, ease: 'veles', onComplete: () => { swap(); gsap.to(shot, { autoAlpha: 1, scale: 1, duration: 0.42, ease: 'veles' }); } });
      else swap();
    }));
  });

  /* ── Формы ──
     Успех показываем только после ответа сервера. Пока точка приёма не заведена,
     заявка не считается отправленной: показываем телефон как запасной канал. */
  $$('[data-form]').forEach(form => {
    const fields = $$('.field, .check', form);
    const submitBtn = $('button[type=submit]', form);
    const errorBox = $('.form__error', form);
    const validate = (wrap) => { const input = $('input, textarea', wrap); const ok = input.checkValidity(); wrap.classList.toggle('is-invalid', !ok); return ok; };
    fields.forEach(w => { const input = $('input, textarea', w); input.addEventListener('input', () => { if (w.classList.contains('is-invalid')) validate(w); }); input.addEventListener('change', () => validate(w)); });
    // откуда пришёл человек — менеджеру это нужнее всего
    const page = $('[data-form-page]', form), ref = $('[data-form-referrer]', form), utm = $('[data-form-utm]', form);
    if (page) page.value = location.pathname + location.search;
    if (ref) ref.value = document.referrer || '';
    if (utm) { const u = new URLSearchParams(location.search); const keys = [...u.keys()].filter(k => k.startsWith('utm_')); utm.value = keys.map(k => `${k}=${u.get(k)}`).join('&'); }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ok = fields.map(validate).every(Boolean);
      if (!ok) { const first = $('.is-invalid input, .is-invalid textarea', form); first && first.focus(); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const endpoint = form.dataset.endpoint;
      if (errorBox) errorBox.hidden = true;
      if (!endpoint) { // точка приёма ещё не заведена — молча «принять» заявку нельзя
        if (errorBox) errorBox.hidden = false;
        try { sessionStorage.setItem('veles:lead', JSON.stringify(data)); } catch (_) {}
        return;
      }
      submitBtn.disabled = true; submitBtn.classList.add('is-sending');
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.classList.add('is-sent');
      } catch (err) {
        if (errorBox) errorBox.hidden = false;
      } finally {
        submitBtn.disabled = false; submitBtn.classList.remove('is-sending');
      }
    });
  });

  /* ── Схема вывески в калькуляторе: чертёж вместо 3D ──
     Буквы — знак логотипа в нужном числе и высоте, короб — прямоугольник по габаритам.
     Рядом размерные линии, как в спецификации. Всё живое: перестраивается на каждый ввод. */
  const scheme = $('[data-scheme-sign]');
  if (scheme) {
    const NS = 'http://www.w3.org/2000/svg';
    const dims = $('[data-scheme-dims]');
    const W = 640, WALL = 270, LEFT = 30, RIGHT = 610;
    const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
    const dimLine = (x1, y1, x2, y2, text, vertical) => {
      const g = el('g', {});
      g.appendChild(el('line', { x1, y1, x2, y2, class: 'scheme__dim' }));
      const tick = 5;
      g.appendChild(el('line', vertical ? { x1: x1 - tick, y1, x2: x1 + tick, y2: y1, class: 'scheme__tick' } : { x1, y1: y1 - tick, x2: x1, y2: y1 + tick, class: 'scheme__tick' }));
      g.appendChild(el('line', vertical ? { x1: x2 - tick, y1: y2, x2: x2 + tick, y2, class: 'scheme__tick' } : { x1: x2, y1: y2 - tick, x2, y2: y2 + tick, class: 'scheme__tick' }));
      const t = el('text', vertical
        ? { x: x1 - 10, y: (y1 + y2) / 2, class: 'scheme__label', 'text-anchor': 'end', 'dominant-baseline': 'middle' }
        : { x: (x1 + x2) / 2, y: y1 + 20, class: 'scheme__label', 'text-anchor': 'middle' });
      t.textContent = text; g.appendChild(t); return g;
    };
    const paint = (st) => {
      scheme.textContent = ''; dims.textContent = '';
      const finish = { svet: 'is-glow', nesvet: 'is-matte', nerzh: 'is-steel', korob: 'is-glow', kompozit: 'is-inlay' }[st.key] || 'is-glow';
      if (st.mode === 'perCm') {
        const n = Math.max(1, Math.min(30, st.n || 8));
        const hCm = st.h || 50;
        // масштаб: чем выше буквы и чем их больше, тем мельче на схеме
        const markRatio = 1.6; // ширина знака к его высоте
        const gapRatio = 0.18;
        const maxW = RIGHT - LEFT - 40, maxH = 170;
        let h = Math.min(maxH, hCm * 1.5);
        let total = n * h * markRatio + (n - 1) * h * gapRatio;
        if (total > maxW) { h *= maxW / total; total = maxW; }
        const w = h * markRatio, gap = h * gapRatio;
        const x0 = (W - total) / 2, y = WALL - h;
        for (let i = 0; i < n; i++) {
          const u = el('use', { href: '#logo-mark', x: x0 + i * (w + gap), y, width: w, height: h, class: `scheme__mark ${finish}` });
          scheme.appendChild(u);
        }
        dims.appendChild(dimLine(x0 - 18, y, x0 - 18, WALL, hCm + ' см', true));
        dims.appendChild(dimLine(x0, WALL + 16, x0 + total, WALL + 16, n + (n === 1 ? ' буква' : n < 5 ? ' буквы' : ' букв'), false));
      } else {
        const wM = st.w || 2, hM = st.hh || 0.8;
        const maxW = RIGHT - LEFT - 60, maxH = 190;
        let scale = Math.min(maxW / wM, maxH / hM, 150);
        const w = wM * scale, h = hM * scale;
        const x = (W - w) / 2, y = WALL - h;
        scheme.appendChild(el('rect', { x, y, width: w, height: h, rx: 6, class: `scheme__box ${finish}` }));
        scheme.appendChild(el('use', { href: '#logo-mark', x: x + w / 2 - h * 0.28, y: y + h * 0.22, width: h * 0.56, height: h * 0.56, class: 'scheme__mark is-onbox' }));
        dims.appendChild(dimLine(x - 18, y, x - 18, WALL, hM.toFixed(1).replace('.', ',') + ' м', true));
        dims.appendChild(dimLine(x, WALL + 16, x + w, WALL + 16, wM.toFixed(1).replace('.', ',') + ' м', false));
      }
    };
    document.addEventListener('veles:calc', (e) => paint(e.detail));
    paint({ key: 'svet', mode: 'perCm', h: 50, n: 8 });
  }

  /* ── Калькулятор ── */
  const RATES = { svet: { rate: 68, mode: 'perCm', title: 'Объёмные световые буквы' }, nesvet: { rate: 25, mode: 'perCm', title: 'Несветовые буквы' }, nerzh: { rate: 30, mode: 'perCm', title: 'Буквы из нержавеющей стали' }, korob: { rate: 8000, mode: 'perM2', title: 'Световой короб' }, kompozit: { rate: 9000, mode: 'perM2', title: 'Композитный короб с инкрустацией' } };
  const fmtN = (n) => Math.round(n).toLocaleString('ru-RU');
  const fmtM = (n) => n.toFixed(1).replace('.', ',') + ' м';
  $$('[data-calc]').forEach(calc => {
    const isFull = calc.hasAttribute('data-calc-full');
    const ranges = $$('[data-range]', calc);
    const out = (k) => $(`[data-out="${k}"]`, calc);
    const total = $('[data-total]', calc); const formula = $('[data-formula]', calc);
    const cmBox = $('[data-mode-cm]', calc), m2Box = $('[data-mode-m2]', calc);
    const textIn = $('[data-calc-text]', calc);
    const caption = $('[data-calc-caption]');
    const state = () => {
      const key = isFull ? ($('input[name=type]:checked', calc)?.value) : calc.dataset.calcKey;
      const r = RATES[key]; const v = {}; ranges.forEach(i => { v[i.dataset.range] = +i.value; });
      return { key, r, v };
    };
    const paint = (i) => { const pct = ((i.value - i.min) / (i.max - i.min)) * 100; i.style.setProperty('--pct', pct + '%'); };
    const update = () => {
      const { key, r, v } = state(); if (!r) return;
      if (cmBox && m2Box) { cmBox.hidden = r.mode !== 'perCm'; m2Box.hidden = r.mode !== 'perM2'; }
      ranges.forEach(paint);
      if (out('h')) out('h').textContent = v.h + ' см'; if (out('n')) out('n').textContent = v.n;
      if (out('w')) out('w').textContent = fmtM(v.w); if (out('hh')) out('hh').textContent = fmtM(v.hh);
      let sum, f, cap;
      if (r.mode === 'perCm') { sum = r.rate * v.h * v.n; f = `${r.rate} ₽ × ${v.h} см × ${v.n} букв`; cap = `${r.title} · ${v.n} букв · ${v.h} см`; }
      else { const area = v.w * v.hh; sum = r.rate * area; f = `${fmtN(r.rate)} ₽ × ${area.toFixed(2).replace('.', ',')} м²`; cap = `${r.title} · ${fmtM(v.w)} × ${fmtM(v.hh)}`; }
      total.textContent = fmtN(sum); if (formula) formula.textContent = f; if (caption) caption.textContent = cap;
      document.dispatchEvent(new CustomEvent('veles:calc', { detail: { key, mode: r.mode, ...v, text: textIn ? textIn.value : '', total: sum, model: isFull ? $('input[name=type]:checked', calc)?.dataset.model : null } }));
    };
    calc.addEventListener('input', update); calc.addEventListener('change', update);
    if (isFull) {
      const submit = $('[data-calc-submit]', calc);
      submit && submit.addEventListener('click', () => {
        const { r, v } = state(); const ta = $('form[data-form] textarea[name=comment]');
        if (!ta) return; // на странице без формы второй вызов раньше падал с TypeError
        ta.value = `Калькулятор: ${r.title}, ${r.mode === 'perCm' ? `${v.n} букв высотой ${v.h} см` : `${fmtM(v.w)} × ${fmtM(v.hh)}`}, ориентировочно от ${total.textContent} ₽`;
        ta.dispatchEvent(new Event('input'));
      });
      // якорь #svet и т.п. — предвыбор типа
      const hash = location.hash.slice(1); if (RATES[hash]) { const radio = $(`input[name=type][value="${hash}"]`, calc); if (radio) radio.checked = true; }
    }
    update();
  });

  /* ── Лайтбокс работ ── */
  const lb = $('[data-lightbox-dialog]');
  if (lb) {
    const img = $('[data-lightbox-img]', lb), cap = $('[data-lightbox-cap]', lb);
    $$('[data-lightbox] .wgrid__btn').forEach(b => b.addEventListener('click', () => { const src = $('img', b); img.src = src.src; img.alt = src.alt; cap.textContent = src.alt; lb.showModal(); if (lenis) lenis.stop(); }));
    $('.lightbox__close', lb).addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
    lb.addEventListener('close', () => { if (lenis) lenis.start(); });
  }

  /* ── Проброс лида из калькулятора в форму на другой странице ── */
  try { const lead = sessionStorage.getItem('veles:lead'); if (lead && location.pathname === '/kontakty/') sessionStorage.removeItem('veles:lead'); } catch (_) {}
})();
