import * as THREE from 'three';
import { audio } from './audio.js';
import { metalTexture } from './textures.js';

const _muzzle = new THREE.Vector3();
const _dir = new THREE.Vector3();

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export class Weapon {
  constructor(camera, effects) {
    this.camera = camera;
    this.effects = effects;
    this.group = new THREE.Group();
    this.group.scale.setScalar(0.78);
    camera.add(this.group);

    this.magSize = 30;
    this.ammo = 30;
    this.reserve = 210;
    this.reloading = false;
    this.reloadTime = 0;
    this.reloadDuration = 1.75;
    this.cooldown = 0;
    this.fireRate = 0.092;
    this.ads = false;
    this.adsAmount = 0;
    this.recoil = 0;
    this.recoilKick = 0;
    this.recoilYaw = 0;
    this.bobTime = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.shotsFired = 0;
    this.hits = 0;
    this.triggerHeld = false;
    this.heat = 0;

    this.hipPos = new THREE.Vector3(0.238, -0.284, -0.78);
    this.adsPos = new THREE.Vector3(0, -0.148, -0.58);
    this.basePos = this.hipPos.clone();

    this.build();

    this.muzzleAnchor = new THREE.Object3D();
    this.muzzleAnchor.position.set(0, 0.018, -0.955);
    this.group.add(this.muzzleAnchor);

    this.casingAnchor = new THREE.Object3D();
    this.casingAnchor.position.set(0.11, 0.03, -0.07);
    this.group.add(this.casingAnchor);

    this.group.traverse(o => {
      if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; }
    });
  }

  build() {
    const gunTex = metalTexture('#4a565e', 41);
    const gunTexDark = metalTexture('#2a3238', 43);
    const gunmetal = new THREE.MeshStandardMaterial({ map: gunTex, color: 0x6d7a81, roughness: 0.42, metalness: 0.48, envMapIntensity: 1.1, emissive: 0x090f13, emissiveIntensity: 0.5 });
    const gunmetalDark = new THREE.MeshStandardMaterial({ map: gunTexDark, color: 0x4d585e, roughness: 0.55, metalness: 0.36, envMapIntensity: 0.8, emissive: 0x060b0e, emissiveIntensity: 0.5 });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x242b2e, roughness: 0.72, metalness: 0.15, emissive: 0x070b0d, emissiveIntensity: 0.8 });
    const polymer2 = new THREE.MeshStandardMaterial({ color: 0x343d41, roughness: 0.66, metalness: 0.2, emissive: 0x080d10, emissiveIntensity: 0.8 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.4 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x8df6ff, toneMapped: false });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b2b36, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.5, envMapIntensity: 1.2, emissive: 0x03151b, emissiveIntensity: 1, side: THREE.DoubleSide });
    const glove = new THREE.MeshStandardMaterial({ color: 0x2b3235, roughness: 0.88, metalness: 0.02, emissive: 0x080b0c, emissiveIntensity: 0.8 });
    const glovePlate = new THREE.MeshStandardMaterial({ color: 0x2e373a, roughness: 0.65, metalness: 0.25 });

    const add = (geo, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      this.group.add(mesh);
      return mesh;
    };
    const box = (w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);

    // receiver
    box(0.150, 0.165, 0.50, gunmetal, 0, 0, -0.015);
    box(0.135, 0.095, 0.34, gunmetalDark, 0, 0.055, -0.08);
    box(0.158, 0.045, 0.46, gunmetalDark, 0, 0.103, -0.04);
    // ejection port + bolt
    box(0.012, 0.065, 0.14, polymer, 0.077, 0.015, -0.04);
    box(0.006, 0.045, 0.045, gunmetalDark, 0.084, 0.035, 0.08);
    // charging handle
    box(0.03, 0.03, 0.16, gunmetalDark, 0.086, 0.052, 0.145);
    box(0.06, 0.025, 0.04, polymer2, 0.095, 0.052, 0.20);
    // top rail
    for (let i = 0; i < 13; i++) {
      box(0.085, 0.014, 0.026, gunmetalDark, 0, 0.137, -0.235 + i * 0.036);
    }
    // handguard
    box(0.135, 0.145, 0.46, polymer2, 0, -0.003, -0.46);
    for (let i = 0; i < 7; i++) {
      box(0.143, 0.02, 0.028, polymer, 0, 0.058, -0.63 + i * 0.06);
      box(0.143, 0.02, 0.028, polymer, 0, -0.064, -0.63 + i * 0.06);
    }
    box(0.152, 0.022, 0.40, gunmetalDark, 0, 0.078, -0.46);
    box(0.03, 0.022, 0.20, accent, 0.078, 0.005, -0.45);
    box(0.018, 0.018, 0.24, accent, -0.076, -0.035, -0.44);
    // handguard vents / side rails
    for (let i = 0; i < 5; i++) {
      box(0.012, 0.052, 0.052, gunmetalDark, 0.071, -0.01, -0.30 - i * 0.075);
      box(0.012, 0.052, 0.052, gunmetalDark, -0.071, -0.01, -0.30 - i * 0.075);
    }
    box(0.028, 0.028, 0.22, gunmetalDark, 0.082, -0.052, -0.47);
    // angled foregrip
    box(0.075, 0.15, 0.085, polymer, 0, -0.115, -0.44, 0.34, 0, 0);
    box(0.055, 0.035, 0.11, polymer2, 0, -0.185, -0.4, 0.34, 0, 0);
    // flashlight module
    const torch = add(new THREE.CylinderGeometry(0.032, 0.035, 0.15, 10), gunmetalDark, 0.096, 0.012, -0.56, Math.PI / 2, 0, 0);
    torch.rotation.x = Math.PI / 2;
    const torchLens = add(new THREE.CircleGeometry(0.026, 12), glow, 0.096, 0.012, -0.636);
    torchLens.rotation.y = Math.PI;
    // barrel
    const barrel = add(new THREE.CylinderGeometry(0.027, 0.031, 0.46, 12), gunmetal, 0, 0.012, -0.78, Math.PI / 2, 0, 0);
    barrel.rotation.x = Math.PI / 2;
    const shroud = add(new THREE.CylinderGeometry(0.045, 0.043, 0.16, 12), gunmetalDark, 0, 0.012, -0.64, Math.PI / 2, 0, 0);
    shroud.rotation.x = Math.PI / 2;
    // muzzle brake
    const brake = add(new THREE.CylinderGeometry(0.043, 0.037, 0.12, 10), gunmetalDark, 0, 0.014, -0.965, Math.PI / 2, 0, 0);
    brake.rotation.x = Math.PI / 2;
    const brakeRing = add(new THREE.CylinderGeometry(0.048, 0.048, 0.025, 10), accent, 0, 0.014, -0.925, Math.PI / 2, 0, 0);
    brakeRing.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      box(0.095, 0.012, 0.022, gunmetal, 0, 0.058 + i * 0.001, -0.75 + i * 0.045);
    }
    // gas block
    box(0.075, 0.075, 0.08, gunmetalDark, 0, 0.03, -0.69);
    // magazine
    this.mag = box(0.095, 0.27, 0.155, polymer, 0, -0.19, 0.045, 0.22, 0, 0);
    box(0.076, 0.04, 0.12, gunmetalDark, 0, -0.315, 0.015, 0.22);
    box(0.01, 0.09, 0.02, accent, 0.049, -0.17, 0.035, 0.22);
    // grip
    box(0.082, 0.21, 0.11, polymer, 0, -0.19, 0.235, -0.28);
    box(0.09, 0.028, 0.12, polymer2, 0, -0.285, 0.27, -0.28);
    // trigger guard
    box(0.06, 0.016, 0.15, gunmetalDark, 0, -0.115, 0.12);
    box(0.014, 0.056, 0.02, gunmetalDark, 0, -0.095, 0.19, 0, 0, 0.1);
    // stock
    box(0.08, 0.11, 0.30, polymer, 0, 0.002, 0.39);
    box(0.11, 0.19, 0.07, polymer2, 0, -0.02, 0.545);
    box(0.10, 0.06, 0.26, gunmetalDark, 0, 0.068, 0.40);
    box(0.12, 0.035, 0.03, accent, 0, -0.085, 0.56);
    // compact holographic sight
    box(0.085, 0.065, 0.17, gunmetalDark, 0, 0.176, -0.07);
    box(0.108, 0.024, 0.21, gunmetal, 0, 0.213, -0.07);
    box(0.098, 0.014, 0.13, gunmetalDark, 0, 0.262, -0.055);
    box(0.014, 0.062, 0.13, gunmetalDark, 0.048, 0.232, -0.055);
    box(0.014, 0.062, 0.13, gunmetalDark, -0.048, 0.232, -0.055);
    const lens = add(new THREE.PlaneGeometry(0.084, 0.05), glass, 0, 0.232, -0.001);
    const dot = add(new THREE.CircleGeometry(0.0045, 12), glow, 0, 0.232, 0.001);
    box(0.05, 0.03, 0.05, gunmetal, 0.066, 0.196, -0.05);
    box(0.05, 0.03, 0.05, gunmetal, -0.066, 0.196, -0.05);
    // small front sight backup
    box(0.03, 0.07, 0.025, gunmetalDark, 0, 0.105, -0.64);
    // sling
    box(0.012, 0.18, 0.03, glove, 0.082, -0.07, 0.31, 0.2);
    // hands
    const right = add(new THREE.SphereGeometry(0.072, 12, 10), glove, 0.02, -0.22, 0.25);
    right.scale.set(0.9, 1.2, 0.9);
    box(0.085, 0.055, 0.105, glovePlate, 0.02, -0.185, 0.225);
    box(0.10, 0.10, 0.16, glove, 0.005, -0.31, 0.21);
    const left = add(new THREE.SphereGeometry(0.075, 12, 10), glove, -0.045, -0.16, -0.47);
    left.scale.set(0.85, 1.05, 1.25);
    box(0.09, 0.06, 0.12, glovePlate, -0.06, -0.115, -0.46);
    box(0.125, 0.11, 0.26, glove, -0.085, -0.235, -0.4, 0.35, 0, 0.1);
    box(0.105, 0.085, 0.16, glove, -0.075, -0.155, -0.34, 0.15, 0, 0.08);
    // wrist details
    box(0.06, 0.06, 0.12, glovePlate, -0.05, -0.245, -0.30, 0.35);

    // tiny status screen
    box(0.034, 0.022, 0.004, glow, 0.048, 0.056, 0.128);
  }

  get muzzleWorld() {
    this.muzzleAnchor.getWorldPosition(_muzzle);
    return _muzzle;
  }

  getForward() {
    this.camera.getWorldDirection(_dir);
    return _dir;
  }

  setAds(on) {
    this.ads = on;
  }

  startReload() {
    if (this.reloading || this.ammo >= this.magSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTime = 0;
    audio.reload(this.reloadDuration);
    return true;
  }

  finishReload() {
    const need = this.magSize - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    this.reloading = false;
  }

  tryFire() {
    if (this.reloading) return false;
    if (this.cooldown > 0) return false;
    if (this.ammo <= 0) {
      audio.empty();
      this.cooldown = 0.28;
      this.startReload();
      return false;
    }
    this.ammo -= 1;
    this.shotsFired += 1;
    this.cooldown += this.fireRate;
    this.recoil = Math.min(2.1, this.recoil + 0.62 + Math.random() * 0.2);
    this.recoilKick += (this.ads ? 0.0105 : 0.018) + Math.random() * 0.004;
    this.recoilYaw += (Math.random() - 0.5) * (this.ads ? 0.004 : 0.009);
    this.heat = Math.min(1, this.heat + 0.16);
    audio.shot();
    const muzzle = this.muzzleWorld;
    const forward = this.getForward();
    this.effects.muzzleFlash(muzzle, forward, this.ads ? 0.85 : 1.12);
    const casingPos = new THREE.Vector3();
    this.casingAnchor.getWorldPosition(casingPos);
    this.effects.casing(casingPos, new THREE.Vector3(1.8 + Math.random(), 1.6 + Math.random() * 1.2, 0.4 + Math.random()));
    return true;
  }

  update(dt, state) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.heat = Math.max(0, this.heat - dt * 0.42);
    this.adsAmount = damp(this.adsAmount, this.ads ? 1 : 0, 14, dt);
    if (this.reloading) {
      this.reloadTime += dt;
      if (this.reloadTime >= this.reloadDuration) this.finishReload();
    }

    const moving = !state.grounded ? 0 : Math.min(1, state.speed / 6.2);
    const sprint = state.sprinting ? 1 : 0;
    this.bobTime += dt * (7.2 + moving * 3.2 + sprint * 2.5);
    const bobAmt = moving * (1 - this.adsAmount * 0.85) * (0.7 + sprint * 0.5);
    const bobX = Math.sin(this.bobTime) * 0.014 * bobAmt;
    const bobY = Math.abs(Math.cos(this.bobTime)) * 0.011 * bobAmt;
    const breathe = Math.sin(performance.now() * 0.0012) * 0.0025 * (1 - moving * 0.6);

    const targetSwayX = THREE.MathUtils.clamp(-state.lookX * 0.008, -0.045, 0.045);
    const targetSwayY = THREE.MathUtils.clamp(state.lookY * 0.006, -0.03, 0.03);
    this.swayX = damp(this.swayX, targetSwayX, 9, dt);
    this.swayY = damp(this.swayY, targetSwayY, 9, dt);

    this.recoil = damp(this.recoil, 0, 12, dt);
    const reloadProgress = this.reloading ? this.reloadTime / this.reloadDuration : 0;
    const reloadAnim = this.reloading ? Math.sin(Math.min(1, reloadProgress) * Math.PI) : 0;

    const hip = this.hipPos;
    const targetX = THREE.MathUtils.lerp(hip.x, this.adsPos.x, this.adsAmount) + bobX + this.swayX;
    const targetY = THREE.MathUtils.lerp(hip.y, this.adsPos.y, this.adsAmount) + bobY - breathe - reloadAnim * 0.16 + this.swayY;
    const targetZ = THREE.MathUtils.lerp(hip.z, this.adsPos.z, this.adsAmount) + this.recoil * 0.038;
    this.group.position.x = damp(this.group.position.x, targetX, 13, dt);
    this.group.position.y = damp(this.group.position.y, targetY, 13, dt);
    this.group.position.z = damp(this.group.position.z, targetZ, 14, dt);

    const sprintRot = sprint * (1 - this.adsAmount) * 0.22;
    const hipTilt = 1 - this.adsAmount;
    const targetRotX = reloadAnim * 0.42 + this.recoil * 0.035 + sprintRot * 0.4 + hipTilt * 0.012;
    const targetRotY = -sprintRot * 0.7 + this.swayX * 0.8 + reloadAnim * 0.25 + hipTilt * 0.05;
    const targetRotZ = reloadAnim * 0.55 + this.recoil * 0.012 + sprintRot * 0.75;
    this.group.rotation.x = damp(this.group.rotation.x, targetRotX, 11, dt);
    this.group.rotation.y = damp(this.group.rotation.y, targetRotY, 11, dt);
    this.group.rotation.z = damp(this.group.rotation.z, targetRotZ, 11, dt);

    if (this.mag) {
      const drop = reloadProgress > 0.28 && reloadProgress < 0.66 ? Math.sin((reloadProgress - 0.28) / 0.38 * Math.PI) : 0;
      this.mag.position.y = -0.19 - drop * 0.34;
      this.mag.rotation.z = drop * 0.5;
    }
  }

  consumeRecoil() {
    const pitch = this.recoilKick;
    const yaw = this.recoilYaw;
    this.recoilKick = 0;
    this.recoilYaw = 0;
    return { pitch, yaw };
  }

  reset() {
    this.ammo = this.magSize;
    this.reserve = 210;
    this.reloading = false;
    this.reloadTime = 0;
    this.cooldown = 0;
    this.recoil = 0;
    this.shotsFired = 0;
    this.hits = 0;
    this.group.position.copy(this.hipPos);
    this.group.rotation.set(0, 0, 0);
  }
}
