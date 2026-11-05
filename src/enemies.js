import * as THREE from 'three';
import { resolveCircle, lineBlocked } from './physics.js';
import { audio } from './audio.js';
import { glowTexture } from './textures.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

function rand(a, b) { return a + Math.random() * (b - a); }
let _eyeGlow = null;
function eyeGlowTexture() { return _eyeGlow || (_eyeGlow = glowTexture('rgba(255,120,86,1)', 'rgba(255,20,10,0)')); }

class Enemy {
  constructor(scene, world, effects, spawn, boss = false) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.boss = boss;
    this.scale = boss ? 1.33 : rand(0.95, 1.04);
    this.maxHealth = boss ? 620 : 100;
    this.health = this.maxHealth;
    this.speed = boss ? 1.45 : rand(1.85, 2.35);
    this.state = 'spawn';
    this.spawnTimer = 0.7;
    this.deadTimer = 0;
    this.radius = 0.4 * this.scale;
    this.losTimer = 0;
    this.los = false;
    this.fireCooldown = rand(0.9, 2.2);
    this.burstLeft = 0;
    this.shotDelay = 0;
    this.walkPhase = Math.random() * 10;
    this.strafeSign = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = rand(1.2, 2.8);
    this.flash = 0;
    this.deathSide = Math.random() > 0.5 ? 1 : -1;
    this.remove = false;
    this.target = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.position = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.killedByHeadshot = false;
    this.lastHitPart = 'body';
    this.gunKick = 0;
    this.aimTime = 0;

    this.build();
    this.root.position.copy(this.position);
    this.root.scale.setScalar(0.001);
    scene.add(this.root);

