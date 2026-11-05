import * as THREE from 'three';

function rng(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size = 512, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return [c, c.getContext('2d')];
}

function speckle(ctx, w, h, count, rand, colors, min = 0.4, max = 1.6) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = min + rand() * (max - min);
    ctx.fillStyle = colors[(rand() * colors.length) | 0];
    const s = 0.4 + rand() * 2.2;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function finish(canvas, { repeat = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function asphaltTexture() {
  const [c, ctx] = canvas(512);
  const rand = rng(17);
  ctx.fillStyle = '#171b1e';
  ctx.fillRect(0, 0, 512, 512);
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 34;
    img.data[i] = Math.max(5, 23 + n);
    img.data[i + 1] = Math.max(5, 27 + n);
    img.data[i + 2] = Math.max(5, 31 + n);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  speckle(ctx, 512, 512, 9000, rand, ['#2f3539', '#0c1012', '#3b4245', '#20262a'], 0.18, 0.6);
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = `rgba(5,8,9,${0.3 + rand() * 0.4})`;
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    let x = rand() * 512;
    let y = rand() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (rand() - 0.5) * 64;
      y += rand() * 32;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(117, 132, 136, ${0.02 + rand() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(rand() * 512, rand() * 512, 25 + rand() * 80, 8 + rand() * 30, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c, { repeat: 7 });
}

export function concreteTexture() {
  const [c, ctx] = canvas(512);
  const rand = rng(83);
  ctx.fillStyle = '#4b5051';
  ctx.fillRect(0, 0, 512, 512);
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 24;
    img.data[i] = 73 + n;
    img.data[i + 1] = 78 + n;
    img.data[i + 2] = 79 + n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  speckle(ctx, 512, 512, 5000, rand, ['#5f6564', '#363b3d', '#6c716f'], 0.1, 0.5);
  for (let i = 0; i < 10; i++) {
    const x = rand() * 512;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(8,12,13,0)');
    g.addColorStop(0.5, `rgba(8,12,13,${0.14 + rand() * 0.18})`);
    g.addColorStop(1, 'rgba(8,12,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 4 + rand() * 20, 512);
  }
  ctx.strokeStyle = 'rgba(25,30,31,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 510, 510);
  ctx.strokeStyle = 'rgba(116,125,124,0.2)';
  ctx.strokeRect(5, 5, 502, 502);
  return finish(c, { repeat: 3 });
}

export function metalTexture(base = '#22282c', seed = 3) {
  const [c, ctx] = canvas(512);
  const rand = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 700; i++) {
    ctx.strokeStyle = `rgba(210,225,230,${rand() * 0.045})`;
    ctx.lineWidth = 0.5 + rand();
    const y = rand() * 512;
    ctx.beginPath();
    ctx.moveTo(rand() * 250, y);
    ctx.lineTo(rand() * 512, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 35; i++) {
    ctx.strokeStyle = `rgba(220,238,242,${0.06 + rand() * 0.18})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    const x = rand() * 512;
    const y = rand() * 512;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 80, y + (rand() - 0.5) * 80);
    ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const g = ctx.createRadialGradient(x, y, 1, x, y, 12 + rand() * 32);
    g.addColorStop(0, 'rgba(10,12,13,0.4)');
    g.addColorStop(1, 'rgba(10,12,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 50, y - 50, 100, 100);
  }
  // rivets
  for (let i = 0; i < 28; i++) {
    const x = 20 + rand() * 472;
    const y = 20 + rand() * 472;
    ctx.fillStyle = 'rgba(8,10,11,0.65)';
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(130,146,150,0.22)';
    ctx.beginPath(); ctx.arc(x - 0.7, y - 0.7, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  return finish(c, { repeat: 2 });
}

export function containerTexture(color = '#3d4b4b', accent = '#9a4c24', seed = 10) {
  const [c, ctx] = canvas(512);
  const rand = rng(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 512);
  const grd = ctx.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, 'rgba(255,255,255,0.09)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32) {
    ctx.fillStyle = 'rgba(0,0,0,0.17)';
    ctx.fillRect(x, 0, 3, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + 3, 0, 2, 512);
  }
  for (let i = 0; i < 950; i++) {
    ctx.globalAlpha = rand() * 0.5;
    ctx.fillStyle = rand() > 0.55 ? '#0b0e0f' : accent;
    ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 5, 1 + rand() * 2);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 8; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 2 + rand() * 15;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, `rgba(145,68,25,${0.15 + rand() * 0.2})`);
    g.addColorStop(1, 'rgba(145,68,25,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.fillStyle = 'rgba(8,10,11,0.7)';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('MERIDIAN PORT AUTHORITY', 24, 52);
  ctx.font = '13px Arial';
  ctx.fillStyle = 'rgba(8,10,11,0.54)';
  ctx.fillText('MSKU 407 221 7  //  MAX GROSS 30,480 KG', 25, 75);
  return finish(c, { repeat: 1 });
}

export function hazardTexture() {
  const [c, ctx] = canvas(512, 128);
  ctx.fillStyle = '#151819';
  ctx.fillRect(0, 0, 512, 128);
  ctx.save();
  ctx.translate(0, 0);
  for (let x = -128; x < 640; x += 74) {
    ctx.fillStyle = '#c27c19';
    ctx.beginPath();
    ctx.moveTo(x, 128); ctx.lineTo(x + 37, 128); ctx.lineTo(x + 94, 0); ctx.lineTo(x + 57, 0);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const rand = rng(31);
  for (let i = 0; i < 500; i++) {
    ctx.globalAlpha = rand() * 0.4;
    ctx.fillStyle = '#0a0c0d';
    ctx.fillRect(rand() * 512, rand() * 128, 2 + rand() * 4, 1 + rand() * 3);
  }
  return finish(c, { repeat: 1 });
}

export function signTexture(main, sub = '', color = '#ff8a2a', seed = 4) {
  const [c, ctx] = canvas(768, 256);
  const rand = rng(seed);
  ctx.fillStyle = '#080d10';
  ctx.fillRect(0, 0, 768, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 20; i++) ctx.fillRect(0, i * 13, 768, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 744, 232);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, 720, 208);
  ctx.fillStyle = color;
  ctx.font = 'bold 105px Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText(main, 48, 110);
  ctx.fillStyle = 'rgba(220,240,245,0.72)';
  ctx.font = '28px Arial';
  ctx.fillText(sub, 51, 190);
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = rand() * 0.18;
    ctx.fillStyle = '#000';
    ctx.fillRect(rand() * 768, rand() * 256, 1 + rand() * 14, 1 + rand() * 3);
  }
  return finish(c, { repeat: 1 });
}

export function groundNumberTexture(text = '07', color = '#b88425') {
  const [c, ctx] = canvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(256, 256, 190, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.24;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(256, 256, 158, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = color;
  ctx.font = 'bold 240px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 272);
  ctx.font = 'bold 30px Arial';
  ctx.fillText('SECTOR', 256, 70);
  ctx.fillText('AUTHORIZED VEHICLES ONLY', 256, 448);
  return finish(c, { repeat: 1 });
}

export function puddleTexture() {
  const [c, ctx] = canvas(256);
  const rand = rng(52);
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 7; i++) {
    const x = 40 + rand() * 176;
    const y = 40 + rand() * 176;
    const r = 30 + rand() * 55;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(210,245,255,0.85)');
    g.addColorStop(0.55, 'rgba(150,220,240,0.45)');
    g.addColorStop(1, 'rgba(120,200,230,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.4 + rand() * 0.35), rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  return finish(c, { repeat: 1 });
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.28, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c, { repeat: 1 });
}

export function smokeTexture() {
  const size = 128;
  const [c, ctx] = canvas(size);
  const rand = rng(9);
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(170,190,198,0.8)');
  g.addColorStop(0.45, 'rgba(120,140,148,0.42)');
  g.addColorStop(1, 'rgba(80,95,102,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.05})`;
    ctx.beginPath(); ctx.arc(64 + (rand() - 0.5) * 40, 64 + (rand() - 0.5) * 40, 4 + rand() * 15, 0, Math.PI * 2); ctx.fill();
  }
  return finish(c, { repeat: 1 });
}

export function bulletHoleTexture() {
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.98)');
  g.addColorStop(0.24, 'rgba(5,6,7,0.96)');
  g.addColorStop(0.5, 'rgba(40,42,42,0.66)');
  g.addColorStop(0.72, 'rgba(108,102,91,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return finish(c, { repeat: 1 });
}

export function skyTexture() {
  const [c, ctx] = canvas(1024, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#010307');
  g.addColorStop(0.38, '#06101b');
  g.addColorStop(0.68, '#0d1b29');
  g.addColorStop(0.82, '#182b38');
  g.addColorStop(1, '#24323a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  const rand = rng(76);
  for (let i = 0; i < 420; i++) {
    const x = rand() * 1024;
    const y = rand() * 330;
    const a = rand() * 0.55;
    ctx.fillStyle = `rgba(196,225,245,${a})`;
    const s = rand() > 0.94 ? 2 : 1;
    ctx.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 24; i++) {
    const x = rand() * 1024;
    const y = 80 + rand() * 280;
    const r = 50 + rand() * 180;
    const cg = ctx.createRadialGradient(x, y, 1, x, y, r);
    cg.addColorStop(0, 'rgba(40,59,72,0.10)');
    cg.addColorStop(1, 'rgba(20,30,40,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function rainTexture() {
  const [c, ctx] = canvas(64, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(190,228,245,0)');
  g.addColorStop(0.55, 'rgba(190,228,245,0.55)');
  g.addColorStop(1, 'rgba(220,245,255,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(29, 0, 5, 128);
  ctx.filter = 'blur(2px)';
  ctx.fillRect(28, 0, 7, 128);
  return finish(c, { repeat: 1 });
}
