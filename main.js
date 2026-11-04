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

// ---------- The map: one row per venture, one column per job ----------
const JOBS = [
  { name: 'Build', href: '#build' },
  { name: 'Market', href: '#market' },
  { name: 'Sell & raise', href: '#raise' },
  { name: 'Community', href: '#community' },
];
// Each entry in `jobs` is where that pad jumps to on the page, or null if it's not a job I did there
const VENTURES = [
  { name: 'Sitti', role: 'Co-founder', jobs: ['#sitti', '#m-sitti', '#r-sitti', null] },
  { name: 'Karos Labs', role: 'Founding team', jobs: ['#karos', '#m-karos', '#r-karos', null] },
  { name: 'Outside Club', role: 'Marketing & product', jobs: ['#m-outside', '#m-outside', null, null] },
  { name: 'WHYL', role: 'Social media manager', jobs: [null, '#m-whyl', null, null] },
  { name: 'Your Passepartout', role: 'Web & automation', jobs: ['#passepartout', '#passepartout', null, null] },
  { name: 'Lucky Egg', role: 'Summer 2026', jobs: [null, '#m-luckyegg', null, null] },
  { name: 'Bento Games', role: 'Side project', jobs: ['#bento', null, null, null] },
  { name: 'Smart Glove', role: 'In progress', jobs: ['#glove', null, null, null] },
  { name: 'First Chair', role: 'Side project', jobs: ['#firstchair', null, null, null] },
  { name: 'Project impACT', role: 'Senior ambassador', jobs: [null, null, '#r-impact', '#c-impact'] },
];

function renderGrid() {
  const table = document.querySelector('[data-grid]');
  // Soft hyphen lets "Community" break on narrow phones instead of overflowing its column
  const head = JOBS.map((job, c) => `<th scope="col" data-col="${c}"><a href="${job.href}">${job.name.replace('Community', 'Commu&shy;nity')}</a></th>`).join('');
  const rows = VENTURES.map((v) => {
    const cells = v.jobs.map((href, c) => (href
      ? `<td data-col="${c}"><a class="pad on" href="${href}"><span class="sr">${v.name}: ${JOBS[c].name}</span></a></td>`
      : `<td data-col="${c}"><span class="pad"></span></td>`)).join('');
    return `<tr><th scope="row"><span class="venture">${v.name}</span><span class="venture-role">${v.role}</span></th>${cells}</tr>`;
  }).join('');
  table.innerHTML = `<caption class="sr">Which jobs I've done at each company</caption><colgroup><col class="c-name"><col span="4"></colgroup><thead><tr><td></td>${head}</tr></thead><tbody>${rows}</tbody>`;
}

// ---------- Sound: the grid plays as a four-beat loop ----------
const BPM = 124;
const BEAT = 60 / BPM;
// A minor pentatonic, top row highest
const NOTES = [784, 659.25, 587.33, 523.25, 440, 392, 329.63, 293.66, 261.63, 220];

const audio = { ctx: null, master: null, analyser: null, data: null, noise: null, playing: false, step: 0, next: 0, timer: 0 };

function initAudio() {
  const ctx = new AudioContext();
  const comp = ctx.createDynamicsCompressor();
  const master = ctx.createGain();
  const analyser = ctx.createAnalyser();
  master.gain.value = 0.5;
  analyser.fftSize = 1024;
  master.connect(comp);
  comp.connect(ctx.destination);
  comp.connect(analyser);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

  Object.assign(audio, { ctx, master, analyser, noise, data: new Float32Array(analyser.fftSize) });
}

function kick(t) {
  const { ctx, master } = audio;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.34);
}

function hat(t) {
  const { ctx, master, noise } = audio;
  const s = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  s.buffer = noise;
  hp.type = 'highpass';
  hp.frequency.value = 7500;
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  s.connect(hp).connect(g).connect(master);
  s.start(t);
  s.stop(t + 0.06);
}

