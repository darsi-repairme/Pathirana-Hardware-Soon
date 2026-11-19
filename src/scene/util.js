import * as THREE from 'three';

/** Box mesh defined by its extents (min/max on each axis), in metres. */
export function boxFromExtents(x0, x1, y0, y1, z0, z1, material) {
  const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return mesh;
}

/**
 * Merges the hard edges of many meshes/geometries into ONE LineSegments geometry
 * (one draw call). Items are sorted bottom-up so a growing drawRange "builds" upward.
 * items: Array<THREE.Mesh | { geometry, matrix }>
 */
export function mergeEdges(items, thresholdAngle = 30) {
  const chunks = items.map((it) => {
    it.updateMatrix?.();
    const edges = new THREE.EdgesGeometry(it.geometry, thresholdAngle);
    edges.applyMatrix4(it.matrix);
    edges.computeBoundingBox();
    return edges;
  });
  chunks.sort((a, b) => a.boundingBox.min.y - b.boundingBox.min.y || a.boundingBox.min.x - b.boundingBox.min.x);
  let total = 0;
  for (const c of chunks) total += c.attributes.position.count;
  const pos = new Float32Array(total * 3);
  let offset = 0;
  for (const c of chunks) {
    pos.set(c.attributes.position.array, offset);
    offset += c.attributes.position.array.length;
    c.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return merged;
}

/** Wireframe-only box (geometry + matrix, no mesh in the scene). */
export function ghostBox(x0, x1, y0, y1, z0, z1) {
  const geometry = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const matrix = new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return { geometry, matrix };
}

/** Line geometry from a flat list of segment endpoints [[x,y,z],[x,y,z], ...]. */
export function segments(points) {
  const arr = new Float32Array(points.length * 3);
  points.forEach((p, i) => arr.set(p, i * 3));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Sets a LineSegments' visible fraction (keeps whole segments). */
export function setDrawFraction(line, f) {
  const count = line.geometry.attributes.position.count;
  const n = Math.floor((count * Math.min(1, Math.max(0, f))) / 2) * 2;
  line.geometry.setDrawRange(0, n);
  line.visible = n > 0;
}

/** Small procedural canvas texture (no image downloads). */
export function canvasTexture(size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Deterministic pseudo-random generator so the scene looks identical every load. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
