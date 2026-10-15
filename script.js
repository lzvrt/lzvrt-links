const intro = document.querySelector('#intro');
const site = document.querySelector('#site');
const audio = document.querySelector('#audio');
const player = document.querySelector('#player');
const playButton = document.querySelector('#play');
const pages = [...document.querySelectorAll('.page')];
const navDots = [...document.querySelectorAll('.page-nav__dot')];
const visualizerCanvas = document.querySelector('#audio-visualizer');
const visualizerContext = visualizerCanvas.getContext('2d');
let audioContext;
let audioAnalyser;
let audioFrequencyData;
let audioSource;
let visualizerWidth = 0;
let visualizerHeight = 0;
let waveformScrollTop = 0;
let waveformScrollBottom = 0;
let waveformPulse = 0;
let waveformLevels = [];

function resizeAudioVisualizer() {
  visualizerWidth = window.innerWidth;
  visualizerHeight = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  visualizerCanvas.width = Math.round(visualizerWidth * ratio);
  visualizerCanvas.height = Math.round(visualizerHeight * ratio);
  visualizerContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function connectAudioVisualizer() {
  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext = new AudioContextClass();
      audioAnalyser = audioContext.createAnalyser();
      audioAnalyser.fftSize = 512;
      audioAnalyser.smoothingTimeConstant = .72;
      audioFrequencyData = new Uint8Array(audioAnalyser.frequencyBinCount);
      audioSource = audioContext.createMediaElementSource(audio);
      audioSource.connect(audioAnalyser);
      audioAnalyser.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch (error) {
    console.warn('Audio visualizer unavailable:', error);
  }
}

function drawAudioVisualizer() {
  const ctx = visualizerContext;
  ctx.clearRect(0, 0, visualizerWidth, visualizerHeight);
  if (audioAnalyser && audioFrequencyData) audioAnalyser.getByteFrequencyData(audioFrequencyData);
  const count = Math.max(80, Math.min(180, Math.round(visualizerWidth / 9)));
  if (waveformLevels.length !== count) waveformLevels = Array(count).fill(0);
  let spectrumEnergy = 0;
  for (let i = 0; i < count; i += 1) {
    // Mirror the frequency profile around the center so both sides move together.
    const mirroredIndex = Math.min(i, count - 1 - i);
    const position = mirroredIndex / Math.max(1, Math.floor((count - 1) / 2));
    const spectrumPosition = .012 + Math.pow(position, 1.65) * .985;
    const bin = Math.min(audioFrequencyData?.length - 1 || 0, Math.floor(spectrumPosition * (audioFrequencyData?.length || 1)));
    const rawLevel = audioFrequencyData ? audioFrequencyData[bin] / 255 : 0;
    const target = Math.min(1, Math.pow(rawLevel, .82) * 3.8);
    const smooth = target > waveformLevels[i] ? .2 : .065;
    waveformLevels[i] += (target - waveformLevels[i]) * smooth;
    spectrumEnergy += waveformLevels[i] * waveformLevels[i];
  }
  const pulseTarget = Math.min(1, Math.sqrt(spectrumEnergy / count) * 1.8);
  waveformPulse += (pulseTarget - waveformPulse) * (pulseTarget > waveformPulse ? .28 : .09);

  const phase = performance.now() * .00072;
  const drawWave = (edge, inward, scrollStretch) => {
    const pointY = (index) => {
      const x = index / (count - 1);
      const mirroredX = Math.abs(x - .5) * 2;
      const left = waveformLevels[Math.max(0, index - 2)];
      const nearLeft = waveformLevels[Math.max(0, index - 1)];
      const center = waveformLevels[index];
      const nearRight = waveformLevels[Math.min(count - 1, index + 1)];
      const right = waveformLevels[Math.min(count - 1, index + 2)];
      const audioLevel = (left + 2 * nearLeft + 3 * center + 2 * nearRight + right) / 9;
      const rollingShape = .5
        + .24 * Math.sin(mirroredX * Math.PI * 5 + phase)
        + .12 * Math.sin(mirroredX * Math.PI * 11 - phase * 1.35)
        + .06 * Math.sin(mirroredX * Math.PI * 19 + phase * .72);
      const amplitude = (3 + rollingShape * 7 + audioLevel * 66 + waveformPulse * 10)
        * Math.max(.22, 1 + scrollStretch * 2.8);
      return edge + inward * amplitude;
    };
    ctx.beginPath();
    ctx.moveTo(0, edge);
    ctx.lineTo(0, pointY(0));
    for (let i = 1; i < count; i += 1) {
      const x = i * visualizerWidth / (count - 1);
      const previousX = (i - 1) * visualizerWidth / (count - 1);
      const middleX = (previousX + x) / 2;
      const middleY = (pointY(i - 1) + pointY(i)) / 2;
      ctx.quadraticCurveTo(previousX, pointY(i - 1), middleX, middleY);
    }
    ctx.lineTo(visualizerWidth, pointY(count - 1));
    ctx.lineTo(visualizerWidth, edge);
    ctx.closePath();
    const wash = ctx.createLinearGradient(0, edge, 0, edge + inward * 180);
    wash.addColorStop(0, 'rgba(148,145,212,.14)');
    wash.addColorStop(.4, 'rgba(148,145,212,.035)');
    wash.addColorStop(1, 'rgba(148,145,212,0)');
    ctx.fillStyle = wash;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, pointY(0));
    for (let i = 1; i < count; i += 1) {
      const x = i * visualizerWidth / (count - 1);
      const previousX = (i - 1) * visualizerWidth / (count - 1);
      const middleX = (previousX + x) / 2;
      const middleY = (pointY(i - 1) + pointY(i)) / 2;
      ctx.quadraticCurveTo(previousX, pointY(i - 1), middleX, middleY);
    }
    ctx.lineTo(visualizerWidth, pointY(count - 1));
    ctx.strokeStyle = 'rgba(184,180,244,.76)';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(148,145,212,.55)';
    ctx.shadowBlur = 14;
    ctx.stroke();
  };

  drawWave(1, 1, waveformScrollTop);
  drawWave(visualizerHeight - 1, -1, waveformScrollBottom);
  ctx.shadowBlur = 0;
  requestAnimationFrame(drawAudioVisualizer);
}