function pluck(freq, t) {
  const { ctx, master } = audio;
  const tri = ctx.createOscillator();
  const saw = ctx.createOscillator();
  const sawGain = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  tri.type = 'triangle';
  saw.type = 'sawtooth';
  tri.frequency.value = freq;
  saw.frequency.value = freq * 1.005;
  sawGain.gain.value = 0.25;
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.exponentialRampToValueAtTime(600, t + 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  tri.connect(lp);
  saw.connect(sawGain).connect(lp);
  lp.connect(g).connect(master);
  for (const o of [tri, saw]) { o.start(t); o.stop(t + 0.45); }
}

function scheduleStep(step, t) {
  kick(t);
  hat(t + BEAT / 2);
  VENTURES.forEach((v, i) => { if (v.jobs[step]) pluck(NOTES[i], t + i * 0.028); });

  setTimeout(() => showStep(step), Math.max(0, (t - audio.ctx.currentTime) * 1000));
}

function tick() {
  while (audio.next < audio.ctx.currentTime + 0.12) {
    scheduleStep(audio.step, audio.next);
    audio.next += BEAT;
    audio.step = (audio.step + 1) % JOBS.length;
  }
}

function showStep(step) {
  if (!audio.playing && step >= 0) return;
  document.querySelectorAll('[data-grid] .is-step').forEach((el) => el.classList.remove('is-step'));
  if (step < 0) return;
  document.querySelectorAll(`[data-grid] [data-col="${step}"]`).forEach((el) => {
    el.classList.add('is-step');
    const pad = el.querySelector('.pad.on');
    if (pad) {
      pad.classList.add('hit');
      setTimeout(() => pad.classList.remove('hit'), 140);
    }
  });
}

function start() {
  if (!audio.ctx) initAudio();
  document.querySelector('[data-player] audio')?.pause();
  audio.ctx.resume();
  audio.playing = true;
  audio.step = 0;
  audio.next = audio.ctx.currentTime + 0.06;
  tick();
  audio.timer = setInterval(tick, 25);
  syncSoundButtons();
}

function stop() {
  clearInterval(audio.timer);
  audio.playing = false;
  showStep(-1);
  syncSoundButtons();
}

function syncSoundButtons() {
  document.querySelectorAll('[data-sound]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(audio.playing));
    const icon = btn.querySelector('i');
    const label = btn.querySelector('span');
    if (btn.classList.contains('tool')) {
      icon.className = `ph ${audio.playing ? 'ph-speaker-high' : 'ph-speaker-slash'}`;
    } else {
      icon.className = `ph ${audio.playing ? 'ph-stop' : 'ph-play'}`;
      label.textContent = audio.playing ? 'Stop' : 'Play the grid';
    }
  });
}

document.querySelectorAll('[data-sound]').forEach((btn) => {
  btn.addEventListener('click', () => (audio.playing ? stop() : start()));
});

// ---------- Hero waveform: four colours, follows the cursor and the beat ----------
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

    let level = 0;
    const live = audio.playing && audio.analyser;
    if (live) {
      audio.analyser.getFloatTimeDomainData(audio.data);
      let sum = 0;
      for (const v of audio.data) sum += v * v;
      level = Math.sqrt(sum / audio.data.length);
    }

    const mobile = w < 768;
    const mid = h * (mobile ? 0.34 : 0.44);
    const amp = h * (mobile ? 0.15 : 0.2) * (1 + level * 4);
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
        let y = mid + amp * env * Math.sin(u * 48 - t * speed + phase) * (1 - (i % 4) * 0.08);
        if (live && i === 0) y += audio.data[Math.floor(u * (audio.data.length - 1))] * amp * 1.6;
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
  let analyser = null;
  let data = null;
  let raf = 0;

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const total = () => (Number.isFinite(el.duration) ? el.duration : 334);
  const showTime = () => { time.textContent = `${fmt(el.currentTime)} / ${fmt(total())}`; };

  function connect() {
    if (analyser) return;
    if (!audio.ctx) initAudio();
    analyser = audio.ctx.createAnalyser();
    analyser.fftSize = 2048;
    data = new Float32Array(analyser.fftSize);
    audio.ctx.createMediaElementSource(el).connect(analyser);
    analyser.connect(audio.ctx.destination);
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
    audio.ctx.resume();
    if (el.paused) {
      if (audio.playing) stop();
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
renderGrid();
wave();
videos();
feeds();
player();
rail();
countUp();
reveal();
