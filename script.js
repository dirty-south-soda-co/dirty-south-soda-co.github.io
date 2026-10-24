/* Dirty South Soda Co. | Dependency-free navigation and mobile-only media. */
(() => {
  'use strict';
  const header = document.querySelector('.header');
  const nav = document.querySelector('#navigation');
  const toggle = document.querySelector('.nav-toggle');
  const setMenu = (open, focus = false) => {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    const label = toggle.querySelector('.nav-label');
    if (label) label.textContent = open ? 'Close' : 'Menu';
    if (focus) toggle.focus();
  };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  document.addEventListener('click', e => { if (header && !header.contains(e.target)) setMenu(false); });
  header?.addEventListener('focusout', () => requestAnimationFrame(() => {
    if (!header.contains(document.activeElement)) setMenu(false);
  }));
  const desktopNav = matchMedia('(min-width: 951px)');
  const listen = (query, fn) => query.addEventListener ? query.addEventListener('change', fn) : query.addListener(fn);
  listen(desktopNav, () => setMenu(false));
  const scrollHeader = () => header?.classList.toggle('scrolled', scrollY > 10);
  scrollHeader();
  addEventListener('scroll', scrollHeader, { passive: true });
  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();

  // MOBILE VIDEO ELIGIBILITY: BOTH small viewport AND coarse primary pointer.
  // No MP4 src exists in HTML. Only loadVideo() may assign one after eligibility.
  const eligibleQuery = matchMedia('(max-width: 767px) and (pointer: coarse)');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const video = document.querySelector('#mobile-video');
  const frame = document.querySelector('#hero-media');
  const control = document.querySelector('#video-control');
  const status = document.querySelector('#video-status');
  let inView = false;
  let manuallyPaused = false;
  let userPermission = false;
  let autoplayBlocked = false;
  let failed = false;
  let pending = false;
  let generation = 0;
  const restricted = () => motionQuery.matches || Boolean(connection?.saveData);
  const eligible = () => eligibleQuery.matches;
  const mayPlay = () => eligible() && inView && !document.hidden && !manuallyPaused && !failed &&
    (!restricted() || userPermission) && (!autoplayBlocked || userPermission);

  if (video && frame && control) {
    const setControl = playing => {
      control.hidden = !eligible() || failed;
      control.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
      control.querySelector('.video-label').textContent = playing ? 'Pause video' : 'Play video';
      control.querySelector('[aria-hidden]').textContent = playing ? 'Ⅱ' : '▶';
    };
    const showStill = () => {
      frame.classList.remove('is-playing');
      video.hidden = true;
    };
    const loadVideo = () => {
      if (!eligible()) return false;
      if (!video.hasAttribute('src')) {
        video.muted = true;
        video.defaultMuted = true;
        video.src = video.dataset.src;
        video.load();
      }
      return true;
    };
    const unloadVideo = () => {
      generation++;
      pending = false;
      video.pause();
      if (video.hasAttribute('src')) {
        video.removeAttribute('src');
        video.load();
      }
      showStill();
      setControl(false);
    };
    const tryPlay = async () => {
      if (!mayPlay() || pending || !video.paused) return;
      if (!loadVideo()) return;
      const attempt = generation;
      pending = true;
      video.muted = true;
      // Keep the still visible until the playing event confirms real playback.
      try {
        await video.play();
        if (attempt !== generation || !mayPlay()) {
          video.pause();
          return;
        }
        autoplayBlocked = false;
        if (status) status.textContent = '';
      } catch (error) {
        if (attempt !== generation || !eligible()) return;
        // Visibility changes can abort a pending play without blocking autoplay.
        if (error.name !== 'AbortError') {
          autoplayBlocked = true;
          userPermission = false;
          if (status) status.textContent = 'Video is paused. Select Play video to watch.';
        }
        showStill();
        setControl(false);
      } finally {
        if (attempt === generation) pending = false;
      }
    };
    const sync = () => {
      if (!eligible()) { unloadVideo(); return; }
      setControl(!video.paused && frame.classList.contains('is-playing'));
      if (mayPlay()) tryPlay();
      else video.pause();
    };
    video.addEventListener('playing', () => {
      if (!mayPlay()) { video.pause(); return; }
      video.hidden = false;
      frame.classList.add('is-playing');
      setControl(true);
    });
    video.addEventListener('pause', () => setControl(false));
    video.addEventListener('error', () => {
      if (!video.hasAttribute('src')) return;
      failed = true;
      video.pause();
      showStill();
      setControl(false);
      if (status) status.textContent = 'The video is unavailable. The drink photograph is shown instead.';
    });
    // Natural dimensions are read at runtime; CSS never stretches or crops video.
    video.addEventListener('loadedmetadata', () => {
      if (video.videoWidth && video.videoHeight) {
        video.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      }
    });
    control.addEventListener('click', () => {
      if (!eligible() || failed) return;
      if (!video.paused || pending) {
        manuallyPaused = true;
        video.pause();
        setControl(false);
      } else {
        manuallyPaused = false;
        userPermission = true;
        autoplayBlocked = false;
        inView = true;
        tryPlay();
      }
    });
    // Lifecycle: only the visible hero may play, and never in a hidden tab.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0.05 }).observe(frame);
    } else {
      // Conservative fallback: explicit play only, no automatic media download.
      autoplayBlocked = true;
    }
    document.addEventListener('visibilitychange', sync);
    listen(eligibleQuery, () => {
      if (!eligible()) {
        userPermission = false;
        autoplayBlocked = false;
        failed = false;
      }
      sync();
    });
    const preferenceChanged = () => {
      // A newly enabled motion/data preference requires fresh explicit consent.
      userPermission = false;
      if (restricted()) unloadVideo();
      sync();
    };
    listen(motionQuery, preferenceChanged);
    connection?.addEventListener?.('change', preferenceChanged);
    sync();
  }

  // Section reveals. Without JS, nothing is hidden.
  if ('IntersectionObserver' in window && !motionQuery.matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.05 });
    document.querySelectorAll('[data-reveal]').forEach(element => {
      if (element.getBoundingClientRect().top > innerHeight) {
        element.classList.add('reveal');
        observer.observe(element);
      }
    });
  }

  // Contact page: build an inquiry message, copy it, then open Instagram to DM.
  const form = document.querySelector('#inquiry-form');
  if (form) {
    const formStatus = document.querySelector('#form-status');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const d = new FormData(form);
      const name = (d.get('name') || '').trim();
      if (!name) {
        formStatus.textContent = 'Please add your name first.';
        form.querySelector('#f-name').focus();
        return;
      }
      const lines = [
        `Hi Dirty South Soda Co.! I'd like to ask about booking the truck.`,
        `Name: ${name}`,
        d.get('contact') && `Contact: ${d.get('contact')}`,
        `Event type: ${d.get('type')}`,
        d.get('date') && `Date: ${d.get('date')}`,
        d.get('location') && `Location: ${d.get('location')}`,
        d.get('guests') && `Guests: ${d.get('guests')}`,
        d.get('message') && `Details: ${d.get('message')}`
      ].filter(Boolean).join('\n');
      let copied = false;
      try { await navigator.clipboard.writeText(lines); copied = true; } catch (err) { copied = false; }
      formStatus.textContent = copied
        ? 'Message copied! Paste it into a DM on Instagram.'
        : 'Copy this message and send it to us on Instagram:\n\n' + lines;
      formStatus.style.whiteSpace = 'pre-line';
      window.open('https://ig.me/m/dirtysouthsodacosc', '_blank', 'noopener');
    });
  }

  // Soda bubbles on click/tap. Lightweight: capped count, removed after animating.
  if (!motionQuery.matches) {
    let live = 0;
    const MAX = 40;
    document.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const count = Math.min(7 + Math.floor(Math.random() * 4), MAX - live);
      for (let i = 0; i < count; i++) {
        const b = document.createElement('span');
        b.className = 'bubble';
        const size = 6 + Math.random() * 16;
        b.style.left = (e.clientX + (Math.random() - 0.5) * 18) + 'px';
        b.style.top = (e.clientY + (Math.random() - 0.5) * 10) + 'px';
        b.style.setProperty('--s', size.toFixed(1) + 'px');
        b.style.setProperty('--dx', ((Math.random() - 0.5) * 70).toFixed(1) + 'px');
        b.style.setProperty('--dy', (-(50 + Math.random() * 110)).toFixed(1) + 'px');
        b.style.setProperty('--d', (650 + Math.random() * 650).toFixed(0) + 'ms');
        b.style.animationDelay = (Math.random() * 90).toFixed(0) + 'ms';
        b.setAttribute('aria-hidden', 'true');
        live++;
        b.addEventListener('animationend', () => { b.remove(); live--; }, { once: true });
        document.body.appendChild(b);
      }
    }, { passive: true });
  }

  // Menu search filter.
  const search = document.querySelector('#menu-search');
  if (search) {
    const empty = document.querySelector('#menu-empty');
    const items = [...document.querySelectorAll('.item')];
    items.forEach(it => { it.dataset.text = it.textContent.toLowerCase(); });
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      items.forEach(it => { const hit = !q || it.dataset.text.includes(q); it.hidden = !hit; if (hit) shown++; });
      document.querySelectorAll('.menu-group').forEach(g => { g.hidden = !g.querySelector('.item:not([hidden])'); });
      document.querySelectorAll('.menu-section').forEach(sec => { sec.hidden = !sec.querySelector('.item:not([hidden])'); });
      empty.textContent = q ? (shown ? `${shown} match${shown === 1 ? '' : 'es'} for “${search.value.trim()}”` : `No matches for “${search.value.trim()}” — try another flavor.`) : '';
    });
  }
})();
