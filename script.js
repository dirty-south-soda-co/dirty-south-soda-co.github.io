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

  // Optional section reveals. No JS means no hidden content.
  if ('IntersectionObserver' in window && !motionQuery.matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.05 });
    document.querySelectorAll('.welcome > div, .section-heading, .feature-copy, .find-layout > div, .event-copy, .about-layout > div').forEach(element => {
      if (element.getBoundingClientRect().top > innerHeight) {
        element.classList.add('reveal');
        observer.observe(element);
      }
    });
  }
})();