    this.buildHealthBar();
    this.healthBar.visible = false;
    this.effects.spawnRing(this.position, boss ? 0xffb143 : 0xff4930, boss ? 1.8 : 1);
    this.spawnLight = new THREE.PointLight(boss ? 0xffa53a : 0xff3a22, boss ? 18 : 8, 6, 2);
    this.spawnLight.position.set(spawn.x, 1.1, spawn.z);
    scene.add(this.spawnLight);
  }

  build() {
    const boss = this.boss;
    const armor = new THREE.MeshStandardMaterial({ color: boss ? 0x4a3a24 : 0x2e3a40, roughness: 0.58, metalness: 0.32, emissive: 0x070f13, emissiveIntensity: 0.8, envMapIntensity: 0.6 });
    const armorDark = new THREE.MeshStandardMaterial({ color: boss ? 0x302818 : 0x192125, roughness: 0.72, metalness: 0.2, emissive: 0x050a0d, emissiveIntensity: 0.8 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: 0.9, metalness: 0.06, emissive: 0x04080a, emissiveIntensity: 0.7 });
    const accent = new THREE.MeshStandardMaterial({ color: boss ? 0xffb03a : 0xd83a2a, emissive: boss ? 0xff8a10 : 0x9c1408, emissiveIntensity: 2.1, roughness: 0.44, metalness: 0.4 });
    const visor = new THREE.MeshBasicMaterial({ color: boss ? 0xffc24a : 0xff3024, toneMapped: false });
    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x1b2327, roughness: 0.5, metalness: 0.6 });
    this.flashMats = [armor, armorDark, cloth];
    this.accentMat = accent;

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const mesh = (geo, mat, x, y, z, parent = this.body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // hips / torso
    mesh(new THREE.BoxGeometry(0.34, 0.24, 0.25), armorDark, 0, 0.92, 0);
    this.torso = mesh(new THREE.BoxGeometry(0.48, 0.52, 0.30), armor, 0, 1.23, 0);
    this.torso.userData.part = 'body';
    mesh(new THREE.BoxGeometry(0.51, 0.2, 0.34), armorDark, 0, 1.45, 0.01);
    mesh(new THREE.BoxGeometry(0.24, 0.12, 0.04), accent, 0, 1.31, 0.17);
    mesh(new THREE.BoxGeometry(0.06, 0.19, 0.03), accent, -0.15, 1.23, 0.165);
    mesh(new THREE.BoxGeometry(0.06, 0.19, 0.03), accent, 0.15, 1.23, 0.165);
    mesh(new THREE.BoxGeometry(0.37, 0.16, 0.23), armorDark, 0, 1.04, 0.02);
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.10, 0.12, 0.06), armorDark, -0.12 + i * 0.12, 1.10, 0.17);

    // backpack
    mesh(new THREE.BoxGeometry(0.36, 0.40, 0.17), armorDark, 0, 1.30, -0.22);
    mesh(new THREE.BoxGeometry(0.28, 0.08, 0.04), accent, 0, 1.38, -0.315);
    if (boss) {
      mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8), armorDark, -0.25, 1.45, -0.26);
      mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8), armorDark, 0.25, 1.45, -0.26);
    }

    // head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.63, 0);
    this.body.add(this.headGroup);
    mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.15, 8), cloth, 0, 0.02, 0, this.headGroup);
    this.head = mesh(new THREE.SphereGeometry(0.175, 16, 12), armor, 0, 0.17, 0, this.headGroup);
    this.head.scale.set(0.94, 1.05, 1);
    this.head.userData.part = 'head';
    mesh(new THREE.BoxGeometry(0.34, 0.14, 0.32), armorDark, 0, 0.285, -0.015, this.headGroup);
    mesh(new THREE.BoxGeometry(0.38, 0.06, 0.36), boss ? armor : armorDark, 0, 0.355, -0.02, this.headGroup);
    const visorMesh = mesh(new THREE.BoxGeometry(0.26, 0.064, 0.03), visor, 0, 0.19, 0.165, this.headGroup);
    visorMesh.userData.part = 'head';
    const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeGlowTexture(), color: boss ? 0xffb856 : 0xff4a30, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    eyeGlow.position.set(0, 0.19, 0.2);
    eyeGlow.scale.setScalar(boss ? 0.85 : 0.6);
    this.headGroup.add(eyeGlow);
    mesh(new THREE.BoxGeometry(0.07, 0.14, 0.17), armorDark, 0.18, 0.20, 0.02, this.headGroup);
    mesh(new THREE.BoxGeometry(0.05, 0.15, 0.05), accent, 0.20, 0.29, 0.0, this.headGroup);

    // shoulders / arms
    this.armL = new THREE.Group();
    this.armL.position.set(-0.31, 1.42, 0);
    this.body.add(this.armL);
    this.armR = new THREE.Group();
    this.armR.position.set(0.31, 1.42, 0);
    this.body.add(this.armR);
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]]) {
      mesh(new THREE.SphereGeometry(0.13, 8, 6), armorDark, side * 0.01, 0.0, 0, arm);
      mesh(new THREE.BoxGeometry(0.15, 0.30, 0.16), armor, 0, -0.19, 0, arm);
      mesh(new THREE.BoxGeometry(0.13, 0.26, 0.14), armorDark, 0, -0.43, 0.02, arm);
      mesh(new THREE.BoxGeometry(0.11, 0.10, 0.12), cloth, 0, -0.58, 0.03, arm);
      mesh(new THREE.BoxGeometry(0.15, 0.07, 0.17), armorDark, 0, -0.23, 0.0, arm);
      const hand = mesh(new THREE.BoxGeometry(0.13, 0.10, 0.14), cloth, 0, -0.60, 0.04, arm);
      if (side > 0) this.rightHand = hand;
    }
    this.armR.rotation.x = -0.72;
    this.armL.rotation.x = -1.17;
    this.armL.rotation.z = -0.2;
    this.armR.rotation.z = 0.12;

    // legs
    this.legL = new THREE.Group();
    this.legL.position.set(-0.15, 0.88, 0);
    this.body.add(this.legL);
    this.legR = new THREE.Group();
    this.legR.position.set(0.15, 0.88, 0);
    this.body.add(this.legR);
    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]]) {
      mesh(new THREE.BoxGeometry(0.17, 0.40, 0.19), armorDark, 0, -0.20, 0, leg);
      mesh(new THREE.BoxGeometry(0.145, 0.37, 0.16), armor, 0, -0.57, 0.01, leg);
      mesh(new THREE.BoxGeometry(0.19, 0.14, 0.30), armorDark, 0, -0.79, 0.05, leg);
      mesh(new THREE.BoxGeometry(0.16, 0.045, 0.21), accent, side * 0.0, -0.46, 0.08, leg);
    }

    this.head.userData.enemy = this;
    this.torso.userData.enemy = this;

    // generous invisible hit volumes keep precise aim from slipping between armor plates
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.headHit = new THREE.Mesh(new THREE.SphereGeometry(0.235, 10, 8), hitMat);
    this.headHit.position.set(0, 0.19, 0.01);
    this.headHit.userData.part = 'head';
    this.headHit.userData.enemy = this;
    this.headGroup.add(this.headHit);
    this.bodyHit = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.42), hitMat);
    this.bodyHit.position.set(0, 1.2, 0.01);
    this.bodyHit.userData.part = 'body';
    this.bodyHit.userData.enemy = this;
    this.body.add(this.bodyHit);

    // weapon
    this.gun = new THREE.Group();
    this.gun.position.set(0.11, 1.12, 0.27);
    this.gun.rotation.x = -0.06;
    this.body.add(this.gun);
    mesh(new THREE.BoxGeometry(0.10, 0.12, 0.58), gunMetal, 0, 0, 0, this.gun);
    mesh(new THREE.BoxGeometry(0.06, 0.06, 0.36), gunMetal, 0, 0.02, 0.43, this.gun);
    mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.30, 8), gunMetal, 0, 0.025, 0.70, this.gun).rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.055, 0.15, 0.12), gunMetal, 0, -0.11, 0.04, this.gun);
    mesh(new THREE.BoxGeometry(0.05, 0.06, 0.14), accent, 0, 0.075, -0.03, this.gun);
    this.gunTip = new THREE.Object3D();
    this.gunTip.position.set(0, 0.025, 0.86);
    this.gun.add(this.gunTip);

    this.root.scale.setScalar(this.scale);
  }

  buildHealthBar() {
    this.healthBar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.07), new THREE.MeshBasicMaterial({ color: 0x040708, transparent: true, opacity: 0.72, depthWrite: false, depthTest: true }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.57, 0.032), new THREE.MeshBasicMaterial({ color: this.boss ? 0xffb04a : 0xff4c3a, toneMapped: false, depthWrite: false, depthTest: true }));
    fill.position.z = 0.001;
    this.healthBar.add(bg, fill);
    this.healthFill = fill;
    this.healthBar.visible = false;
    this.scene.add(this.healthBar);
  }

  get eye() {
    return _v.set(this.position.x, 1.68 * this.scale, this.position.z);
  }

  damage(amount, part, hitPoint, direction) {
    if (this.state === 'dead') return { killed: false, headshot: false };
    const headshot = part === 'head';
    this.health -= amount;
    this.flash = 0.18;
    this.lastHitPart = part;
    if (hitPoint) this.effects.impact(hitPoint, direction ? direction.clone().negate() : new THREE.Vector3(0, 1, 0), 'blood');
    audio.hit(headshot);
    if (this.health <= 0) {
      this.die(headshot);
      return { killed: true, headshot };
    }
    return { killed: false, headshot };
  }

  die(headshot) {
    this.state = 'dead';
    this.killedByHeadshot = headshot;
    this.deadTimer = 0;
    this.healthBar.visible = false;
    this.deathSide = Math.random() > 0.5 ? 1 : -1;
    this.effects.deathBurst(this.position, this.boss ? 0xffb03a : 0xff3a26, this.boss ? 1.8 : 1);
    if (this.boss) {
      this.effects.explode(this.position.clone().setY(1.1), 0xff8a35, 1.5);
    }
    if (this.spawnLight) this.spawnLight.intensity = 0;
  }

  update(dt, time, player, camera, manager) {
    if (this.remove) return;
    if (this.state === 'dead') {
      this.deadTimer += dt;
      const t = Math.min(1, this.deadTimer / 0.45);
      this.root.rotation.z = this.deathSide * t * 1.48;
      this.root.position.y = -t * 0.12;
      this.healthBar.visible = false;
      if (this.deadTimer > 3.2) {
        this.root.visible = false;
        this.healthBar.visible = false;
        this.remove = true;
      }
      return;
    }

    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      const t = Math.max(0, 1 - this.spawnTimer / 0.7);
      this.root.scale.setScalar(this.scale * (0.001 + t * t * (3 - 2 * t)));
      if (this.spawnLight) this.spawnLight.intensity = (1 - t) * (this.boss ? 20 : 9);
      if (this.spawnTimer <= 0) {
        this.root.scale.setScalar(this.scale);
        this.state = 'active';
        this.spawnLight.intensity = 0;
        this.scene.remove(this.spawnLight);
        this.spawnLight = null;
      }
      return;
    }

    if (this.flash > 0) this.flash -= dt;
    const flash = Math.max(0, this.flash / 0.18);
    for (const m of this.flashMats) m.emissive.setRGB(flash * 0.55, flash * 0.12, flash * 0.04);

    const playerEye = _v2.set(player.pos.x, player.eye || 1.62, player.pos.z);
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = 0.22;
      const eye = new THREE.Vector3(this.position.x, 1.7 * this.scale, this.position.z);
      this.los = !lineBlocked(eye, playerEye, this.world.occluders);
    }

    const dx = player.pos.x - this.position.x;
    const dz = player.pos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const dirX = dist > 0.001 ? dx / dist : 0;
    const dirZ = dist > 0.001 ? dz / dist : 1;

    // face player
    const targetYaw = Math.atan2(dirX, dirZ);
    let yawDiff = targetYaw - this.root.rotation.y;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.root.rotation.y += yawDiff * Math.min(1, dt * 8);

    // move
    let moveX = 0;
    let moveZ = 0;
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = rand(1.4, 2.8);
      this.strafeSign *= -1;
    }
    const preferred = this.boss ? 8 : 9.5;
    if (!this.los || dist > preferred + 3) {
      moveX += dirX;
      moveZ += dirZ;
    } else if (dist < preferred - 3.5) {
      moveX -= dirX;
      moveZ -= dirZ;
    } else {
      moveX += -dirZ * this.strafeSign * 0.72;
      moveZ += dirX * this.strafeSign * 0.72;
    }
    // separations from other agents
    for (const other of manager.enemies) {
      if (other === this || other.state === 'dead') continue;
      const ox = this.position.x - other.position.x;
      const oz = this.position.z - other.position.z;
      const d2 = ox * ox + oz * oz;
      if (d2 > 0.001 && d2 < 1.1) {
        const d = Math.sqrt(d2);
        moveX += (ox / d) * (1 - d / 1.05) * 1.6;
        moveZ += (oz / d) * (1 - d / 1.05) * 1.6;
      }
    }
    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 0.001) {
      moveX /= moveLen;
      moveZ /= moveLen;
      const sprintFactor = this.los ? 0.78 : 1;
      this.position.x += moveX * this.speed * dt * sprintFactor;
      this.position.z += moveZ * this.speed * dt * sprintFactor;
      resolveCircle(this.position, this.radius, this.world.colliders);
      this.walkPhase += dt * (this.los ? 6.2 : 8.2);
      const swing = Math.sin(this.walkPhase) * 0.42;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.035;
      this.body.rotation.z = Math.sin(this.walkPhase) * 0.018;
    } else {
      this.walkPhase += dt * 1.2;
      this.legL.rotation.x += (0 - this.legL.rotation.x) * Math.min(1, dt * 7);
      this.legR.rotation.x += (0 - this.legR.rotation.x) * Math.min(1, dt * 7);
      this.body.position.y += (0 - this.body.position.y) * Math.min(1, dt * 8);
      this.body.rotation.z += (0 - this.body.rotation.z) * Math.min(1, dt * 8);
    }

    this.root.position.x = this.position.x;
    this.root.position.z = this.position.z;

    // combat
    this.fireCooldown -= dt;
    this.aimTime += dt;
    if (this.los && dist < 40 && this.fireCooldown <= 0 && this.burstLeft <= 0) {
      this.burstLeft = this.boss ? 6 : 3;
      this.shotDelay = 0.22;
      this.fireCooldown = this.boss ? rand(1.5, 2.1) : rand(1.7, 2.8);
    }
    if (this.burstLeft > 0) {
      this.shotDelay -= dt;
      if (this.shotDelay <= 0) {
        this.shotDelay = this.boss ? 0.095 : 0.14;
        this.burstLeft--;
        this.shoot(player, camera, dist, manager);
      }
    }

    this.gunKick = Math.max(0, this.gunKick - dt * 7);
    this.gun.position.z = 0.27 + this.gunKick * 0.06;
    this.armR.rotation.x = -0.72 + this.gunKick * 0.08;

    // health bar
    const healthRatio = Math.max(0, this.health / this.maxHealth);
    this.healthBar.visible = healthRatio < 0.999;
    if (this.healthBar.visible) {
      this.healthBar.position.set(this.position.x, 2.18 * this.scale, this.position.z);
      this.healthBar.quaternion.copy(camera.quaternion);
      this.healthFill.scale.x = Math.max(0.01, healthRatio);
      this.healthFill.position.x = -(1 - healthRatio) * 0.57 * 0.5;
      this.healthFill.material.color.setHex(healthRatio < 0.35 ? 0xff2f22 : (this.boss ? 0xffa43a : 0xff6a3a));
    }
  }

  shoot(player, camera, dist, manager) {
    const muzzle = new THREE.Vector3();
    this.gunTip.getWorldPosition(muzzle);
    const target = new THREE.Vector3(player.pos.x, (player.eye || 1.62) - 0.24, player.pos.z);
    const accuracy = this.boss ? 0.52 : Math.max(0.12, 0.47 - dist * 0.008 - (player.sprinting ? 0.08 : 0));
    const hit = Math.random() < accuracy;
    const missOffset = new THREE.Vector3(rand(-1.6, 1.6), rand(-0.7, 1.5), rand(-1.6, 1.6));
    const end = hit ? target : target.clone().add(missOffset);
    this.effects.tracer(muzzle, end, 0xff6d3a, 0.075);
    this.effects.spriteAt(muzzle, 0.55, 0.06, 0xff9b52, 'muzzle');
    this.gunKick = 1;
    const pan = THREE.MathUtils.clamp((this.position.x - player.pos.x) / 30, -0.8, 0.8);
    audio.enemyShot(dist, pan);
    if (hit) manager.onPlayerHit(this.boss ? rand(9, 14) : rand(4.5, 8), this);
  }
}

