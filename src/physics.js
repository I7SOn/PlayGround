import * as THREE from 'three';

export function resolveCircle(pos, radius, colliders) {
  for (let iter = 0; iter < 2; iter++) {
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      let dx = pos.x - nx;
      let dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        // inside the box — push out along the nearest face
        const left = pos.x - c.minX;
        const right = c.maxX - pos.x;
        const back = pos.z - c.minZ;
        const front = c.maxZ - pos.z;
        const m = Math.min(left, right, back, front);
        if (m === left) pos.x = c.minX - radius;
        else if (m === right) pos.x = c.maxX + radius;
        else if (m === back) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
}

const _ray = new THREE.Raycaster();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

export function lineBlocked(from, to, occluders, margin = 0.15) {
  _from.copy(from);
  _to.copy(to);
  _ray.set(_from, _to.clone().sub(_from).normalize());
  _ray.far = _from.distanceTo(_to) - margin;
  _ray.near = 0.05;
  const hits = _ray.intersectObjects(occluders, false);
  return hits.length > 0;
}

export function randomPointInCircle(radius) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}
