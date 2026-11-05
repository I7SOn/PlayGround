import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { buildWorld } from './world.js';
import { Effects } from './effects.js';
import { Weapon } from './weapon.js';
import { EnemyManager } from './enemies.js';
import { resolveCircle } from './physics.js';
import { audio } from './audio.js';

const $ = id => document.getElementById(id);
const isTouch = window.matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window) && innerWidth < 980);
const params = new URLSearchParams(location.search);
const DEBUG_LITE = params.has('lite');
const DEBUG_NOWORLD = params.has('noworld');
const DEBUG_NOENV = params.has('noenv');
const DEBUG_NOFX = params.has('nofx');
const DEBUG_NOSHADOW = params.has('noshadow');
const clamp = THREE.MathUtils.clamp;
const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);
const canvas = renderer.domElement;

const glInfo = (() => {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  } catch { return ''; }
})();
const IS_SOFTWARE = /swiftshader|llvmpipe|software|mesa offscreen/i.test(glInfo) || !glInfo;
if (IS_SOFTWARE) document.documentElement.classList.add('perf-lite');
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.2 : 1.65) * (IS_SOFTWARE ? 0.8 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !IS_SOFTWARE && !DEBUG_NOSHADOW;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.04, 320);
camera.rotation.order = 'YXZ';
scene.add(camera);

if (!IS_SOFTWARE && !DEBUG_NOENV) {
  try {
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 256;
    envCanvas.height = 128;
    const ectx = envCanvas.getContext('2d');
    const grad = ectx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#07111c');
    grad.addColorStop(0.46, '#0c1b28');
    grad.addColorStop(0.56, '#24313a');
    grad.addColorStop(0.66, '#131a1e');
    grad.addColorStop(1, '#05080a');
    ectx.fillStyle = grad;
    ectx.fillRect(0, 0, 256, 128);
    const spot = ectx.createRadialGradient(196, 58, 1, 196, 58, 34);
    spot.addColorStop(0, 'rgba(255,176,92,0.8)');
    spot.addColorStop(1, 'rgba(255,120,30,0)');
    ectx.fillStyle = spot;
    ectx.fillRect(160, 20, 80, 76);
    const cyan = ectx.createRadialGradient(52, 62, 1, 52, 62, 30);
    cyan.addColorStop(0, 'rgba(80,210,240,0.55)');
    cyan.addColorStop(1, 'rgba(40,120,160,0)');
    ectx.fillStyle = cyan;
    ectx.fillRect(18, 24, 72, 76);
    const env = new THREE.CanvasTexture(envCanvas);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.colorSpace = THREE.SRGBColorSpace;
    scene.environment = env;
    scene.environmentIntensity = 0.5;
  } catch (error) {
    console.warn('Environment map unavailable', error);
  }
}

const world = DEBUG_NOWORLD
  ? { root: new THREE.Group(), colliders: [], occluders: [], spawnPoints: [], update() {}, lampLights: [], moonLight: null, hemi: null, floor: null }
  : buildWorld(scene, renderer, { low: IS_SOFTWARE });
const effects = DEBUG_NOFX ? { update() {}, impact() {}, tracer() {}, muzzleFlash() {}, spawnRing() {}, deathBurst() {}, explode() {}, smokeAt() {}, spriteAt() {}, casing() {}, ring() {} } : new Effects(scene);
const weapon = new Weapon(camera, effects);
weapon.group.visible = false;
// A short-range fill light rides with the viewmodel so the rifle reads clearly
// even on machines without an environment map.
const gunLight = new THREE.PointLight(0xc3ddf2, 0.85, 2.2, 2);
gunLight.position.set(0.14, 0.34, 0.42);
weapon.group.add(gunLight);

let headLight = null;
if (!IS_SOFTWARE) {
  headLight = new THREE.SpotLight(0xcfe6ff, 0, 46, 0.48, 0.72, 1.5);
  headLight.position.set(0, 0.05, 0);
  headLight.target.position.set(0, -0.05, -1);
  camera.add(headLight);
  camera.add(headLight.target);
}

const manager = new EnemyManager(scene, world, effects, {
  onPlayerHit(amount) { damagePlayer(amount); }
});