export class EnemyManager {
  constructor(scene, world, effects, callbacks) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.callbacks = callbacks;
    this.enemies = [];
    this.spawnLightPool = [];
  }

  spawn(spawn, boss = false) {
    const enemy = new Enemy(this.scene, this.world, this.effects, spawn, boss);
    this.enemies.push(enemy);
    return enemy;
  }

  get alive() {
    return this.enemies.filter(e => !e.remove && e.state !== 'dead').length;
  }

  get targets() {
    const arr = [];
    for (const e of this.enemies) {
      if (e.remove || e.state === 'dead') continue;
      if (e.bodyHit) arr.push(e.bodyHit);
      if (e.headHit) arr.push(e.headHit);
    }
    return arr;
  }

  update(dt, time, player, camera) {
    for (const enemy of this.enemies) enemy.update(dt, time, player, camera, this);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.remove) {
        this.scene.remove(e.root);
        this.scene.remove(e.healthBar);
        if (e.spawnLight) this.scene.remove(e.spawnLight);
        this.enemies.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.enemies) {
      this.scene.remove(e.root);
      this.scene.remove(e.healthBar);
      if (e.spawnLight) this.scene.remove(e.spawnLight);
    }
    this.enemies.length = 0;
  }

  onPlayerHit(amount, enemy) {
    this.callbacks.onPlayerHit(amount, enemy);
  }
}