resizeAudioVisualizer();
window.addEventListener('resize', resizeAudioVisualizer);
requestAnimationFrame(drawAudioVisualizer);

// Scatter muted stars and let a few of them glow briefly at random intervals.
const starCanvas = document.querySelector("#stars");
const starContext = starCanvas.getContext("2d");
let stars = [];
let starWidth = 0;
let starHeight = 0;
let starFrame = 0;
let lastStarPaint = 0;
const reduceStarMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function seedStars() {
  starWidth = window.innerWidth;
  starHeight = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  starCanvas.width = Math.round(starWidth * ratio);
  starCanvas.height = Math.round(starHeight * ratio);
  starContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  const count = Math.min(190, Math.max(75, Math.round(starWidth * starHeight / 8500)));
  const now = performance.now();
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * starWidth,
    y: Math.random() * starHeight,
    radius: .35 + Math.random() * .9,
    tint: Math.random() > .65 ? "201,198,229" : "218,216,222",
    base: .012 + Math.random() * .035,
    strength: .025 + Math.random() * .065,
    duration: 1400 + Math.random() * 2400,
    flashAt: now + Math.random() * 8000,
  }));
  paintStars(now);
}

function paintStars(now) {
  const ctx = starContext;
  ctx.clearRect(0, 0, starWidth, starHeight);
  for (const star of stars) {
    if (now >= star.flashAt) {
      star.flashStart = now;
      star.flashAt = now + 3500 + Math.random() * 9500;
    }
    const age = star.flashStart === undefined ? Infinity : now - star.flashStart;
    const progress = age / star.duration;
    const flash = progress >= 0 && progress <= 1 ? Math.sin(progress * Math.PI) * star.strength : 0;
    const alpha = star.base + flash;
    const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.radius * 5.5);
    glow.addColorStop(0, `rgba(${star.tint},${alpha})`);
    glow.addColorStop(.18, `rgba(${star.tint},${alpha * .48})`);
    glow.addColorStop(1, `rgba(${star.tint},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius * 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${star.tint},${Math.min(.2, alpha * 1.7)})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function animateStars(now) {
  if (now - lastStarPaint >= 34) {
    paintStars(now);
    lastStarPaint = now;
  }
  starFrame = requestAnimationFrame(animateStars);
}

window.addEventListener("resize", seedStars);
seedStars();
if (!reduceStarMotion) starFrame = requestAnimationFrame(animateStars);

const cursorCanvas = document.querySelector('#cursor-sparkles');
const cursorContext = cursorCanvas.getContext('2d');
const finePointer = window.matchMedia('(pointer: fine)').matches && !reduceStarMotion;
let cursorParticles = [];
let cursorWidth = 0;
let cursorHeight = 0;
let cursorFrame = 0;
let cursorLastPaint = 0;
let previousPointer = null;

function resizeCursorCanvas() {
  cursorWidth = window.innerWidth;
  cursorHeight = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  cursorCanvas.width = Math.round(cursorWidth * ratio);
  cursorCanvas.height = Math.round(cursorHeight * ratio);
  cursorContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function addCursorParticles(event) {
  if (event.pointerType === 'touch') return;
  const dx = previousPointer ? event.clientX - previousPointer.x : 0;
  const dy = previousPointer ? event.clientY - previousPointer.y : 0;
  previousPointer = { x: event.clientX, y: event.clientY };
  const count = Math.min(5, 2 + Math.floor(Math.hypot(dx, dy) / 24));
  for (let i = 0; i < count; i += 1) {
    const hue = 245 + Math.random() * 30;
    cursorParticles.push({
      x: event.clientX + (Math.random() - .5) * 8,
      y: event.clientY + (Math.random() - .5) * 8,
      vx: -dx * (.025 + Math.random() * .035) + (Math.random() - .5) * .7,
      vy: -dy * (.025 + Math.random() * .035) - Math.random() * .6,
      gravity: .012 + Math.random() * .018,
      size: 1.2 + Math.random() * 2.8,
      hue,
      life: 520 + Math.random() * 580,
      age: 0,
      spin: (Math.random() - .5) * .12,
      angle: Math.random() * Math.PI,
    });
  }
  if (cursorParticles.length > 220) cursorParticles.splice(0, cursorParticles.length - 220);
}

function drawCursorSparkles(now) {
  const delta = Math.min(40, now - (cursorLastPaint || now));
  cursorLastPaint = now;
  const ctx = cursorContext;
  ctx.clearRect(0, 0, cursorWidth, cursorHeight);
  cursorParticles = cursorParticles.filter((particle) => particle.age < particle.life);
  for (const particle of cursorParticles) {
    particle.age += delta;
    particle.x += particle.vx * delta * .055;
    particle.y += particle.vy * delta * .055 + particle.gravity * delta * .65;
    particle.vx *= .994;
    particle.vy *= .994;
    particle.angle += particle.spin * delta * .04;
    const progress = particle.age / particle.life;
    const fade = Math.sin(Math.PI * progress) * .38;
    const twinkle = .72 + Math.sin(now * .012 + particle.angle * 4) * .28;
    const radius = particle.size * (.7 + Math.sin(progress * Math.PI) * .45);
    const glow = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius * 3.5);
    glow.addColorStop(0, `hsla(${particle.hue},48%,86%,${fade * twinkle})`);
    glow.addColorStop(1, `hsla(${particle.hue},52%,70%,0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.angle);
    ctx.globalAlpha = fade * twinkle;
    ctx.fillStyle = `hsl(${particle.hue},42%,88%)`;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 1.7);
    ctx.lineTo(radius * .42, 0);
    ctx.lineTo(0, radius * 1.7);
    ctx.lineTo(-radius * .42, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  cursorFrame = requestAnimationFrame(drawCursorSparkles);
}

if (finePointer) {
  resizeCursorCanvas();
  window.addEventListener('resize', resizeCursorCanvas);
  window.addEventListener('pointermove', addCursorParticles, { passive: true });
  cursorFrame = requestAnimationFrame(drawCursorSparkles);
}

// Add audio files to /music and list their filenames here, in listening order.
const tracks = [
   { file: 'music/track-01.mp3' },
   { file: 'music/track-02.mp3' },
   { file: 'music/track-03.mp3' },
   { file: 'music/track-04.mp3' },
];
let trackIndex = 0;
let isOpen = false;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function setTrack(index, autoplay = true) {
  if (!tracks.length) return;
  trackIndex = (index + tracks.length) % tracks.length;
  const track = tracks[trackIndex];
  audio.src = track.file;
  connectAudioVisualizer();
  if (autoplay) audio.play().catch(() => setPlaying(false));
}

function setPlaying(playing) {
  player.classList.toggle('is-playing', playing);
  playButton.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
  playButton.title = playing ? 'Pause' : 'Play';
}

function enterSite() {
  if (isOpen) return;
  // Browsers may restore the previous scroll position; always reveal the profile first.
  window.scrollTo(0, 0);
  isOpen = true;
  document.body.classList.add('entered');
  intro.classList.add('is-leaving');
  site.classList.add('is-open');
  site.setAttribute('aria-hidden', 'false');
  setTimeout(() => { intro.hidden = true; }, 1100);
  setTrack(Math.floor(Math.random() * tracks.length), true);
}

document.querySelector('#enter').addEventListener('click', enterSite);
intro.addEventListener('click', (event) => {
  if (event.target !== document.querySelector('#enter')) enterSite();
});
document.addEventListener('keydown', (event) => {
  if (!isOpen && (event.key === 'Enter' || event.key === ' ')) enterSite();
});

playButton.addEventListener('click', () => {
  if (!tracks.length) return;
  if (audio.paused) audio.play().catch(() => setPlaying(false));
  else audio.pause();
});
document.querySelector('#previous').addEventListener('click', () => setTrack(trackIndex - 1));
document.querySelector('#next').addEventListener('click', () => setTrack(trackIndex + 1));
const volumeSlider = document.querySelector('#volume');
const playerVolumeGain = .14; // Keep the displayed 50% position at the existing quiet default.
function syncPlayerVolume() {
  audio.volume = Number(volumeSlider.value) * playerVolumeGain;
}
volumeSlider.addEventListener('input', syncPlayerVolume);
syncPlayerVolume();
audio.addEventListener('play', () => setPlaying(true));
audio.addEventListener('pause', () => setPlaying(false));
audio.addEventListener('ended', () => setTrack(trackIndex + 1));

function goTo(id) {
  const target = document.getElementById(id);
  if (target) animateTo(target.offsetTop);
}

let scrollFrame = 0;
let playerSettleTimer;
function animateTo(destination) {
  cancelAnimationFrame(scrollFrame);
  clearTimeout(playerSettleTimer);
  const start = window.scrollY;
  const distance = destination - start;
  if (!distance) return;
  const direction = Math.sign(distance);
  const duration = 1120;
  const started = performance.now();
  const ease = (t) => t < .5 ? 8 * t ** 4 : 1 - ((-2 * t + 2) ** 4) / 2;
  player.classList.add('is-scrolling');
  const frame = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = ease(progress);
    const waveStretch = Math.sin(progress * Math.PI);
    waveformScrollTop = direction > 0 ? waveStretch : -waveStretch * .65;
    waveformScrollBottom = direction < 0 ? waveStretch : -waveStretch * .65;
    window.scrollTo(0, start + distance * eased);
    player.style.setProperty('--player-bob', `${direction * 56 * eased}px`);
    if (progress < 1) {
      scrollFrame = requestAnimationFrame(frame);
    } else {
      playerSettleTimer = setTimeout(() => {
        player.classList.remove('is-scrolling');
        requestAnimationFrame(() => player.style.setProperty('--player-bob', '0px'));
      }, 130);
    }
  };
  scrollFrame = requestAnimationFrame(frame);
}

