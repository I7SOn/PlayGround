import * as THREE from 'three';
import { glowTexture, smokeTexture, bulletHoleTexture } from './textures.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.glow = glowTexture('rgba(255,235,196,1)', 'rgba(255,120,20,0)');
    this.smokeTex = smokeTexture();
    this.holeTex = bulletHoleTexture();
    this.time = 0;

    this.sprites = [];
    for (let i = 0; i < 42; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.userData = { life: 0, max: 0, vx: 0, vy: 0, vz: 0, grow: 1, fade: 1, kind: 'glow' };
      scene.add(sprite);
      this.sprites.push(sprite);
    }

    this.smokes = [];
    for (let i = 0; i < 30; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0x93a7ad });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.userData = { life: 0, max: 0, vx: 0, vy: 0, vz: 0, grow: 1 };
      scene.add(sprite);
      this.smokes.push(sprite);
    }

    this.tracers = [];
    for (let i = 0; i < 34; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xffd49a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }

    const capacity = 900;
    this.capacity = capacity;
    this.pPos = new Float32Array(capacity * 3);
    this.pCol = new Float32Array(capacity * 3);
    this.pVel = new Float32Array(capacity * 3);
    this.pLife = new Float32Array(capacity);
    this.pMax = new Float32Array(capacity);
    this.pGrav = new Float32Array(capacity);
    this.pDrag = new Float32Array(capacity);
    this.pBase = new Float32Array(capacity * 3);
    for (let i = 0; i < capacity; i++) this.pPos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    const mat = new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pCursor = 0;

    this.decals = [];
    for (let i = 0; i < 70; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: this.holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mat);
      mesh.visible = false;
      scene.add(mesh);
      this.decals.push(mesh);
    }
    this.decalCursor = 0;

    this.casings = [];
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xc59b43, metalness: 1, roughness: 0.3 });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.05, 6), mat);
      mesh.visible = false;
      scene.add(mesh);
      this.casings.push({ mesh, life: 0, vy: 0, vx: 0, vz: 0, spin: 0 });
    }
    this.casingCursor = 0;

    this.rings = [];
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 48), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0, max: 0, grow: 1 });
    }
    this.ringCursor = 0;

    this.flash = new THREE.PointLight(0xffa850, 0, 11, 2);
    scene.add(this.flash);
  }

  particle(x, y, z, vx, vy, vz, life, color, gravity = 9, drag = 0.6, jitter = 0.35) {
    const i = this.pCursor;
    this.pCursor = (this.pCursor + 1) % this.capacity;
    this.pPos[i * 3] = x + (Math.random() - 0.5) * jitter;
    this.pPos[i * 3 + 1] = y + (Math.random() - 0.5) * jitter;
    this.pPos[i * 3 + 2] = z + (Math.random() - 0.5) * jitter;
    this.pVel[i * 3] = vx;
    this.pVel[i * 3 + 1] = vy;
    this.pVel[i * 3 + 2] = vz;
    this.pLife[i] = life;
    this.pMax[i] = life;
    this.pGrav[i] = gravity;
    this.pDrag[i] = drag;
    const c = color.isColor ? color : new THREE.Color(color);
    this.pBase[i * 3] = c.r;
    this.pBase[i * 3 + 1] = c.g;
    this.pBase[i * 3 + 2] = c.b;
    this.pCol[i * 3] = c.r;
    this.pCol[i * 3 + 1] = c.g;
    this.pCol[i * 3 + 2] = c.b;
  }

  spriteAt(pos, scale, life, color = 0xffc070, kind = 'glow') {
    const sprite = this.sprites.find(s => !s.visible);
    if (!sprite) return;
    sprite.visible = true;
    sprite.position.copy(pos);
    sprite.scale.setScalar(scale);
    sprite.material.color.setHex(color);
    sprite.material.opacity = 0.9;
    sprite.userData.life = life;
    sprite.userData.max = life;
    sprite.userData.kind = kind;
    sprite.userData.grow = kind === 'muzzle' ? 1.5 : 1.1;
  }

  smokeAt(pos, scale, life, color = 0x93a7ad, drift = 0.5) {
    const sprite = this.smokes.find(s => !s.visible);
    if (!sprite) return;
    sprite.visible = true;
    sprite.position.copy(pos);
    sprite.scale.setScalar(scale);
    sprite.material.color.setHex(color);
    sprite.material.opacity = 0.0;
    sprite.userData.life = life;
    sprite.userData.max = life;
    sprite.userData.grow = 1.6 + Math.random() * 0.9;
    sprite.userData.vx = (Math.random() - 0.5) * drift;
    sprite.userData.vy = 0.25 + Math.random() * 0.5;
    sprite.userData.vz = (Math.random() - 0.5) * drift;
  }

  tracer(start, end, color = 0xffc985, life = 0.055) {
    const slot = this.tracers.find(t => !t.line.visible) || this.tracers[0];
    const arr = slot.line.geometry.attributes.position.array;
    arr[0] = start.x; arr[1] = start.y; arr[2] = start.z;
    arr[3] = end.x; arr[4] = end.y; arr[5] = end.z;
    slot.line.geometry.attributes.position.needsUpdate = true;
    slot.line.material.color.setHex(color);
    slot.line.material.opacity = 0.95;
    slot.line.visible = true;
    slot.life = life;
    slot.max = life;
  }

  muzzleFlash(pos, dir, scale = 1) {
    this.spriteAt(pos, 0.85 * scale, 0.065, 0xffb35a, 'muzzle');
    this.spriteAt(pos, 0.32 * scale, 0.075, 0xfff0cf, 'muzzle');
    this.flash.position.copy(pos);
    this.flash.intensity = 30 * scale;
    for (let i = 0; i < 5; i++) {
      const spread = 3.2;
      this.particle(pos.x, pos.y, pos.z, dir.x * (2 + Math.random() * 4) + (Math.random() - 0.5) * spread, dir.y * (2 + Math.random() * 4) + (Math.random() - 0.5) * spread, dir.z * (2 + Math.random() * 4) + (Math.random() - 0.5) * spread, 0.1 + Math.random() * 0.1, 0xffb04a, 2, 0.9, 0.05);
    }
  }

  impact(point, normal, kind = 'metal') {
    const nrm = normal.clone().normalize();
    for (let i = 0; i < 11; i++) {
      const speed = 1.5 + Math.random() * 5.5;
      _v.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar(speed).addScaledVector(nrm, 2.8);
      const color = kind === 'blood' ? 0xff2f22 : (Math.random() > 0.4 ? 0xffb34d : 0xffe7c0);
      this.particle(point.x, point.y, point.z, _v.x, _v.y, _v.z, 0.18 + Math.random() * 0.36, color, kind === 'blood' ? 14 : 8, 0.8, 0.06);
    }
    if (kind !== 'blood') {
      this.smokeAt(point.clone().addScaledVector(nrm, 0.03), 0.2, 0.55, 0xa8b3b5, 0.25);
      this.spriteAt(point.clone().addScaledVector(nrm, 0.02), 0.18, 0.06, 0xffd9a0);
      this.decal(point, nrm);
    } else {
      this.spriteAt(point, 0.2, 0.12, 0x9c1008);
    }
  }

  decal(point, normal) {
    const mesh = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;
    mesh.visible = true;
    mesh.position.copy(point).addScaledVector(normal, 0.012);
    _q.setFromUnitVectors(_up, normal);
    mesh.quaternion.copy(_q);
    const spin = new THREE.Quaternion().setFromAxisAngle(_up, Math.random() * Math.PI * 2);
    mesh.quaternion.multiply(spin);
    const s = 0.7 + Math.random() * 0.55;
    mesh.scale.setScalar(s);
    mesh.material.rotation = Math.random() * Math.PI;
  }

  casing(pos, velocity) {
    const slot = this.casings[this.casingCursor];
    this.casingCursor = (this.casingCursor + 1) % this.casings.length;
    slot.mesh.visible = true;
    slot.mesh.position.copy(pos);
    slot.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    slot.vx = velocity.x;
    slot.vy = velocity.y;
    slot.vz = velocity.z;
    slot.life = 1.6;
    slot.spin = 8 + Math.random() * 12;
  }

  deathBurst(pos, color = 0xff3a2e, scale = 1) {
    for (let i = 0; i < 30 * scale; i++) {
      const speed = (1 + Math.random() * 4) * scale;
      _v.set((Math.random() - 0.5), Math.random() * 1.3, (Math.random() - 0.5)).normalize().multiplyScalar(speed);
      this.particle(pos.x, pos.y + 0.8 + Math.random(), pos.z, _v.x, _v.y, _v.z, 0.4 + Math.random() * 0.7, i % 4 === 0 ? 0xffb066 : color, 5, 0.6);
    }
    this.smokeAt(pos.clone().setY(pos.y + 0.7), 0.75 * scale, 1.5, 0x7a6260, 0.8);
    this.spriteAt(pos.clone().setY(pos.y + 1), 0.85 * scale, 0.22, 0xff5733);
    this.ring(pos, 0xff4c2a, 0.55 * scale, 1.4);
  }

  spawnRing(pos, color = 0xff4c2a, scale = 1) {
    this.ring(pos, color, 0.7 * scale, 1.8);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.5;
      this.particle(pos.x + Math.cos(a) * r, pos.y + Math.random() * 1.7, pos.z + Math.sin(a) * r, 0, 1.4 + Math.random() * 2.5, 0, 0.3 + Math.random() * 0.6, color, 1.5, 0.3);
    }
  }

  ring(pos, color, scale, grow) {
    const slot = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.rings.length;
    slot.mesh.visible = true;
    slot.mesh.position.copy(pos).setY(0.045);
    slot.mesh.scale.setScalar(scale);
    slot.mesh.material.color.setHex(color);
    slot.mesh.material.opacity = 0.85;
    slot.life = 0.6;
    slot.max = 0.6;
    slot.grow = grow;
  }

  explode(pos, color = 0xff7b35, scale = 1) {
    this.spriteAt(pos, 2.6 * scale, 0.18, 0xffc176);
    this.spriteAt(pos, 1.1 * scale, 0.25, 0xfff4da);
    this.flash.position.copy(pos);
    this.flash.intensity = 110 * scale;
    for (let i = 0; i < 55 * scale; i++) {
      const speed = (2 + Math.random() * 7) * scale;
      _v.set((Math.random() - 0.5) * 2, Math.random() * 1.6, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed);
      this.particle(pos.x, pos.y, pos.z, _v.x, _v.y, _v.z, 0.4 + Math.random() * 0.8, i % 3 === 0 ? 0xffdfa0 : color, 7, 0.5);
    }
    for (let i = 0; i < 5; i++) {
      this.smokeAt(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5)), 1.2 * scale, 1.4 + Math.random(), 0x5b5550, 1.3);
    }
    this.ring(pos, color, 1.1 * scale, 3.5);
  }

  update(dt) {
    this.time += dt;
    for (const sprite of this.sprites) {
      if (!sprite.visible) continue;
      const u = sprite.userData;
      u.life -= dt;
      if (u.life <= 0) { sprite.visible = false; sprite.material.opacity = 0; continue; }
      const t = u.life / u.max;
      sprite.material.opacity = (u.kind === 'muzzle' ? 1 : 0.7) * Math.min(1, t * 2.2);
      sprite.scale.multiplyScalar(1 + (u.grow - 1) * dt * 9);
    }
    for (const sprite of this.smokes) {
      if (!sprite.visible) continue;
      const u = sprite.userData;
      u.life -= dt;
      if (u.life <= 0) { sprite.visible = false; sprite.material.opacity = 0; continue; }
      const t = u.life / u.max;
      sprite.position.x += u.vx * dt;
      sprite.position.y += u.vy * dt;
      sprite.position.z += u.vz * dt;
      sprite.scale.multiplyScalar(1 + (u.grow - 1) * dt * 4);
      sprite.material.opacity = Math.sin(Math.min(1, t * 2.3) * Math.PI * 0.5) * 0.24 * t;
    }
    for (const slot of this.tracers) {
      if (!slot.line.visible) continue;
      slot.life -= dt;
      if (slot.life <= 0) { slot.line.visible = false; continue; }
      slot.line.material.opacity = Math.max(0, slot.life / slot.max) * 0.9;
    }
    for (let i = 0; i < this.capacity; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) {
        this.pPos[i * 3 + 1] = -999;
        this.pCol[i * 3] = this.pCol[i * 3 + 1] = this.pCol[i * 3 + 2] = 0;
        continue;
      }
      const drag = Math.max(0, 1 - this.pDrag[i] * dt);
      this.pVel[i * 3] *= drag;
      this.pVel[i * 3 + 2] *= drag;
      this.pVel[i * 3 + 1] = this.pVel[i * 3 + 1] * drag - this.pGrav[i] * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      if (this.pPos[i * 3 + 1] < 0.02) {
        this.pPos[i * 3 + 1] = 0.02;
        this.pVel[i * 3 + 1] *= -0.24;
        this.pVel[i * 3] *= 0.5;
        this.pVel[i * 3 + 2] *= 0.5;
      }
      const t = this.pLife[i] / this.pMax[i];
      const flicker = 0.55 + 0.45 * Math.sin(this.time * 44 + i * 4.1);
      this.pCol[i * 3] = this.pBase[i * 3] * t * flicker;
      this.pCol[i * 3 + 1] = this.pBase[i * 3 + 1] * t * flicker;
      this.pCol[i * 3 + 2] = this.pBase[i * 3 + 2] * t * flicker;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    for (const slot of this.casings) {
      if (!slot.mesh.visible) continue;
      slot.life -= dt;
      if (slot.life <= 0 || slot.mesh.position.y < -1) { slot.mesh.visible = false; continue; }
      slot.vy -= 15 * dt;
      slot.mesh.position.x += slot.vx * dt;
      slot.mesh.position.y += slot.vy * dt;
      slot.mesh.position.z += slot.vz * dt;
      if (slot.mesh.position.y < 0.025) {
        slot.mesh.position.y = 0.025;
        slot.vy *= -0.33;
        slot.vx *= 0.45;
        slot.vz *= 0.45;
        slot.spin *= 0.5;
      }
      slot.mesh.rotation.x += slot.spin * dt;
      slot.mesh.rotation.z += slot.spin * 0.7 * dt;
    }

    for (const slot of this.rings) {
      if (!slot.mesh.visible) continue;
      slot.life -= dt;
      if (slot.life <= 0) { slot.mesh.visible = false; continue; }
      const t = 1 - slot.life / slot.max;
      slot.mesh.scale.setScalar(0.35 + t * slot.grow);
      slot.mesh.material.opacity = (1 - t) * 0.8;
    }

    if (this.flash.intensity > 0) {
      this.flash.intensity = Math.max(0, this.flash.intensity - dt * 520);
    }
  }
}
