import * as THREE from 'three';
import { boxFromExtents, canvasTexture, rng } from './util.js';
import { T, phase, ease, lerp } from './timeline.js';

/*
 * Foreground building materials at realistic proportions (metres):
 * brick pallet, hollow cement blocks, steel pipes, rebar bundle,
 * corrugated roofing sheets and a sand heap. Instanced where repeated.
 */

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);

export function createSupplies({ shadows, tier }) {
  const root = new THREE.Group();
  const rand = rng(7);
  const items = [];
  const setShadow = (o) => o.traverse((c) => { if (c.isMesh) { c.castShadow = shadows; c.receiveShadow = shadows; } });

  const timber = new THREE.MeshStandardMaterial({ color: 0x9b7348, roughness: 0.85 });
  const pallet = (w, d) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(boxFromExtents(-w / 2, w / 2, 0, 0.1, -d / 2 + i * (d / 2) - 0.05, -d / 2 + i * (d / 2) + 0.05, timber));
    for (let i = 0; i < 6; i++) {
      const x = -w / 2 + (i + 0.5) * (w / 6);
      g.add(boxFromExtents(x - 0.07, x + 0.07, 0.1, 0.13, -d / 2, d / 2, timber));
    }
    return g;
  };

  // ---------- Bricks ----------
  {
    const g = new THREE.Group();
    g.add(pallet(1.2, 1.0));
    const brickTex = canvasTexture(64, (c, s) => {
      c.fillStyle = '#b5532f'; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 220; i++) {
        c.fillStyle = `rgba(${90 + Math.random() * 80},${30 + Math.random() * 30},20,.35)`;
        c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
    });
    const mat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9, color: 0xffffff });
    const bw = 0.215, bh = 0.068, bd = 0.103, gap = 0.008;
    const cols = 5, rows = 9, layers = tier === 'low' ? 8 : 11;
    const geo = new THREE.BoxGeometry(bw, bh, bd);
    const im = new THREE.InstancedMesh(geo, mat, cols * rows * layers);
    const col = new THREE.Color();
    let k = 0;
    for (let l = 0; l < layers; l++) {
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          v.set((c - (cols - 1) / 2) * (bw + gap), 0.13 + bh / 2 + l * (bh + gap), (r - (rows - 1) / 2) * (bd + gap));
          q.setFromEuler(e.set(0, (rand() - 0.5) * 0.03, 0));
          im.setMatrixAt(k, m4.compose(v, q, one));
          col.setHSL(0.04 + rand() * 0.02, 0.55, 0.42 + rand() * 0.1);
          im.setColorAt(k, col);
          k++;
        }
      }
    }
    g.add(im);
    items.push({ obj: g, pos: [4.3, 0, 9.0], rot: 0.35, delay: 0 });
  }

  // ---------- Hollow cement blocks ----------
  {
    const g = new THREE.Group();
    g.add(pallet(1.25, 1.25));
    const W = 0.39, D = 0.19, Hh = 0.19;
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, -D / 2); shape.lineTo(W / 2, -D / 2); shape.lineTo(W / 2, D / 2); shape.lineTo(-W / 2, D / 2); shape.closePath();
    for (const cx of [-0.085, 0.085]) {
      const hole = new THREE.Path();
      hole.moveTo(cx - 0.06, -0.05); hole.lineTo(cx + 0.06, -0.05); hole.lineTo(cx + 0.06, 0.05); hole.lineTo(cx - 0.06, 0.05); hole.closePath();
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: Hh, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); // extrude upwards: holes open to the sky
    const concreteTex = canvasTexture(64, (c, s) => {
      c.fillStyle = '#9a9890'; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 400; i++) {
        const l = 110 + Math.random() * 70;
        c.fillStyle = `rgba(${l},${l},${l - 6},.5)`;
        c.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
      }
    }, { repeat: [3, 3] });
    const mat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95, color: 0xffffff });
    const layers = 5;
    const im = new THREE.InstancedMesh(geo, mat, 3 * 6 * layers);
    let k = 0;
    for (let l = 0; l < layers; l++) {
      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 6; r++) {
          const rotated = l % 2 === 1;
          const x = rotated ? (r - 2.5) * (D + 0.01) : (c - 1) * (W + 0.01);
          const z = rotated ? (c - 1) * (W + 0.01) : (r - 2.5) * (D + 0.01);
          v.set(x, 0.13 + l * (Hh + 0.005), z);
          q.setFromEuler(e.set(0, rotated ? Math.PI / 2 : 0, 0));
          im.setMatrixAt(k++, m4.compose(v, q, one));
        }
      }
    }
    g.add(im);
    items.push({ obj: g, pos: [6.5, 0, 7.4], rot: -0.2, delay: 0.15 });
  }

  // ---------- Steel pipes (hollow, pyramid stack) ----------
  {
    const g = new THREE.Group();
    const R = 0.11, r = 0.092, len = 3.2;
    const ring = new THREE.Shape();
    ring.absarc(0, 0, R, 0, Math.PI * 2, false);
    const inner = new THREE.Path();
    inner.absarc(0, 0, r, 0, Math.PI * 2, true);
    ring.holes.push(inner);
    const geo = new THREE.ExtrudeGeometry(ring, { depth: len, bevelEnabled: false, curveSegments: tier === 'low' ? 14 : 22 });
    geo.translate(0, 0, -len / 2);
    geo.rotateY(Math.PI / 2); // lie along X
    const mat = new THREE.MeshStandardMaterial({ color: 0xb9bec2, roughness: 0.32, metalness: 0.9, side: THREE.DoubleSide });
    const rowsCount = [4, 3, 2, 1];
    const total = rowsCount.reduce((a, b) => a + b, 0);
    const im = new THREE.InstancedMesh(geo, mat, total);
    let k = 0;
    rowsCount.forEach((count, row) => {
      for (let i = 0; i < count; i++) {
        v.set((rand() - 0.5) * 0.12, R + row * R * 1.74, (i - (count - 1) / 2) * R * 2.02);
        im.setMatrixAt(k++, m4.compose(v, q.identity(), one));
      }
    });
    g.add(im);
    // timber sleepers under the stack
    for (const x of [-1.1, 1.1]) g.add(boxFromExtents(x - 0.07, x + 0.07, -0.08, 0, -0.55, 0.55, timber));
    g.position.y = 0.08;
    items.push({ obj: g, pos: [2.4, 0, 11.2], rot: 0.12, delay: 0.3 });
  }

  // ---------- Rebar bundle ----------
  {
    const g = new THREE.Group();
    const len = 5.2;
    const geo = new THREE.CylinderGeometry(0.016, 0.016, len, 6);
    geo.rotateZ(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a4a3e, roughness: 0.55, metalness: 0.85 });
    const count = tier === 'low' ? 18 : 30;
    const im = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 6), c = i % 6;
      v.set((rand() - 0.5) * 0.25, 0.14 + 0.016 + row * 0.03, (c - 2.5) * 0.034 + (row % 2) * 0.017);
      q.setFromEuler(e.set(0, (rand() - 0.5) * 0.02, 0));
      im.setMatrixAt(i, m4.compose(v, q, one));
    }
    g.add(im);
    for (const x of [-1.8, 0, 1.8]) g.add(boxFromExtents(x - 0.06, x + 0.06, 0, 0.14, -0.3, 0.3, timber));
    // brass binding wire
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xc99a2e, metalness: 1, roughness: 0.3 });
    for (const x of [-1.2, 1.2]) g.add(boxFromExtents(x - 0.02, x + 0.02, 0.13, 0.32, -0.12, 0.12, bandMat));
    items.push({ obj: g, pos: [8.8, 0, 9.0], rot: -1.15, delay: 0.45 });
  }

  // ---------- Corrugated roofing sheets ----------
  {
    const g = new THREE.Group();
    const w = 0.9, l = 2.4;
    const geo = new THREE.PlaneGeometry(w, l, 72, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 0.076) * Math.PI * 2) * 0.012);
    geo.computeVertexNormals();
    geo.rotateX(-Math.PI / 2);
    const silver = new THREE.MeshStandardMaterial({ color: 0xc7ccd0, roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide });
    const green = new THREE.MeshStandardMaterial({ color: 0x0f5d3a, roughness: 0.38, metalness: 0.55, side: THREE.DoubleSide });
    const sheets = 6;
    for (let i = 0; i < sheets; i++) {
      const s = new THREE.Mesh(geo, i === sheets - 1 ? green : silver);
      s.position.set((rand() - 0.5) * 0.06, 0.16 + i * 0.026, (rand() - 0.5) * 0.08);
      s.rotation.y = (rand() - 0.5) * 0.04;
      g.add(s);
    }
    for (const z of [-0.9, 0, 0.9]) g.add(boxFromExtents(-0.55, 0.55, 0, 0.14, z - 0.06, z + 0.06, timber));
    items.push({ obj: g, pos: [5.5, 0, 12.6], rot: 0.95, delay: 0.6 });
  }

  // ---------- Sand heap ----------
  {
    const geo = new THREE.ConeGeometry(1.0, 0.6, 28, 6);
    const p = geo.attributes.position;
    const rr = rng(3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < 0.29) {
        const f = 1 + (rr() - 0.5) * 0.12;
        p.setX(i, p.getX(i) * f);
        p.setZ(i, p.getZ(i) * f);
        p.setY(i, y + (rr() - 0.5) * 0.03);
      }
    }
    geo.computeVertexNormals();
    geo.translate(0, 0.3, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc7a066, roughness: 1 });
    const sand = new THREE.Mesh(geo, mat);
    sand.scale.set(1, 1, 0.8);
    const g = new THREE.Group();
    g.add(sand);
    items.push({ obj: g, pos: [0.6, 0, 9.4], rot: 0, delay: 0.1 });
  }

  for (const it of items) {
    it.obj.position.set(...it.pos);
    it.obj.rotation.y = it.rot;
    setShadow(it.obj);
    it.obj.visible = false;
    root.add(it.obj);
  }

  function update(t) {
    for (const it of items) {
      const p = phase(t, T.supplies[0] + it.delay, T.supplies[1] - 0.6, ease.outQuart);
      it.obj.visible = p > 0;
      it.obj.position.y = lerp(1.2, 0, p);
      const s = lerp(0.82, 1, p);
      it.obj.scale.setScalar(s);
    }
  }

  return { group: root, update };
}