let wheelLocked = false;
window.addEventListener('wheel', (event) => {
  if (!isOpen || Math.abs(event.deltaY) < 3) return;
  event.preventDefault();
  const current = window.scrollY + window.innerHeight * .5;
  const pageIndex = pages.findIndex((page) => current >= page.offsetTop && current < page.offsetTop + page.offsetHeight);
  const direction = Math.sign(event.deltaY);
  if (wheelLocked) return;
  const nextIndex = Math.max(0, Math.min(pages.length - 1, (pageIndex < 0 ? 0 : pageIndex) + direction));
  if (nextIndex === pageIndex) return;
  wheelLocked = true;
  animateTo(pages[nextIndex].offsetTop);
  setTimeout(() => { wheelLocked = false; }, 1180);
}, { passive: false });

let touchOrigin = null;
document.addEventListener('touchstart', (event) => {
  if (!isOpen || event.touches.length !== 1 || event.target.closest('a, button, input, .music-player')) return;
  touchOrigin = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchmove', (event) => {
  if (!touchOrigin || event.touches.length !== 1) return;
  const dx = event.touches[0].clientX - touchOrigin.x;
  const dy = event.touches[0].clientY - touchOrigin.y;
  if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) event.preventDefault();
}, { passive: false });
document.addEventListener('touchend', (event) => {
  if (!touchOrigin) return;
  const delta = touchOrigin.y - event.changedTouches[0].clientY;
  touchOrigin = null;
  if (Math.abs(delta) < 42) return;
  const current = window.scrollY + window.innerHeight * .5;
  const pageIndex = pages.findIndex((page) => current >= page.offsetTop && current < page.offsetTop + page.offsetHeight);
  const nextIndex = Math.max(0, Math.min(pages.length - 1, (pageIndex < 0 ? 0 : pageIndex) + Math.sign(delta)));
  if (pages[nextIndex] && nextIndex !== pageIndex) animateTo(pages[nextIndex].offsetTop);
}, { passive: true });
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => goTo(button.dataset.go)));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const index = pages.indexOf(entry.target);
    navDots.forEach((dot, dotIndex) => {
      const active = dotIndex === index;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'location');
      else dot.removeAttribute('aria-current');
    });
    entry.target.classList.toggle('is-visible', index === 1);
  });
}, { threshold: .55 });
pages.forEach((page) => observer.observe(page));
navDots.forEach((dot) => dot.addEventListener('click', () => goTo(dot.dataset.go)));

