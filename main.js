const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
root.classList.add('js');

// ---------- Theme: light by default, remembered per visitor ----------
let palette = [];
function readPalette() {
  const css = getComputedStyle(root);
  palette = ['--build', '--market', '--community', '--raise'].map((v) => css.getPropertyValue(v).trim());
}

function syncThemeButton() {
  const dark = root.dataset.theme === 'dark';
  const btn = document.querySelector('[data-theme-toggle]');
  btn.querySelector('i').className = `ph ${dark ? 'ph-sun' : 'ph-moon'}`;
  btn.querySelector('span').textContent = dark ? 'Light' : 'Dark';
  btn.setAttribute('aria-label', dark ? 'Switch to a white background' : 'Switch to a black background');
}

document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  syncThemeButton();
  readPalette();
});

// ---------- Hero waveform: four colours that follow the cursor ----------
function wave() {
  const canvas = document.querySelector('.hero__wave');
  const g = canvas.getContext('2d');
  const pointer = { x: 0.62, target: 0.62 };
  let w = 0, h = 0, raf = 0, visible = true;
  const t0 = performance.now();

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) draw(performance.now());
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    pointer.x += (pointer.target - pointer.x) * 0.06;

    const mobile = w < 768;
    const mid = h * (mobile ? 0.34 : 0.44);
    const amp = h * (mobile ? 0.15 : 0.2);
    g.clearRect(0, 0, w, h);

    // Four bold lines (one per job colour) with a fainter echo of each behind
    for (let i = 7; i >= 0; i--) {
      const echo = i >= 4;
      g.beginPath();
      g.strokeStyle = palette[i % 4];
      g.globalAlpha = echo ? 0.35 : 1;
      g.lineWidth = echo ? 1.25 : 2.25;
      const speed = 2.2 + (i % 4) * 0.28 + (echo ? 0.5 : 0);
      const phase = (i % 4) * 0.7 + (echo ? 0.35 : 0);
      for (let x = 0; x <= w; x += 3) {
        const u = x / w;
        const env = Math.exp(-((u - pointer.x) ** 2) / 0.012)
          + 0.55 * Math.exp(-((u - 0.22) ** 2) / 0.008)
          + 0.35 * Math.exp(-((u - 0.84) ** 2) / 0.006);
        const y = mid + amp * env * Math.sin(u * 48 - t * speed + phase) * (1 - (i % 4) * 0.08);
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function frame(now) {
    draw(now);
    if (visible) raf = requestAnimationFrame(frame);
  }

  new ResizeObserver(size).observe(canvas);
  size();
  if (reduce) {
    document.querySelector('[data-theme-toggle]').addEventListener('click', () => draw(performance.now()));
    return;
  }

  canvas.parentElement.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.target = (e.clientX - r.left) / r.width;
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) raf = requestAnimationFrame(frame);
  }).observe(canvas);
}

// ---------- Videos play only while on screen ----------
function videos() {
  const vids = document.querySelectorAll('main video');
  if (reduce) {
    vids.forEach((v) => { v.controls = true; });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) target.play().catch(() => {});
      else target.pause();
    });
  }, { threshold: 0.35 });
  vids.forEach((v) => io.observe(v));
}

// ---------- Readouts count up once, when they come into view ----------
function countUp() {
  if (reduce) return;
  const format = (el, n) => `${el.dataset.prefix || ''}${n.toLocaleString('en-US')}${el.dataset.suffix || ''}`;
  const els = document.querySelectorAll('[data-count]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const el = entry.target;
      const end = Number(el.dataset.count);
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / 1400);
        el.textContent = format(el, Math.round(end * (1 - 2 ** (-10 * p))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => { el.textContent = format(el, 0); io.observe(el); });
}

// ---------- Instagram feeds scroll on their own, but only while on screen ----------
function feeds() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => target.classList.toggle('is-off', !isIntersecting));
  });
  document.querySelectorAll('.feed, .ads').forEach((f) => io.observe(f));
}

// ---------- The song: play button, seek bar and a live four-colour waveform ----------
function player() {
  const box = document.querySelector('[data-player]');
  const el = box.querySelector('audio');
  const btn = box.querySelector('.player__btn');
  const seek = box.querySelector('.player__seek');
  const time = box.querySelector('.player__time');
  const canvas = box.querySelector('.player__wave');
  const g = canvas.getContext('2d');
  const title = box.querySelector('.card__name').textContent;
  let ctx = null;
  let analyser = null;
  let data = null;
  let raf = 0;

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const total = () => (Number.isFinite(el.duration) ? el.duration : 334);
  const showTime = () => { time.textContent = `${fmt(el.currentTime)} / ${fmt(total())}`; };

  function connect() {
    if (ctx) return;
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    data = new Float32Array(analyser.fftSize);
    ctx.createMediaElementSource(el).connect(analyser);
    analyser.connect(ctx.destination);
  }

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const live = !el.paused && analyser && !reduce;
    if (live) analyser.getFloatTimeDomainData(data);
    g.clearRect(0, 0, w, h);
    // Four lines, each reading the signal slightly later, so they fan out in the job colours
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.strokeStyle = palette[k];
      g.lineWidth = 2;
      for (let x = 0; x <= w; x += 2) {
        const i = Math.min(data ? data.length - 1 : 0, Math.floor((x / w) * 1500) + k * 24);
        const v = live ? data[i] : 0;
        const y = h / 2 + v * h * 0.9 + (k - 1.5) * 2;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    if (live) raf = requestAnimationFrame(draw);
  }

  btn.addEventListener('click', () => {
    connect();
    ctx.resume();
    if (el.paused) {
      el.play();
    } else {
      el.pause();
    }
  });
  el.addEventListener('play', () => {
    btn.querySelector('i').className = 'ph ph-pause';
    btn.setAttribute('aria-label', `Pause ${title}`);
    cancelAnimationFrame(raf);
    draw();
  });
  for (const ev of ['pause', 'ended']) {
    el.addEventListener(ev, () => {
      btn.querySelector('i').className = 'ph ph-play';
      btn.setAttribute('aria-label', `Play ${title}`);
      cancelAnimationFrame(raf);
      draw();
    });
  }
  el.addEventListener('timeupdate', () => {
    seek.value = String(Math.round((el.currentTime / total()) * 1000));
    showTime();
  });
  el.addEventListener('loadedmetadata', showTime);
  seek.addEventListener('input', () => {
    el.currentTime = (Number(seek.value) / 1000) * total();
    showTime();
  });
  document.querySelector('[data-theme-toggle]').addEventListener('click', () => { if (el.paused) draw(); });

  new ResizeObserver(size).observe(canvas);
}

// ---------- Photo rail: arrow buttons step most of a screen at a time ----------
function rail() {
  const el = document.querySelector('[data-rail]');
  document.querySelectorAll('[data-rail-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.scrollBy({ left: Number(btn.dataset.railStep) * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
    });
  });
}

function reveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

readPalette();
syncThemeButton();
wave();
videos();
feeds();
player();
rail();
countUp();
reveal();