// ---------------- post processing ----------------
const USE_POST = !IS_SOFTWARE && !DEBUG_LITE;
let composer = null;
let bloom = null;
let gradePass = null;
let smaa = null;
if (USE_POST) {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.55, 0.66);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    damage: { value: 0 },
    lowHealth: { value: 0 },
    flash: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float damage;
    uniform float lowHealth;
    uniform float flash;
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      float ca = 0.0013 + lowHealth * 0.0024 + damage * 0.0012;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;

      float vig = smoothstep(1.05, 0.24, length(c) * 1.18);
      col *= mix(0.46, 1.0, vig);

      float edge = smoothstep(0.10, 0.62, length(c));
      col = mix(col, vec3(0.35, 0.006, 0.004), clamp(damage, 0.0, 1.0) * edge * 0.62);
      float pulse = 0.45 + 0.28 * sin(time * 5.6);
      col += vec3(0.17, 0.004, 0.003) * lowHealth * edge * pulse;

      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(0.91, 1.02, 1.09), smoothstep(0.55, 0.04, luma) * 0.42);
      col = mix(col, col * vec3(1.06, 1.01, 0.92), smoothstep(0.55, 0.96, luma) * 0.34);

      float n = fract(sin(dot(uv * vec2(129.898, 78.233) + time, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.018;
      col *= 1.0 - 0.013 * sin(uv.y * 900.0);
      col += vec3(flash);
      gl_FragColor = vec4(col, 1.0);
    }
  `
};
if (composer) {
  gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);
  if (!isTouch) {
    smaa = new SMAAPass(innerWidth, innerHeight);
    composer.addPass(smaa);
  }
}

// ---------------- state ----------------
const G = {
  state: 'menu',
  health: 100,
  maxHealth: 100,
  score: 0,
  kills: 0,
  headshots: 0,
  shots: 0,
  hits: 0,
  wave: 0,
  waveTotal: 5,
  queue: [],
  activeWave: false,
  spawnTimer: 0,
  startDelay: 0,
  intermission: 0,
  elapsed: 0,
  playTime: 0,
  lastDamage: -99,
  damagePulse: 0,
  flashPulse: 0,
  shake: 0,
  combo: 1,
  lastKill: -99,
  toastTimer: 0,
  hitmarker: 0,
  endTimer: 0,
  endWin: false,
  hadLock: false,
  lowHealthBeat: 0,
  best: Number(localStorage.getItem('blacksite.best') || 0)
};

const P = {
  pos: new THREE.Vector3(0, 0, 16),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: -0.015,
  vy: 0,
  onGround: true,
  crouching: false,
  sprinting: false,
  ads: false,
  eye: 1.72,
  eyeTarget: 1.72,
  speed: 0,
  bobPhase: 0,
  lookX: 0,
  lookY: 0,
  roll: 0,
  jumpQueued: false,
  land: 0,
  cameraY: 1.72
};

const input = {
  keys: new Set(),
  trigger: false,
  ads: false,
  touchForward: 0,
  touchRight: 0,
  touchLookSensitivity: 0.0044,
  sensitivity: Number(localStorage.getItem('blacksite.sens') || 0.9),
  volume: Number(localStorage.getItem('blacksite.vol') || 70)
};

// ---------------- HUD refs ----------------
const hud = $('hud');
const startScreen = $('start-screen');
const pauseScreen = $('pause-screen');
const endScreen = $('end-screen');
const touchUi = $('touch-ui');
const crosshair = $('crosshair');
const hitmarkerEl = $('hitmarker');
const ammoDots = $('ammo-dots');

for (let i = 0; i < 30; i++) {
  const dot = document.createElement('i');
  ammoDots.appendChild(dot);
}
const ammoDotEls = [...ammoDots.children];

const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compassStrip = $('compass-strip');
for (let copy = 0; copy < 3; copy++) {
  for (let i = 0; i < 16; i++) {
    const mark = document.createElement('span');
    mark.className = 'compass-mark' + (i % 2 === 0 ? ' major' : '');
    if (i % 2 === 0) mark.textContent = directions[(i / 2) % 8];
    compassStrip.appendChild(mark);
  }
}

$('best-score').textContent = String(G.best).padStart(6, '0');
$('sens-slider').value = input.sensitivity;
$('sens-out').textContent = input.sensitivity.toFixed(1);
$('vol-slider').value = input.volume;
$('vol-out').textContent = input.volume;
$('pause-sens').value = input.sensitivity;
$('pause-sens-out').textContent = input.sensitivity.toFixed(1);
$('pause-vol').value = input.volume;
$('pause-vol-out').textContent = input.volume;

function updateSensitivity(value) {
  input.sensitivity = clamp(Number(value), 0.2, 2.5);
  localStorage.setItem('blacksite.sens', String(input.sensitivity));
  for (const el of [$('sens-slider'), $('pause-sens')]) el.value = input.sensitivity;
  for (const el of [$('sens-out'), $('pause-sens-out')]) el.textContent = input.sensitivity.toFixed(1);
  if (G.state === 'playing' && document.pointerLockElement !== canvas && !isTouch) canvas.requestPointerLock?.();
}
function updateVolume(value) {
  input.volume = clamp(Number(value), 0, 100);
  audio.setVolume(input.volume / 100);
  localStorage.setItem('blacksite.vol', String(input.volume));
  for (const el of [$('vol-slider'), $('pause-vol')]) el.value = input.volume;
  for (const el of [$('vol-out'), $('pause-vol-out')]) el.textContent = input.volume;
}
$('sens-slider').addEventListener('input', e => updateSensitivity(e.target.value));
$('pause-sens').addEventListener('input', e => updateSensitivity(e.target.value));
$('vol-slider').addEventListener('input', e => updateVolume(e.target.value));
$('pause-vol').addEventListener('input', e => updateVolume(e.target.value));

// ---------------- input ----------------
window.addEventListener('keydown', e => {
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ControlLeft', 'KeyR'].includes(e.code)) e.preventDefault();
  input.keys.add(e.code);
  if (e.code === 'Space') P.jumpQueued = true;
  if (e.code === 'KeyR' && G.state === 'playing') weapon.startReload();
  if (e.code === 'Escape' && G.state === 'playing') {
    if (isTouch || document.pointerLockElement !== canvas) pauseGame();
  }
});
window.addEventListener('keyup', e => input.keys.delete(e.code));
window.addEventListener('blur', () => {
  input.keys.clear();
  input.trigger = false;
  input.ads = false;
  if (G.state === 'playing') pauseGame();
});

canvas.addEventListener('mousedown', e => {
  if (G.state !== 'playing' || isTouch) return;
  if (e.button === 0) input.trigger = true;
  if (e.button === 2) input.ads = true;
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) input.trigger = false;
  if (e.button === 2) input.ads = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('click', () => {
  if (G.state === 'playing' && !isTouch && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
});
document.addEventListener('mousemove', e => {
  if (G.state !== 'playing' || document.pointerLockElement !== canvas) return;
  const sens = 0.00185 * input.sensitivity;
  P.yaw -= e.movementX * sens;
  P.pitch -= e.movementY * sens;
  P.pitch = clamp(P.pitch, -1.36, 1.34);
  P.lookX += e.movementX;
  P.lookY += e.movementY;
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    G.hadLock = true;
    $('capture-prompt').classList.add('hidden');
    if (G.state === 'paused') { pauseScreen.classList.add('hidden'); G.state = 'playing'; }
  } else if (G.state === 'playing' && G.hadLock && !isTouch) {
    pauseGame(true);
  }
});

$('start-btn').addEventListener('click', () => startGame());
$('again-btn').addEventListener('click', () => startGame());
$('resume-btn').addEventListener('click', () => resumeGame());
$('abort-btn').addEventListener('click', () => showMenu());
$('menu-btn').addEventListener('click', () => showMenu());

function setupTouch() {
  const moveZone = $('move-zone');
  const knob = $('move-knob');
  const lookZone = $('look-zone');
  let moveId = null;
  let lookId = null;
  let lastX = 0, lastY = 0;
  let originX = 0, originY = 0;

  moveZone.addEventListener('pointerdown', e => {
    moveId = e.pointerId;
    moveZone.setPointerCapture(e.pointerId);
    const r = moveZone.getBoundingClientRect();
    originX = r.left + r.width / 2;
    originY = r.top + r.height / 2;
    onMove(e);
  });
  function onMove(e) {
    if (e.pointerId !== moveId) return;
    const dx = e.clientX - originX;
    const dy = e.clientY - originY;
    const max = 44;
    const len = Math.hypot(dx, dy);
    const f = len > max ? max / len : 1;
    const kx = dx * f;
    const ky = dy * f;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
    input.touchRight = clamp(kx / max, -1, 1);
    input.touchForward = clamp(-ky / max, -1, 1);
    e.preventDefault();
  }
  moveZone.addEventListener('pointermove', onMove);
  const endMove = e => {
    if (e.pointerId !== moveId) return;
    moveId = null;
    input.touchForward = 0;
    input.touchRight = 0;
    knob.style.transform = '';
  };
  moveZone.addEventListener('pointerup', endMove);
  moveZone.addEventListener('pointercancel', endMove);

  lookZone.addEventListener('pointerdown', e => {
    lookId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    lookZone.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  lookZone.addEventListener('pointermove', e => {
    if (e.pointerId !== lookId || G.state !== 'playing') return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    P.yaw -= dx * input.touchLookSensitivity;
    P.pitch -= dy * input.touchLookSensitivity;
    P.pitch = clamp(P.pitch, -1.36, 1.34);
    P.lookX += dx;
    P.lookY += dy;
    e.preventDefault();
  });
  const endLook = e => { if (e.pointerId === lookId) lookId = null; };
  lookZone.addEventListener('pointerup', endLook);
  lookZone.addEventListener('pointercancel', endLook);

  const hold = (id, on, off) => {
    const el = $(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.dataset.active = 'true'; on(); });
    const end = e => { e.preventDefault(); el.dataset.active = 'false'; off?.(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
  };
  hold('btn-fire', () => { input.trigger = true; }, () => { input.trigger = false; });
  const adsBtn = $('btn-ads');
  adsBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    input.ads = !input.ads;
    adsBtn.dataset.active = String(input.ads);
  });
  hold('btn-reload', () => weapon.startReload());
  hold('btn-jump', () => { P.jumpQueued = true; });
  hold('btn-pause', () => pauseGame());
}

if (isTouch) setupTouch();

// ---------------- game flow ----------------
function startGame() {
  audio.init();
  audio.resume();
  audio.setVolume(input.volume / 100);
  startScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  if (isTouch) touchUi.classList.remove('hidden');
  weapon.group.visible = true;
  manager.clear();
  resetState();
  G.state = 'playing';
  if (headLight) headLight.intensity = 210;
  G.startDelay = 0;
  beginWave(1);
  try { if (!isTouch) canvas.requestPointerLock?.(); } catch {}
  if (!isTouch) $('capture-prompt').classList.add('hidden');
  updateHUD(0);
}

function resetState() {
  G.health = G.maxHealth;
  G.score = 0;
  G.kills = 0;
  G.headshots = 0;
  G.shots = 0;
  G.hits = 0;
  G.wave = 0;
  G.queue = [];
  G.activeWave = false;
  G.spawnTimer = 0;
  G.startDelay = 0.7;
  G.intermission = 0;
  G.elapsed = 0;
  G.playTime = 0;
  G.lastDamage = -99;
  G.damagePulse = 0;
  G.flashPulse = 0;
  G.shake = 0;
  G.combo = 1;
  G.lastKill = -99;
  G.endTimer = 0;
  G.hitmarker = 0;
  G.hadLock = false;
  P.pos.set(0, 0, 16);
  P.vel.set(0, 0, 0);
  P.yaw = 0;
  P.pitch = -0.015;
  P.vy = 0;
  P.onGround = true;
  P.crouching = false;
  P.sprinting = false;
  P.ads = false;
  P.eye = 1.72;
  P.eyeTarget = 1.72;
  P.speed = 0;
  P.bobPhase = 0;
  P.lookX = 0;
  P.lookY = 0;
  P.roll = 0;
  P.jumpQueued = false;
  P.land = 0;
  input.trigger = false;
  input.ads = false;
  input.touchForward = 0;
  input.touchRight = 0;
  weapon.reset();
  weapon.setAds(false);
  crosshair.classList.remove('ads');
  camera.fov = 78;
  camera.updateProjectionMatrix();
  updateCamera(0);
  updateHUD(0);
}

function showMenu() {
  G.state = 'menu';
  manager.clear();
  weapon.group.visible = false;
  if (headLight) headLight.intensity = 0;
  hud.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  touchUi.classList.add('hidden');
  input.trigger = false;
  input.ads = false;
  $('best-score').textContent = String(G.best).padStart(6, '0');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function pauseGame(fromLock = false) {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  input.trigger = false;
  input.ads = false;
  weapon.triggerHeld = false;
  if (headLight) headLight.intensity = 0;
  $('pause-wave').textContent = String(Math.max(1, G.wave)).padStart(2, '0');
  $('pause-score').textContent = String(G.score).padStart(6, '0');
  $('pause-kills').textContent = String(G.kills);
  pauseScreen.classList.remove('hidden');
  touchUi.classList.add('hidden');
  $('capture-prompt').classList.add('hidden');
  if (!fromLock && document.pointerLockElement === canvas) document.exitPointerLock();
}

function resumeGame() {
  pauseScreen.classList.add('hidden');
  G.state = 'playing';
  if (headLight) headLight.intensity = 210;
  if (isTouch) touchUi.classList.remove('hidden');
  if (!isTouch) try { canvas.requestPointerLock?.(); } catch {}
}

function endGame(win) {
  if (G.state !== 'playing' && G.state !== 'paused') return;
  G.state = win ? 'won' : 'dead';
  G.endWin = win;
  input.trigger = false;
  input.ads = false;
  touchUi.classList.add('hidden');
  $('capture-prompt').classList.add('hidden');
  if (win) {
    G.score += 2500;
    audio.win();
  } else {
    audio.lose();
  }
  if (G.score > G.best) {
    G.best = G.score;
    localStorage.setItem('blacksite.best', String(G.best));
  }
  const accuracy = G.shots > 0 ? Math.round((G.hits / G.shots) * 100) : 0;
  const mm = String(Math.floor(G.elapsed / 60)).padStart(2, '0');
  const ss = String(Math.floor(G.elapsed % 60)).padStart(2, '0');
  $('end-kicker').innerHTML = win
    ? '<span class="live-dot"></span> MISSION COMPLETE'
    : '<span class="live-dot" style="background:#ff3f3f;box-shadow:0 0 9px #ff3f3f"></span> SIGNAL LOST';
  $('end-title').textContent = win ? 'EXTRACTION' : 'OPERATOR DOWN';
  $('end-copy').textContent = win
    ? 'All five hostile waves neutralized. The yard is secure. Good work, operator.'
    : `You held for ${G.wave || 1} wave${G.wave === 1 ? '' : 's'}. Command is sending another operator.`;
  $('end-score').textContent = String(G.score).padStart(6, '0');
  $('end-kills').textContent = String(G.kills);
  $('end-accuracy').textContent = accuracy + '%';
  $('end-time').textContent = `${mm}:${ss}`;
  $('end-best').textContent = String(G.best).padStart(6, '0');
  endScreen.classList.remove('hidden');
  $('best-score').textContent = String(G.best).padStart(6, '0');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

// ---------------- waves ----------------
function beginWave(n) {
  G.wave = n;
  G.activeWave = true;
  G.spawnTimer = 0.55;
  G.intermission = 0;
  const counts = [4, 6, 8, 10, 12];
  const count = counts[n - 1] || 8;
  G.queue = [];
  for (let i = 0; i < count; i++) G.queue.push(false);
  if (n === G.waveTotal) G.queue[G.queue.length - 1] = true;
  G.waveCleared = false;
  showToast(`WAVE 0${n}`, n === G.waveTotal ? 'HEAVY UNIT INBOUND' : 'ELIMINATE ALL HOSTILES');
  audio.waveStart(n);
}

function spawnOne() {
  const boss = G.queue.shift() === true;
  const candidates = world.spawnPoints
    .map(p => ({ p, d: Math.hypot(p.x - P.pos.x, p.z - P.pos.z) }))
    .sort((a, b) => b.d - a.d);
  const choice = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))].p;
  const spawn = { x: choice.x + (Math.random() - 0.5) * 2.5, z: choice.z + (Math.random() - 0.5) * 2.5 };
  manager.spawn(spawn, boss);
  if (boss) {
    showToast('WARNING', 'HEAVY UNIT INBOUND');
    G.shake = Math.max(G.shake, 0.25);
  }
}

function updateWaves(dt) {
  if (G.startDelay > 0) {
    G.startDelay -= dt;
    if (G.startDelay <= 0) beginWave(1);
    return;
  }
  if (G.intermission > 0) {
    G.intermission -= dt;
    if (G.intermission <= 0) beginWave(G.wave + 1);
    return;
  }
  if (G.endTimer > 0) {
    G.endTimer -= dt;
    if (G.endTimer <= 0) endGame(true);
    return;
  }
  if (!G.activeWave) return;

  G.spawnTimer -= dt;
  const maxAlive = Math.min(7, 3 + G.wave);
  if (G.queue.length > 0 && G.spawnTimer <= 0 && manager.alive < maxAlive) {
    spawnOne();
    G.spawnTimer = Math.max(0.35, 1.05 - G.wave * 0.1);
  }

  if (G.queue.length === 0 && manager.alive === 0 && !G.waveCleared) {
    G.waveCleared = true;
    G.activeWave = false;
    G.score += 350 * G.wave;
    weapon.reserve = Math.min(300, weapon.reserve + 45);
    G.health = Math.min(G.maxHealth, G.health + 18);
    if (G.wave >= G.waveTotal) {
      showToast('SECTOR SECURE', 'EXTRACTION INBOUND');
      audio.waveClear();
      G.endTimer = 2.2;
    } else {
      G.intermission = 4;
      showToast('WAVE CLEAR', 'REGROUP // SUPPLIES INBOUND');
      audio.waveClear();
    }
  }
}

// ---------------- player ----------------
function updatePlayer(dt) {
  const k = input.keys;
  const forwardInput = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + input.touchForward;
  const rightInput = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + input.touchRight;
  const inLen = Math.hypot(forwardInput, rightInput);
  const f = inLen > 1 ? forwardInput / inLen : forwardInput;
  const r = inLen > 1 ? rightInput / inLen : rightInput;

  P.crouching = k.has('ControlLeft') || k.has('ControlRight');
  const wantsSprint = (k.has('ShiftLeft') || k.has('ShiftRight')) && f > 0.15 && !input.ads && !P.crouching;
  P.sprinting = wantsSprint && inLen > 0.1;
  P.ads = input.ads && !P.sprinting;
  weapon.setAds(P.ads);

  const speed = P.crouching ? 2.55 : (P.sprinting ? 8.4 : (P.ads ? 3.3 : 5.35));
  const fwdX = -Math.sin(P.yaw);
  const fwdZ = -Math.cos(P.yaw);
  const rightX = Math.cos(P.yaw);
  const rightZ = -Math.sin(P.yaw);
  const targetX = (fwdX * f + rightX * r) * speed;
  const targetZ = (fwdZ * f + rightZ * r) * speed;
  const accel = P.onGround ? (inLen > 0.05 ? 13 : 16) : 3.4;
  P.vel.x = damp(P.vel.x, targetX, accel, dt);
  P.vel.z = damp(P.vel.z, targetZ, accel, dt);
  P.pos.x += P.vel.x * dt;
  P.pos.z += P.vel.z * dt;
  resolveCircle(P.pos, 0.36, world.colliders);
  P.pos.x = clamp(P.pos.x, -28.9, 28.9);
  P.pos.z = clamp(P.pos.z, -29.7, 25.5);
  P.speed = Math.hypot(P.vel.x, P.vel.z);

  // vertical
  if (P.jumpQueued) {
    P.jumpQueued = false;
    if (P.onGround) {
      P.vy = 5.76;
      P.onGround = false;
    }
  }
  if (!P.onGround) {
    P.vy -= 17.5 * dt;
    P.pos.y += P.vy * dt;
    if (P.pos.y <= 0) {
      P.pos.y = 0;
      P.vy = 0;
      P.onGround = true;
      P.land = 1;
      G.shake = Math.max(G.shake, 0.055);
    }
  }
  P.land = Math.max(0, P.land - dt * 5);

  // view height
  P.eyeTarget = P.crouching ? 1.22 : 1.72;
  P.eye = damp(P.eye, P.eyeTarget, 12, dt);
  P.roll = damp(P.roll, -r * (P.sprinting ? 0.014 : 0.007), 8, dt);

  const moveFactor = Math.min(1, P.speed / 5.4);
  P.bobPhase += dt * (5.8 + moveFactor * 4.5) * (P.onGround ? 1 : 0.2);
  const bobAmp = moveFactor * (1 - weapon.adsAmount * 0.78) * (P.sprinting ? 1.5 : 1);
  P.cameraY = P.pos.y + P.eye - P.land * 0.02;

  // health regen
  if (G.elapsed - G.lastDamage > 4.6 && G.health < G.maxHealth && G.state === 'playing') {
    G.health = Math.min(G.maxHealth, G.health + dt * 15);
  }
  if (G.health < 35 && G.health > 0) {
    audio.lowHealthBeat(1 - G.health / 35);
  }
  const now = G.elapsed;
  if (now - G.lastKill > 3.4 && G.combo > 1) {
    G.combo = 1;
  }
}

function updateCamera(dt) {
  const bobY = Math.sin(P.bobPhase * 2) * 0.021 * Math.min(1, P.speed / 5.4) * (1 - weapon.adsAmount * 0.78);
  const bobX = Math.cos(P.bobPhase) * 0.014 * Math.min(1, P.speed / 5.4) * (1 - weapon.adsAmount * 0.78);
  const breathe = Math.sin(performance.now() * 0.0011) * 0.0018;
  G.shake = Math.max(0, G.shake - dt * 1.5);
  const shakeAmp = G.shake * G.shake;
  const shakeX = (Math.random() - 0.5) * shakeAmp * 0.9;
  const shakeY = (Math.random() - 0.5) * shakeAmp * 0.7;
  const shakePitch = (Math.random() - 0.5) * shakeAmp * 0.14;
  camera.position.set(P.pos.x + bobX + shakeX, P.cameraY + bobY + breathe + shakeY, P.pos.z);
  camera.rotation.x = P.pitch + shakePitch;
  camera.rotation.y = P.yaw;
  camera.rotation.z = P.roll + (Math.random() - 0.5) * shakeAmp * 0.06;

  const targetFov = P.ads ? 56 : (P.sprinting ? 82 : (P.crouching ? 74 : 78));
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov = damp(camera.fov, targetFov, 9, dt);
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

// ---------------- shooting ----------------
const raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _normal = new THREE.Vector3();

function updateShooting() {
  if (G.state !== 'playing') return;
  if (input.trigger && !P.sprinting) {
    if (weapon.tryFire()) fireShot();
  }
}

function fireShot() {
  _origin.copy(camera.position);
  camera.getWorldDirection(_dir);
  _right.setFromMatrixColumn(camera.matrixWorld, 0);
  _up.setFromMatrixColumn(camera.matrixWorld, 1);
  const spread = THREE.MathUtils.lerp(0.014, 0.0021, weapon.adsAmount)
    + Math.min(0.02, P.speed * 0.0018)
    + (P.onGround ? 0 : 0.018)
    + weapon.heat * 0.0055
    + (P.crouching ? -0.001 : 0);
  const s = Math.max(0.0008, spread);
  _dir.addScaledVector(_right, (Math.random() - 0.5) * 2 * s);
  _dir.addScaledVector(_up, (Math.random() - 0.5) * 2 * s);
  _dir.normalize();

  raycaster.set(_origin, _dir);
  raycaster.far = 140;
  const targets = manager.targets.concat(world.occluders);
  const hits = raycaster.intersectObjects(targets, false);
  const muzzle = weapon.muzzleWorld.clone();
  G.shots += 1;

  if (hits.length) {
    const hit = hits[0];
    const enemy = hit.object.userData.enemy;
    effects.tracer(muzzle, hit.point, enemy ? 0xffd0a0 : 0xffe1b4, 0.06);
    if (enemy) {
      const head = hit.object.userData.part === 'head';
      const dmg = head ? 86 : (enemy.boss ? 31 : 27);
      const result = enemy.damage(dmg, hit.object.userData.part || 'body', hit.point, _dir);
      G.hits += 1;
      showHitmarker(head);
      if (result.killed) onKill(enemy, head);
    } else {
      if (hit.face) {
        _normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        effects.impact(hit.point, _normal, 'metal');
      } else {
        effects.impact(hit.point, new THREE.Vector3(0, 1, 0), 'metal');
      }
    }
  } else {
    effects.tracer(muzzle, _origin.clone().addScaledVector(_dir, 85), 0xffe1b4, 0.05);
  }

  const recoil = weapon.consumeRecoil();
  P.pitch = clamp(P.pitch + recoil.pitch, -1.36, 1.34);
  P.yaw += recoil.yaw;
}

function onKill(enemy, headshot) {
  const now = G.elapsed;
  if (now - G.lastKill <= 3.2) G.combo += 1;
  else G.combo = 1;
  G.lastKill = now;
  const mult = Math.min(5, 1 + Math.floor((G.combo - 1) / 2));
  const base = enemy.boss ? 1200 : (headshot ? 150 : 100);
  const pts = base * mult;
  G.score += pts;
  G.kills += 1;
  if (headshot) G.headshots += 1;
  weapon.reserve = Math.min(330, weapon.reserve + (enemy.boss ? 80 : 9));
  G.health = Math.min(G.maxHealth, G.health + 2);
  addKillFeed(headshot, pts, enemy.boss, mult);
  if (G.combo === 2) showStreak('DOUBLE KILL');
  else if (G.combo === 3) showStreak('TRIPLE KILL');
  else if (G.combo === 4) showStreak('MULTI KILL');
  else if (G.combo >= 5) showStreak('RAMPAGE');
  audio.enemyDown();
}

function showHitmarker(head) {
  G.hitmarker = 0.11;
  hitmarkerEl.classList.add('show');
  hitmarkerEl.classList.toggle('head', Boolean(head));
  crosshair.classList.add('hit');
  setTimeout(() => crosshair.classList.remove('hit'), 90);
}

function addKillFeed(headshot, pts, boss, mult) {
  const feed = $('killfeed');
  const row = document.createElement('div');
  row.className = 'kill-row';
  row.innerHTML = `<b>${boss ? 'HEAVY UNIT' : 'HOSTILE'}</b> ELIMINATED${headshot ? '<span class="hs">HEADSHOT</span>' : ''}<span class="pts">+${pts}${mult > 1 ? ` ×${mult}` : ''}</span>`;
  feed.appendChild(row);
  while (feed.children.length > 4) feed.firstElementChild.remove();
  setTimeout(() => row.remove(), 4200);
}

function showStreak(text) {
  const el = $('streak-toast');
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(showStreak.timer);
  showStreak.timer = setTimeout(() => el.classList.add('hidden'), 950);
}

function showToast(kicker, main) {
  const toast = $('toast');
  $('toast-kicker').textContent = kicker;
  $('toast-main').textContent = main;
  toast.classList.add('show');
  clearTimeout(G.toastTimer);
  G.toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function damagePlayer(amount) {
  if (G.state !== 'playing') return;
  G.health = Math.max(0, G.health - amount);
  G.lastDamage = G.elapsed;
  G.damagePulse = Math.min(1.4, G.damagePulse + amount / 34);
  G.shake = Math.min(0.8, G.shake + amount * 0.017);
  audio.damage();
  if (G.health <= 0) {
    updateHUD(0);
    endGame(false);
  }
}

// ---------------- menu camera ----------------
let menuTime = 0;
function updateMenu(dt, time) {
  menuTime += dt;
  const a = Math.sin(time * 0.05) * 0.5;
  camera.position.set(10.5 + Math.sin(a) * 3.2, 4.35 + Math.sin(time * 0.13) * 0.25, 14.5 + Math.cos(a) * 1.2);
  camera.lookAt(-2.0, 2.5, -9.5);
  camera.rotation.z = Math.sin(time * 0.19) * 0.007;
  camera.fov = 62;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  weapon.group.visible = false;
  if (headLight) headLight.intensity = 0;
}

// ---------------- HUD ----------------
let hudAccum = 0;
let radarAccum = 0;
const radar = $('radar');
const rctx = radar.getContext('2d');

function updateHUD(dt) {
  G.damagePulse = Math.max(0, G.damagePulse - dt * 1.8);
  G.hitmarker = Math.max(0, G.hitmarker - dt);
  if (G.hitmarker <= 0) hitmarkerEl.classList.remove('show');

  const health = Math.max(0, Math.round(G.health));
  const healthPct = clamp(G.health / G.maxHealth, 0, 1);
  $('health-value').textContent = String(health).padStart(3, '0');
  $('health-value').classList.toggle('low', health < 35);
  $('health-bar').style.width = `${healthPct * 100}%`;
  $('health-bar').classList.toggle('low', health < 35);
  $('health-state').textContent = health > 65 ? 'STABLE' : health > 30 ? 'WOUNDED' : health > 0 ? 'CRITICAL' : 'FLATLINE';
  $('health-state').style.color = health > 65 ? 'var(--green)' : health > 30 ? 'var(--orange)' : 'var(--red)';

  $('score-value').textContent = String(G.score).padStart(6, '0');
  $('kills-value').textContent = String(G.kills);
  $('mult-value').textContent = `×${Math.min(5, 1 + Math.floor((G.combo - 1) / 2))}`;
  $('mult-value').style.color = G.combo > 1 ? 'var(--orange)' : '';
  $('wave-label').textContent = `WAVE ${String(Math.max(1, G.wave)).padStart(2, '0')}`;
  $('hostile-count').textContent = String(G.queue.length + manager.alive).padStart(2, '0');
  $('objective-text').textContent = G.intermission > 0
    ? `REGROUP // ${Math.ceil(G.intermission)}s`
    : (G.endTimer > 0 ? 'EXTRACTION INBOUND' : (G.activeWave ? 'ELIMINATE ALL HOSTILES' : 'HOLD POSITION'));

  const heading = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const compassOffset = -22 - (heading / 360) * 704;
  compassStrip.style.transform = `translateX(${compassOffset}px)`;
  $('compass-heading').textContent = String(Math.round(heading) % 360).padStart(3, '0');

  $('ammo-mag').textContent = String(weapon.ammo).padStart(2, '0');
  $('ammo-mag').classList.toggle('empty', weapon.ammo === 0);
  $('ammo-reserve').textContent = String(weapon.reserve);
  for (let i = 0; i < ammoDotEls.length; i++) ammoDotEls[i].classList.toggle('spent', i >= weapon.ammo);

  const showReload = !weapon.reloading && weapon.ammo <= 7 && weapon.reserve > 0 && G.state === 'playing';
  $('reload-hint').classList.toggle('hidden', !showReload);
  $('low-ammo').classList.toggle('show', weapon.ammo <= 6 && weapon.reserve === 0 && G.state === 'playing');

  const moveSpread = Math.min(1, P.speed / 8.4);
  crosshair.style.setProperty('--spread', `${Math.round(5 + moveSpread * 10 + weapon.heat * 9 + (P.onGround ? 0 : 7))}px`);
  crosshair.classList.toggle('ads', weapon.adsAmount > 0.72);
  crosshair.style.opacity = P.sprinting ? '0.45' : '1';

  $('damage-flash').style.opacity = String(clamp(G.damagePulse * 0.62, 0, 0.8));
  if (gradePass) {
    gradePass.uniforms.damage.value = G.damagePulse;
    gradePass.uniforms.lowHealth.value = G.health < 35 ? (1 - G.health / 35) * 0.85 + 0.15 : 0;
    gradePass.uniforms.flash.value = G.flashPulse;
  }

  const prompt = $('capture-prompt');
  if (G.state === 'playing' && !isTouch && document.pointerLockElement !== canvas && G.playTime > 3.2) {
    prompt.classList.remove('hidden');
  } else {
    prompt.classList.add('hidden');
  }

  hudAccum += dt;
  if (hudAccum > 0.05) {
    hudAccum = 0;
    drawRadar(performance.now() / 1000);
  }
}

function drawRadar(time) {
  const w = 208, h = 208, cx = 104, cy = 104, radius = 92;
  rctx.clearRect(0, 0, w, h);
  rctx.save();
  rctx.beginPath(); rctx.arc(cx, cy, radius, 0, Math.PI * 2); rctx.clip();
  rctx.fillStyle = 'rgba(4, 17, 22, 0.64)';
  rctx.fillRect(0, 0, w, h);
  rctx.strokeStyle = 'rgba(113, 211, 228, 0.13)';
  rctx.lineWidth = 1;
  for (const rr of [28, 54, 80]) {
    rctx.beginPath(); rctx.arc(cx, cy, rr, 0, Math.PI * 2); rctx.stroke();
  }
  rctx.beginPath(); rctx.moveTo(cx - radius, cy); rctx.lineTo(cx + radius, cy); rctx.stroke();
  rctx.beginPath(); rctx.moveTo(cx, cy - radius); rctx.lineTo(cx, cy + radius); rctx.stroke();

  const sweep = (time * 1.15) % (Math.PI * 2);
  const grad = rctx.createLinearGradient(cx, cy, cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius);
  grad.addColorStop(0, 'rgba(92, 226, 247, 0.16)');
  grad.addColorStop(1, 'rgba(92, 226, 247, 0)');
  rctx.fillStyle = grad;
  rctx.beginPath();
  rctx.moveTo(cx, cy);
  rctx.arc(cx, cy, radius, sweep - 0.34, sweep);
  rctx.closePath();
  rctx.fill();
  rctx.strokeStyle = 'rgba(122, 235, 255, 0.35)';
  rctx.beginPath(); rctx.moveTo(cx, cy); rctx.lineTo(cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius); rctx.stroke();

  const cos = Math.cos(P.yaw), sin = Math.sin(P.yaw);
  for (const e of manager.enemies) {
    if (e.state === 'dead' || e.remove) continue;
    const dx = e.position.x - P.pos.x;
    const dz = e.position.z - P.pos.z;
    if (dx * dx + dz * dz > 35 * 35) continue;
    const sx = dx * cos + dz * sin;
    const sy = dx * sin - dz * cos;
    const px = cx + (sx / 35) * (radius - 10);
    const py = cy - (sy / 35) * (radius - 10);
    const d = Math.hypot(px - cx, py - cy);
    if (d > radius - 4) continue;
    const boss = e.boss;
    rctx.fillStyle = boss ? '#ffb04a' : '#ff4a38';
    rctx.shadowColor = rctx.fillStyle;
    rctx.shadowBlur = 7;
    rctx.beginPath(); rctx.arc(px, py, boss ? 4.2 : 2.5, 0, Math.PI * 2); rctx.fill();
    rctx.shadowBlur = 0;
  }

  // player
  rctx.fillStyle = '#9ff4ff';
  rctx.shadowColor = '#5fe8ff';
  rctx.shadowBlur = 9;
  rctx.beginPath();
  rctx.moveTo(cx, cy - 8);
  rctx.lineTo(cx + 6, cy + 5);
  rctx.lineTo(cx, cy + 2);
  rctx.lineTo(cx - 6, cy + 5);
  rctx.closePath();
  rctx.fill();
  rctx.shadowBlur = 0;
  rctx.restore();

  rctx.strokeStyle = 'rgba(116, 224, 240, 0.46)';
  rctx.lineWidth = 1;
  rctx.beginPath(); rctx.arc(cx, cy, radius, 0, Math.PI * 2); rctx.stroke();

  // north tick
  rctx.fillStyle = 'rgba(140, 232, 246, 0.8)';
  rctx.font = '11px Share Tech Mono, monospace';
  rctx.textAlign = 'center';
  rctx.fillText('N', cx, 18);
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let firstFrame = true;
let frameCount = 0;
window.__blacksite = { G, P, weapon, manager, world, effects, renderer, scene, camera, get frames() { return frameCount; } };
setTimeout(() => $('boot-veil').classList.add('done'), 1600);

function animate() {
  requestAnimationFrame(animate);
  frameCount++;
  const dt = Math.min(0.1, clock.getDelta());
  const time = clock.elapsedTime;

  if (G.state === 'playing') {
    G.elapsed += dt;
    G.playTime += dt;
    updatePlayer(dt);
    updateCamera(dt);
    manager.update(dt, time, P, camera);
    updateShooting();
    weapon.update(dt, {
      speed: P.speed,
      grounded: P.onGround,
      sprinting: P.sprinting,
      lookX: P.lookX,
      lookY: P.lookY
    });
    P.lookX = 0;
    P.lookY = 0;
    updateWaves(dt);
    updateHUD(dt);
    world.update(dt, time, P.pos, effects);
  } else if (G.state === 'menu') {
    updateMenu(dt, time);
    updateHUD(dt);
    world.update(dt, time, camera.position, effects);
  } else {
    world.update(dt * 0.2, time, camera.position, effects);
    if (G.state === 'dead' || G.state === 'won') updateHUD(dt);
  }

  effects.update(dt);
  if (gradePass) {
    gradePass.uniforms.time.value = time;
    gradePass.uniforms.flash.value = G.flashPulse;
  }
  G.flashPulse = Math.max(0, G.flashPulse - dt * 2.5);
  if (composer) composer.render();
  else renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    setTimeout(() => $('boot-veil').classList.add('done'), 120);
  }
}

function onResize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer?.setSize(w, h);
  bloom?.setSize(w, h);
  smaa?.setSize(w, h);
}
window.addEventListener('resize', onResize);

// initial camera state for the menu
updateMenu(0, 0);
updateVolume(input.volume);
updateHUD(0);
animate();