document.querySelectorAll('.social-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    if (document.body.classList.contains('is-link-transitioning')) return;
    const destination = link.href;
    const rect = link.getBoundingClientRect();
    const diameter = Math.max(rect.width, rect.height);
    const coverScale = Math.ceil(Math.hypot(window.innerWidth, window.innerHeight) / diameter * 1.35);
    const transition = document.createElement('div');
    transition.className = 'link-transition';
    const button = document.createElement('div');
    button.className = 'link-transition__button';
    button.style.setProperty('--link-left', `${rect.left}px`);
    button.style.setProperty('--link-top', `${rect.top}px`);
    button.style.setProperty('--link-width', `${rect.width}px`);
    button.style.setProperty('--link-height', `${rect.height}px`);
    button.style.setProperty('--cover-scale', coverScale);
    const mark = link.querySelector('.social-link__icon').cloneNode(true);
    button.appendChild(mark);
    transition.appendChild(button);
    document.body.appendChild(transition);
    document.body.classList.add('is-link-transitioning');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const runLinkLaunch = async () => {
      if (reducedMotion) {
        await button.animate([
          { transform: 'scale(1)' },
          { transform: `scale(${coverScale})`, backgroundColor: '#9491d4' },
        ], { duration: 650, easing: 'ease-in-out', fill: 'forwards' }).finished;
      } else {
        await button.animate([
          { transform: 'translateY(0) scale(1)' },
          { transform: 'translateY(-29px) scale(1.16)', offset: .28 },
          { transform: 'translateY(0) scale(1)', offset: .58 },
          { transform: 'translateY(-8px) scale(1.045)', offset: .78 },
          { transform: 'translateY(0) scale(1)' },
        ], { duration: 680, easing: 'cubic-bezier(.2,.85,.25,1)', fill: 'forwards' }).finished;
        const expandAnimation = button.animate([
          { transform: 'translateY(0) scale(1)', backgroundColor: 'rgba(148,145,212,.48)', boxShadow: '0 0 0 8px rgba(148,145,212,.08), 0 0 40px rgba(148,145,212,.3)' },
          { transform: `translateY(0) scale(${coverScale})`, backgroundColor: '#9491d4', boxShadow: '0 0 90px rgba(148,145,212,.5)' },
        ], { duration: 1120, easing: 'cubic-bezier(.68,0,.16,1)', fill: 'forwards' }).finished;
        const markFade = mark.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 440,
          delay: 170,
          easing: 'ease-out',
          fill: 'forwards',
        }).finished;
        await Promise.all([expandAnimation, markFade]);
      }

      // Launch the destination while the selected icon still covers the page.
      const popup = window.open(destination, '_blank');
      if (!popup) {
        window.location.assign(destination);
        return;
      }
      popup.opener = null;

      // Only uncover the original page after the destination has been launched.
      await transition.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: reducedMotion ? 100 : 360,
        easing: 'cubic-bezier(.22,.8,.25,1)',
        fill: 'forwards',
      }).finished;
      transition.remove();
      document.body.classList.remove('is-link-transitioning');
    };
    runLinkLaunch().catch((error) => {
      console.warn('Link transition could not finish:', error);
      window.location.assign(destination);
    });
  });
});
