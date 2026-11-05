import * as THREE from 'three';
import {
  asphaltTexture, concreteTexture, metalTexture, containerTexture, hazardTexture,
  signTexture, groundNumberTexture, puddleTexture, skyTexture, smokeTexture
} from './textures.js';

const PI = Math.PI;

export function buildWorld(scene, renderer, options = {}) {
  const low = Boolean(options.low);
  const colliders = [];
  const occluders = [];
  const animated = [];
  const steam = [];
  const rand = seeded(9182);
  const root = new THREE.Group();
  scene.add(root);

  scene.fog = new THREE.FogExp2(0x071018, 0.019);
  scene.background = new THREE.Color(0x03060a);

  const asphalt = asphaltTexture();
  const concrete = concreteTexture();
  const metal = metalTexture('#252b2f', 12);
  const metalLight = metalTexture('#3b4448', 7);

  const mat = {
    floor: new THREE.MeshPhysicalMaterial({ map: asphalt, color: 0xffffff, roughness: 0.5, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.16, envMapIntensity: 0.9 }),
    concrete: new THREE.MeshStandardMaterial({ map: concrete, color: 0xffffff, roughness: 0.9, metalness: 0.05, envMapIntensity: 0.4 }),
    concreteDark: new THREE.MeshStandardMaterial({ map: concrete, color: 0x9aa0a0, roughness: 0.95, metalness: 0.04, envMapIntensity: 0.25 }),
    metal: new THREE.MeshStandardMaterial({ map: metal, color: 0xffffff, roughness: 0.5, metalness: 0.72, envMapIntensity: 0.9 }),
    metalDark: new THREE.MeshStandardMaterial({ map: metal, color: 0xc7d0d2, roughness: 0.58, metalness: 0.7, envMapIntensity: 0.7 }),
    metalLight: new THREE.MeshStandardMaterial({ map: metalLight, color: 0xffffff, roughness: 0.44, metalness: 0.75, envMapIntensity: 0.75 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x101316, roughness: 0.92, metalness: 0.05 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x64513a, roughness: 0.85, metalness: 0.08 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), color: 0xc7a466, roughness: 0.68, metalness: 0.45 }),
    amber: new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x5fe9ff, toneMapped: false }),
    red: new THREE.MeshBasicMaterial({ color: 0xff2f2f, toneMapped: false }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffd7a1, toneMapped: false }),
    glass: new THREE.MeshStandardMaterial({ color: 0x19313c, roughness: 0.12, metalness: 0.9, envMapIntensity: 1.2 }),
    black: new THREE.MeshStandardMaterial({ color: 0x07090a, roughness: 0.8, metalness: 0.2 })
  };

  function addBox(w, h, d, material, x, y, z, ry = 0, solid = true, cast = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    if (solid) {
      registerCollider(mesh, w, d, ry);
      occluders.push(mesh);
    }
    return mesh;
  }

  function registerCollider(mesh, w, d, ry) {
    const c = Math.abs(Math.cos(ry));
    const s = Math.abs(Math.sin(ry));
    const ex = (w * c + d * s) / 2;
    const ez = (w * s + d * c) / 2;
    colliders.push({ minX: mesh.position.x - ex, maxX: mesh.position.x + ex, minZ: mesh.position.z - ez, maxZ: mesh.position.z + ez, mesh });
  }

  function addPlane(w, h, material, x, y, z, rx = -PI / 2, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  // ---------------- ground ----------------
  const floor = addPlane(82, 82, mat.floor, 0, 0, -2);
  floor.receiveShadow = true;
  occluders.push(floor);

  const puddleTex = puddleTexture();
  for (let i = 0; i < (low ? 6 : 12); i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4 + rand() * 7, 2.4 + rand() * 4.5), new THREE.MeshBasicMaterial({ map: puddleTex, transparent: true, opacity: 0.13 + rand() * 0.08, color: 0x72cfe2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    p.rotation.set(-PI / 2, 0, rand() * PI);
    p.position.set((rand() - 0.5) * 54, 0.012 + rand() * 0.003, -6 + (rand() - 0.5) * 50);
    root.add(p);
  }

  const number = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), new THREE.MeshBasicMaterial({ map: groundNumberTexture('07'), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
  number.rotation.x = -PI / 2;
  number.position.set(0, 0.015, 8);
  root.add(number);

  for (let i = 0; i < 8; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 7.5), new THREE.MeshBasicMaterial({ color: 0xb58c33, transparent: true, opacity: 0.28 }));
    line.rotation.x = -PI / 2;
    line.position.set(-17.5 + i * 5, 0.013, 19.5);
    root.add(line);
  }

  // ---------------- perimeter ----------------
  addBox(62, 6.8, 1.2, mat.concrete, 0, 3.4, -31, 0);
  addBox(1.2, 6.8, 64, mat.concrete, -30.5, 3.4, -2, 0);
  addBox(1.2, 6.8, 64, mat.concrete, 30.5, 3.4, -2, 0);
  addBox(62, 6.8, 1.2, mat.concrete, 0, 3.4, 27, 0, true, false);

  // wall ribs and trim
  for (let x = -28; x <= 28; x += 7) {
    addBox(0.34, 6.6, 1.4, mat.concreteDark, x, 3.3, -30.35, 0, false, false);
  }
  for (let z = -28; z <= 24; z += 8) {
    addBox(1.4, 6.6, 0.34, mat.concreteDark, -29.85, 3.3, z, 0, false, false);
    addBox(1.4, 6.6, 0.34, mat.concreteDark, 29.85, 3.3, z, 0, false, false);
  }
  addBox(60, 0.12, 0.16, mat.cyan, 0, 6.15, -30.4, 0, false, false);
  addBox(0.16, 0.12, 61, mat.cyan, -29.9, 6.15, -2, 0, false, false);
  addBox(0.16, 0.12, 61, mat.cyan, 29.9, 6.15, -2, 0, false, false);

  // ---------------- facility / back building ----------------
  addBox(34, 7.2, 6, mat.concreteDark, 0, 3.6, -27.4, 0);
  addBox(35, 0.5, 6.8, mat.metal, 0, 7.35, -27.4, 0, false, false);
  addBox(30, 2.2, 0.35, mat.metalDark, 0, 5.9, -24.25, 0, false, false);
  for (let x = -14; x <= 14; x += 4) {
    addBox(0.45, 5.6, 0.4, mat.metal, x, 2.9, -24.15, 0, false, false);
  }
  // roll-up door
  addBox(8.4, 4.5, 0.26, mat.metal, 0, 2.25, -24.1, 0, false, false);
  for (let y = 0.35; y < 4.4; y += 0.34) addBox(8.1, 0.07, 0.3, mat.metalDark, 0, y, -23.95, 0, false, false);
  addBox(9.2, 0.5, 0.45, mat.hazard, 0, 4.65, -24.0, 0, false, false);
  addBox(0.42, 4.5, 0.4, mat.hazard, -4.3, 2.25, -23.9, 0, false, false);
  addBox(0.42, 4.5, 0.4, mat.hazard, 4.3, 2.25, -23.9, 0, false, false);

  // windows
  for (let i = 0; i < 6; i++) {
    const win = addBox(2.4, 0.9, 0.1, mat.glass, -12.5 + i * 5, 6.2, -24.06, 0, false, false);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.72), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x4a7b83 : 0x8c7444, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.position.set(win.position.x, 6.2, -24.0);
    root.add(glow);
  }

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.3), new THREE.MeshBasicMaterial({ map: signTexture('SECTOR 07', 'AUTHORIZED PERSONNEL ONLY', '#ff9a38'), transparent: true, toneMapped: false }));
  sign.position.set(0, 5.55, -24.05);
  root.add(sign);

  const sideSign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 2.4), new THREE.MeshBasicMaterial({ map: signTexture('RESTRICTED', 'USE OF FORCE AUTHORIZED', '#ff4c38', 8), transparent: true, toneMapped: false }));
  sideSign.position.set(-28.8, 4.3, -16);
  sideSign.rotation.y = PI / 2;
  root.add(sideSign);

  // loading dock
  addBox(15, 1.1, 4.2, mat.concreteDark, 0, 0.55, -21.1, 0);
  addBox(15.2, 0.22, 0.24, mat.hazard, 0, 1.08, -19.03, 0, false, false);
  for (let i = 0; i < 5; i++) {
    addBox(0.24, 0.75, 0.5, mat.metalDark, -6 + i * 3, 0.32, -18.85, 0, false, false);
  }

  // ---------------- catwalk above ----------------
  addBox(25, 0.24, 2.0, mat.metal, 0, 5.35, -22.8, 0, false, false);
  for (let x = -12; x <= 12; x += 2) {
    addBox(0.08, 1.1, 0.08, mat.metal, x, 6.0, -21.85, 0, false, false);
    addBox(0.08, 1.1, 0.08, mat.metal, x, 6.0, -23.75, 0, false, false);
  }
  addBox(24, 0.08, 0.08, mat.metalLight, 0, 6.52, -21.85, 0, false, false);
  addBox(24, 0.08, 0.08, mat.metalLight, 0, 6.52, -23.75, 0, false, false);
  for (let x = -12; x <= 12; x += 4) addBox(0.1, 1.18, 0.1, mat.metal, x, 6.0, -22.8, 0, false, false);
  for (let i = 0; i < 4; i++) {
    const bulb = addBox(0.55, 0.09, 0.16, mat.bulb, -9 + i * 6, 5.2, -22.8, 0, false, false);
    bulb.castShadow = false;
  }

  // ---------------- containers ----------------
  const containerDefs = [
    [-12, -5, 0, '#384b4b', '#9a4c24', 11],
    [12.6, -8, 0, '#4b3f39', '#a2552b', 13],
    [-15, -15.5, PI / 2, '#3b414a', '#8d4524', 15],
    [16.5, 3.5, PI / 2, '#3e4940', '#9b5c28', 17],
    [8.5, -17, 0, '#4a3c3b', '#a04c26', 19],
    [-6.5, 9.5, PI / 2, '#344044', '#9c552c', 21]
  ];
  function container(x, z, ry, color, accent, seed, stackY = 0) {
    const tex = containerTexture(color, accent, seed);
    const material = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.58, metalness: 0.35, envMapIntensity: 0.6 });
    addBox(2.55, 2.7, 6.15, material, x, 1.35 + stackY, z, ry);
    const along = ry === 0 ? [0, 0, 6.3] : [6.3, 0, 0];
    const across = ry === 0 ? [2.7, 0, 0] : [0, 0, 2.7];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addBox(0.15, 2.8, 0.15, mat.metalDark, x + (ry === 0 ? sx * 1.28 : sz * 3.08), 1.35 + stackY, z + (ry === 0 ? sz * 3.08 : sx * 1.28), 0, false, false);
      }
    }
    addBox(ry === 0 ? 2.7 : 6.2, 0.13, ry === 0 ? 6.2 : 2.7, mat.metalDark, x, 0.12 + stackY, z, 0, false, false);
    addBox(ry === 0 ? 2.7 : 6.2, 0.13, ry === 0 ? 6.2 : 2.7, mat.metalDark, x, 2.76 + stackY, z, 0, false, false);
    if (stackY === 0) {
      const labelTex = signTexture(`MSKU ${seed}407`, 'MERIDIAN PORT AUTHORITY', '#b8a070', seed);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.55), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, opacity: 0.5, toneMapped: false }));
      label.position.set(x + (ry === 0 ? 0 : (across[0] > 0 ? 1.29 : 1.29)), 1.75, z + (ry === 0 ? 3.09 : 0));
      label.rotation.y = ry === 0 ? 0 : PI / 2;
      root.add(label);
    }
    return { x, z, ry };
  }
  for (const d of containerDefs) container(...d);
  // stacked second container
  container(-12, -5, 0, '#2d3d42', '#a55028', 23, 2.8);

  // ---------------- cover / props ----------------
  function barrier(x, z, ry = 0) {
    const b = addBox(3.2, 0.95, 0.65, mat.concrete, x, 0.475, z, ry);
    addBox(3.2, 0.12, 0.68, mat.hazard, x, 0.94, z, ry, false, false);
    addBox(3.0, 0.15, 0.7, mat.concreteDark, x, 0.12, z, ry, false, false);
    return b;
  }
  barrier(-2, 1.5, 0.18);
  barrier(5.6, 11, -0.5);
  barrier(-9, 14, 0.2);
  barrier(18, 12, PI / 2 - 0.1);
  barrier(-20, 2, PI / 2);
  barrier(3, -11.5, -0.1);

  function crate(x, z, y = 0.55, s = 1.1, ry = 0) {
    const m = addBox(s, s, s, mat.metalDark, x, y, z, ry);
    addBox(s * 1.02, 0.08, s * 1.02, mat.hazard, x, y + s * 0.33, z, ry, false, false);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) {
      addBox(0.06, s * 1.01, 0.06, mat.metal, x + ax * s * 0.47, y, z + az * s * 0.47, ry, false, false);
    }
    return m;
  }
  crate(-9.7, -2.1, 0.55, 1.15, 0.12);
  crate(-8.7, -2.7, 0.55, 0.95, -0.2);
  crate(-9.4, -2.3, 1.7, 1.0, 0.1);
  crate(10.2, -4.6, 0.55, 1.2, 0.16);
  crate(11.2, -5.1, 0.55, 0.9, 0.4);
  crate(11.1, -4.8, 1.65, 1.0, 0.2);
  crate(-19.5, -10.2, 0.55, 1.15, 0.2);
  crate(21.5, -14.5, 0.55, 1.25, 0.1);
  crate(21.8, -14.2, 1.75, 1.0, 0.25);

  function barrel(x, z, color = 0xb65e22) {
    const cylinderMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.7, envMapIntensity: 0.8 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 1.0, 14), cylinderMat);
    b.position.set(x, 0.5, z);
    b.castShadow = true; b.receiveShadow = true;
    root.add(b);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.035, 5, 16), mat.metal);
    ring.position.set(x, 0.78, z); ring.rotation.x = PI / 2; root.add(ring);
    const ring2 = ring.clone(); ring2.position.y = 0.25; root.add(ring2);
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.373, 0.383, 0.18, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xd7a545, toneMapped: false }));
    strip.position.set(x, 0.55, z); root.add(strip);
    colliders.push({ minX: x - 0.38, maxX: x + 0.38, minZ: z - 0.38, maxZ: z + 0.38, mesh: b });
    occluders.push(b);
  }
  barrel(-16.7, 5.4); barrel(-17.5, 5.7, 0x3f5960); barrel(-16.9, 6.5);
  barrel(6.8, -14.6, 0x3f5960); barrel(7.5, -14.3); barrel(19.3, 6.9);
  barrel(-23.8, -4.3); barrel(-24.4, -3.5, 0x3f5960);

  // jersey blocks near spawn approach
  addBox(2.4, 0.8, 1.2, mat.concreteDark, -4.5, 0.4, 17.5, 0.25);
  addBox(2.4, 0.8, 1.2, mat.concreteDark, 11.5, 0.4, 17, -0.2);

  // ---------------- pipes and industrial dressing ----------------
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x536166, roughness: 0.4, metalness: 0.9, envMapIntensity: 0.7 });
  for (const [y, r] of [[5.1, 0.28], [4.5, 0.19], [6.05, 0.16]]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 58, 12), pipeMat);
    pipe.rotation.z = PI / 2;
    pipe.position.set(0, y, -29.1);
    pipe.castShadow = true;
    root.add(pipe);
  }
  for (let x = -25; x <= 25; x += 6.2) {
    const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 5, 12), mat.metalDark);
    clamp.rotation.y = PI / 2;
    clamp.position.set(x, 5.1, -29.1);
    root.add(clamp);
  }
  for (const x of [-22, -8, 7, 20]) {
    addBox(0.2, 5.8, 0.2, mat.metalDark, x, 2.9, -29.1, 0, false, false);
    steam.push(new THREE.Vector3(x, 5.6, -28.7));
  }

  // vertical pipes at side wall
  for (let i = 0; i < 4; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.2, 8), pipeMat);
    pipe.position.set(-29.7, 3.1, 16 - i * 2.1);
    root.add(pipe);
  }

  // ---------------- lamps / lights ----------------
  const lampGroup = new THREE.Group();
  root.add(lampGroup);
  const lampDefs = [
    [-18.5, 8.5, 0x9fe4ff],
    [18.5, 5.5, 0xffb667],
    [0, -16.2, 0xffb060],
    [-23, -18, 0x9fe4ff],
    [22, 17, 0xffa04d]
  ];
  const lampLights = [];
  function lamp(x, z, color) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 6.4, 8), mat.metalDark);
    pole.position.set(x, 3.2, z);
    pole.castShadow = true;
    root.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1.6), mat.metalDark);
    arm.position.set(x, 6.3, z - 0.7);
    root.add(arm);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.85), mat.metal);
    housing.position.set(x, 6.22, z - 1.4);
    housing.castShadow = true;
    root.add(housing);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.55), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    bulb.position.set(x, 6.1, z - 1.4);
    root.add(bulb);
    if (!low) {
      const light = new THREE.PointLight(color, 190, 26, 2);
      light.position.set(x, 5.95, z - 1.4);
      lampGroup.add(light);
      lampLights.push(light);
    }
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.9, 6.0, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.026, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    cone.position.set(x, 3.0, z - 1.4);
    root.add(cone);
    animated.push({ obj: cone, type: 'beam' });
    return null;
  }
  for (const [x, z, c] of lampDefs) lamp(x, z, c);

  // central work light over the yard
  const workPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7.0, 8), mat.metalDark);
  workPole.position.set(0, 3.5, 6.6);
  root.add(workPole);
  const workArm = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.09, 0.09), mat.metalDark);
  workArm.position.set(0, 6.75, 6.6);
  root.add(workArm);
  for (const wx of [-2.1, 0, 2.1]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.44), mat.metal);
    housing.position.set(wx, 6.6, 6.6);
    root.add(housing);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.3), mat.bulb);
    bulb.position.set(wx, 6.48, 6.6);
    root.add(bulb);
  }
  if (!low) {
    const workLight = new THREE.PointLight(0xbcd8e8, 150, 22, 2);
    workLight.position.set(0, 6.3, 6.6);
    lampGroup.add(workLight);
    lampLights.push(workLight);
  } else {
    const lowLight = new THREE.PointLight(0xb9d6e6, 460, 34, 2);
    lowLight.position.set(0, 6.6, 3.5);
    lampGroup.add(lowLight);
    lampLights.push(lowLight);
  }

  // corner watch lights
  if (!low) {
    const spot = new THREE.SpotLight(0xbedcff, 620, 70, 0.24, 0.55, 1.4);
    spot.position.set(24, 9, 19);
    spot.target.position.set(0, 0, -7);
    scene.add(spot.target);
    scene.add(spot);
    const spotHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.34, 0.65, 12), mat.metalDark);
    spotHousing.position.set(24, 9, 19);
    spotHousing.rotation.x = 0.45;
    root.add(spotHousing);
    const spotLens = new THREE.Mesh(new THREE.CircleGeometry(0.41, 16), new THREE.MeshBasicMaterial({ color: 0xcfe9ff, toneMapped: false }));
    spotLens.position.set(24, 8.82, 19.34);
    spotLens.rotation.x = -0.9;
    root.add(spotLens);
  }

  // red hazard lights
  const redLights = [];
  for (const [x, y, z] of [[-15, 6.8, -24.1], [15, 6.8, -24.1], [-24.5, 0.55, 22.5]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat.red);
    m.position.set(x, y, z);
    root.add(m);
    let l = null;
    if (!low) {
      l = new THREE.PointLight(0xff2f24, 16, 5.5, 2);
      l.position.copy(m.position);
      scene.add(l);
    }
    redLights.push({ mesh: m, light: l, phase: rand() * PI * 2 });
  }

  // ---------------- sky / moon ----------------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, toneMapped: false }));
  sky.rotation.y = 0.7;
  scene.add(sky);

  const moon = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: 0xcfdfec, transparent: true, opacity: 0.44, toneMapped: false, fog: false }));
  moon.position.set(-58, 72, -140);
  moon.lookAt(0, 2, 0);
  scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(moonCanvas()), color: 0x86b6d6, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  moonGlow.position.copy(moon.position);
  moonGlow.scale.setScalar(54);
  scene.add(moonGlow);

  // distant skyline silhouettes
  for (let i = 0; i < (low ? 13 : 26); i++) {
    const w = 2 + rand() * 7;
    const h = 3 + rand() * 16;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.5), new THREE.MeshBasicMaterial({ color: 0x071018, fog: false }));
    const a = -0.9 + rand() * 1.8;
    b.position.set(Math.sin(a) * 115, h / 2 - 1, -Math.cos(a) * 115 - 18);
    scene.add(b);
    if (!low && rand() > 0.45) {
      const lit = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ color: rand() > 0.2 ? 0xff9f4a : 0x7be6ff, toneMapped: false, fog: false }));
      lit.position.set(b.position.x + (rand() - 0.5) * w * 0.7, 1 + rand() * h, b.position.z + 1.3);
      scene.add(lit);
    }
  }

  // ---------------- lights ----------------
  const hemi = new THREE.HemisphereLight(0x7fa4c4, 0x0c1216, low ? 2.9 : 2.35);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0x3b5468, low ? 0.95 : 0.7));
  const moonLight = new THREE.DirectionalLight(0x9cbfe6, low ? 3.1 : 2.7);
  moonLight.position.set(-28, 38, 18);
  moonLight.target.position.set(0, 0, -4);
  scene.add(moonLight.target);
  moonLight.castShadow = !low;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.left = -40;
  moonLight.shadow.camera.right = 40;
  moonLight.shadow.camera.top = 40;
  moonLight.shadow.camera.bottom = -40;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 90;
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.025;
  scene.add(moonLight);
  if (!low) {
    const fill = new THREE.DirectionalLight(0x1f5577, 1.15);
    fill.position.set(20, 12, -20);
    scene.add(fill);
  }

  // ---------------- rain ----------------
  const dropCount = low ? 620 : 1900;
  const rainPos = new Float32Array(dropCount * 6);
  const drops = [];
  for (let i = 0; i < dropCount; i++) {
    drops.push({
      x: (rand() - 0.5) * 58,
      y: rand() * 24,
      z: (rand() - 0.5) * 58,
      v: 15 + rand() * 11,
      len: 0.5 + rand() * 0.9
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xa8d3e2, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  // ---------------- mist ----------------
  const mistTex = smokeTexture();
  const mists = [];
  for (let i = 0; i < (low ? 4 : 9); i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0x71909a, transparent: true, opacity: 0.036, depthWrite: false }));
    m.position.set((rand() - 0.5) * 46, 0.8 + rand() * 1.4, -8 + (rand() - 0.5) * 45);
    m.scale.set(11 + rand() * 10, 4 + rand() * 3, 1);
    scene.add(m);
    mists.push({ sprite: m, speed: 0.07 + rand() * 0.1, phase: rand() * 10 });
  }

  // lightning
  let lightningLight = null;
  if (!low) {
    lightningLight = new THREE.DirectionalLight(0xb8d4ff, 0);
    lightningLight.position.set(10, 40, -30);
    scene.add(lightningLight);
  }
  let lightningTimer = 10 + rand() * 8;
  let lightningPulse = 0;

  const spawnPoints = [
    { x: -23, z: -20 }, { x: 23, z: -19 }, { x: -24, z: 8 },
    { x: 24, z: 10 }, { x: -18, z: -24 }, { x: 18, z: -24 }
  ];

  const steamTimers = steam.map(() => rand() * 2);

  function update(dt, time, playerPos, effects) {
    // rain
    const arr = rainGeo.attributes.position.array;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y -= d.v * dt;
      d.x += 1.3 * dt;
      if (d.y < 0) {
        d.y = 18 + Math.random() * 8;
        d.x = playerPos.x + (Math.random() - 0.5) * 48;
        d.z = playerPos.z + (Math.random() - 0.5) * 48;
      }
      if (Math.abs(d.x - playerPos.x) > 27) d.x = playerPos.x + (Math.random() - 0.5) * 48;
      if (Math.abs(d.z - playerPos.z) > 27) d.z = playerPos.z + (Math.random() - 0.5) * 48;
      const j = i * 6;
      arr[j] = d.x;
      arr[j + 1] = d.y;
      arr[j + 2] = d.z;
      arr[j + 3] = d.x - 0.045;
      arr[j + 4] = d.y + d.len;
      arr[j + 5] = d.z + 0.02;
    }
    rainGeo.attributes.position.needsUpdate = true;

    // mist drift
    for (const m of mists) {
      m.sprite.position.x += m.speed * dt;
      m.sprite.position.y += Math.sin(time * 0.3 + m.phase) * 0.006;
      if (m.sprite.position.x > 28) m.sprite.position.x = -28;
    }

    // lamp flicker
    for (let i = 0; i < lampLights.length; i++) {
      const l = lampLights[i];
      const base = 190;
      l.intensity = base + Math.sin(time * 14 + i * 3.4) * 0.7 + (Math.random() - 0.5) * 0.5;
    }
    for (const r of redLights) {
      const pulse = (Math.sin(time * 3.4 + r.phase) + 1) * 0.5;
      if (r.light) r.light.intensity = 5 + pulse * 16;
      r.mesh.scale.setScalar(0.85 + pulse * 0.3);
    }

    // steam vents
    if (effects) {
      for (let i = 0; i < steam.length; i++) {
        steamTimers[i] -= dt;
        if (steamTimers[i] <= 0) {
          steamTimers[i] = 1.6 + Math.random() * 2.2;
          effects.smokeAt(steam[i].clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)), 0.5, 2.2, 0x91a5aa, 0.35);
        }
      }
    }

    // lightning
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightningTimer = 12 + Math.random() * 16;
      lightningPulse = 0.24;
      document.getElementById('lightning-flash')?.classList.remove('flash');
      void document.getElementById('lightning-flash')?.offsetWidth;
      document.getElementById('lightning-flash')?.classList.add('flash');
    }
    if (lightningLight) {
      if (lightningPulse > 0) {
        lightningPulse -= dt;
        lightningLight.intensity = Math.max(0, lightningPulse * 35 * (0.6 + Math.random() * 0.5));
      } else lightningLight.intensity = 0;
    }
  }

  return { root, colliders, occluders, spawnPoints, update, lampLights, moonLight, hemi, floor };
}

function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function moonCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(226,242,255,0.9)');
  g.addColorStop(0.14, 'rgba(186,218,244,0.62)');
  g.addColorStop(0.4, 'rgba(100,150,190,0.16)');
  g.addColorStop(1, 'rgba(40,80,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}
