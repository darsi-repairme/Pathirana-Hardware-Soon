import * as THREE from 'three';
import { boxFromExtents } from './util.js';
import { T, phase, ease, lerp } from './timeline.js';

/*
 * Original procedural tower crane (metres): lattice mast, slewing jib,
 * counter-jib with ballast, trolley, hoist cable, hook block and a steel I-beam.
 * Opening: the crane rises, slews to the work position, runs the trolley out and
 * lowers the beam onto the future third floor. Then it holds with gentle motion.
 */

const UP = new THREE.Vector3(0, 1, 0);

export function createCrane({ base, target, shadows, height = 15 }) {
  const H = height;
  const group = new THREE.Group();
  group.position.copy(base);
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const common = { clippingPlanes: [clip], clipShadows: true };

  const M = {
    steel: new THREE.MeshStandardMaterial({ color: 0xc4952c, roughness: 0.42, metalness: 0.65, ...common }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1e2321, roughness: 0.5, metalness: 0.6, ...common }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x8e8d86, roughness: 0.95, ...common }),
    cab: new THREE.MeshStandardMaterial({ color: 0xf3f1ea, roughness: 0.5, ...common }),
    glass: new THREE.MeshStandardMaterial({ color: 0x163d3a, roughness: 0.05, metalness: 0.9, ...common }),
    beam: new THREE.MeshStandardMaterial({ color: 0x8f3a1f, roughness: 0.55, metalness: 0.45, ...common }),
    cable: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, metalness: 0.3, ...common }),
  };

  // ---- Instanced lattice struts (one draw call per thickness) ----
  const struts = [];
  const strut = (a, b, r = 0.045) => struts.push({ a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), r });

  // Mast
  const h = 0.65, seg = 1.4, n = Math.round(H / seg);
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (let i = 0; i < n; i++) {
    const y0 = i * seg, y1 = y0 + seg;
    for (let f = 0; f < 4; f++) {
      const A = corners[f], B = corners[(f + 1) % 4];
      const [p, q] = i % 2 ? [A, B] : [B, A];
      strut([p[0], y0, p[1]], [q[0], y1, q[1]]);
      strut([A[0], y0, A[1]], [B[0], y0, B[1]]);
    }
  }
  // Tower head (apex)
  const apex = [0, H + 4.2, 0];
  for (const [x, z] of corners) strut([x * 0.9, H + 0.5, z * 0.9], apex, 0.07);

  // Jib (+x) — triangular lattice
  const L = 14.5, js = 1.45;
  for (let x = 0.8; x < L - 0.01; x += js) {
    const x1 = Math.min(L, x + js);
    strut([x, H + 0.5, -0.55], [x1, H + 1.65, 0]);
    strut([x, H + 0.5, 0.55], [x1, H + 1.65, 0]);
    strut([x, H + 0.5, -0.55], [x, H + 0.5, 0.55]);
    strut([x, H + 0.5, 0.55], [x1, H + 0.5, -0.55]);
  }
  // Counter-jib (-x)
  for (let x = -0.8; x > -5.6; x -= 1.2) {
    strut([x, H + 0.5, -0.6], [x - 1.2, H + 0.5, 0.6]);
    strut([x, H + 0.5, -0.6], [x, H + 0.5, 0.6]);
  }
  // Pendant ties from the apex
  strut(apex, [8.5, H + 1.65, 0], 0.035);
  strut(apex, [L - 0.3, H + 1.65, 0], 0.035);
  strut(apex, [-5.6, H + 0.6, 0.45], 0.035);
  strut(apex, [-5.6, H + 0.6, -0.45], 0.035);

  const strutGeo = new THREE.BoxGeometry(1, 1, 1);
  const mast = new THREE.Group();   // static part
  const top = new THREE.Group();    // slewing part (rotates about Y)
  top.position.y = 0;

  const mastStruts = struts.filter((s) => Math.max(s.a.y, s.b.y) <= H + 0.01);
  const topStruts = struts.filter((s) => Math.max(s.a.y, s.b.y) > H + 0.01);
  const buildInstanced = (list, parent) => {
    const im = new THREE.InstancedMesh(strutGeo, M.steel, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), d = new THREE.Vector3();
    list.forEach((st, i) => {
      d.subVectors(st.b, st.a);
      const len = d.length();
      q.setFromUnitVectors(UP, d.normalize());
      p.addVectors(st.a, st.b).multiplyScalar(0.5);
      s.set(st.r * 2, len, st.r * 2);
      im.setMatrixAt(i, m.compose(p, q, s));
    });
    im.castShadow = shadows;
    im.computeBoundingSphere();
    parent.add(im);
  };
  buildInstanced(mastStruts, mast);
  buildInstanced(topStruts, top);

  // Mast chords + base
  const solid = (x0, x1, y0, y1, z0, z1, mat, parent) => {
    const b = boxFromExtents(x0, x1, y0, y1, z0, z1, mat);
    b.castShadow = shadows;
    b.receiveShadow = shadows;
    parent.add(b);
    return b;
  };
  for (const [x, z] of corners) solid(x - 0.07, x + 0.07, 0, H + 0.5, z - 0.07, z + 0.07, M.steel, mast);
  solid(-1.4, 1.4, -0.1, 0.5, -1.4, 1.4, M.concrete, mast);

  // Slewing unit
  const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 20), M.dark);
  turntable.position.y = H + 0.25;
  turntable.castShadow = shadows;
  top.add(turntable);
  solid(-0.45, 0.85, H - 0.9, H + 0.4, 0.75, 1.95, M.cab, top);         // operator cab
  solid(0.86, 0.9, H - 0.6, H + 0.2, 0.85, 1.85, M.glass, top);
  for (const z of [-0.55, 0.55]) solid(0.8, L, H + 0.46, H + 0.56, z - 0.05, z + 0.05, M.steel, top); // jib chords
  solid(0.8, L, H + 1.6, H + 1.7, -0.05, 0.05, M.steel, top);
  for (const z of [-0.6, 0.6]) solid(-5.8, -0.8, H + 0.44, H + 0.58, z - 0.06, z + 0.06, M.steel, top);
  solid(-5.8, -0.8, H + 0.56, H + 0.6, -0.6, 0.6, M.dark, top);         // walkway
  for (let i = 0; i < 3; i++) solid(-5.6 + i * 0.5, -5.15 + i * 0.5, H - 1.1, H + 0.44, -0.75, 0.75, M.concrete, top); // ballast

  // Trolley, cable, hook block, slings and beam
  const trolley = new THREE.Group();
  solid(-0.45, 0.45, 0.25, 0.5, -0.5, 0.5, M.dark, trolley);
  trolley.position.y = H;
  top.add(trolley);

  const cableGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 5);
  cableGeo.translate(0, -0.5, 0); // hangs down from its origin
  const cables = [-0.12, 0.12].map((z) => {
    const c = new THREE.Mesh(cableGeo, M.cable);
    c.position.set(0, 0.25, z);
    trolley.add(c);
    return c;
  });

  const hook = new THREE.Group();
  trolley.add(hook);
  solid(-0.28, 0.28, -0.62, 0, -0.2, 0.2, M.steel, hook);              // hook block
  const hookTip = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 16, Math.PI * 1.5), M.dark);
  hookTip.position.y = -0.82;
  hookTip.rotation.z = Math.PI * 0.25;
  hook.add(hookTip);
  // I-beam hangs perpendicular to the jib
  const beam = new THREE.Group();
  const bl = 4.4;
  solid(-0.16, 0.16, -0.03, 0.03, -bl / 2, bl / 2, M.beam, beam);       // top flange
  solid(-0.16, 0.16, -0.35, -0.29, -bl / 2, bl / 2, M.beam, beam);      // bottom flange
  solid(-0.025, 0.025, -0.32, -0.03, -bl / 2, bl / 2, M.beam, beam);    // web
  beam.position.y = -1.5;
  hook.add(beam);
  for (const z of [-1.5, 1.5]) {
    const sling = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 4), M.cable);
    const a = new THREE.Vector3(0, -0.95, 0), b = new THREE.Vector3(0, -1.5, z);
    sling.position.addVectors(a, b).multiplyScalar(0.5);
    sling.scale.y = a.distanceTo(b);
    sling.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    hook.add(sling);
  }

  group.add(mast, top);

  // ---- Geometry of the lift ----
  const BEAM_DROP = 1.5 + 0.35;               // hook origin -> beam underside
  const dx = target.x - base.x, dz = target.z - base.z;
  const slewEnd = Math.atan2(-dz, dx);        // jib (+x) pointing at the target
  const slewStart = slewEnd + 1.15;
  const reach = Math.hypot(dx, dz);
  const cableEnd = H + 0.25 - BEAM_DROP - (target.y + 0.14 - base.y); // leaves a small gap above the target
  const cableStart = 1.2;

  function update(t, ambient, settled) {
    // rise into view like the building
    clip.constant = lerp(-0.2, H + 6, phase(t, T.crane[0], T.crane[1], ease.outCubic));
    if (t >= T.crane[0] + T.crane[1]) clip.constant = 1000;

    const s = phase(t, T.slew[0], T.slew[1], ease.inOutCubic);
    const tr = phase(t, T.trolley[0], T.trolley[1], ease.inOutCubic);
    const lo = phase(t, T.lower[0], T.lower[1], ease.inOutSine);

    const sway = settled ? 0.022 * Math.sin(ambient * 0.32) : 0;
    top.rotation.y = lerp(slewStart, slewEnd, s) + sway;
    trolley.position.x = lerp(4.5, reach, tr);

    const len = lerp(cableStart, cableEnd, lo);
    for (const c of cables) c.scale.y = len;
    hook.position.y = 0.25 - len;

    // load swing: excited by the moves, dying away, then a faint breeze
    const excite = Math.exp(-Math.max(0, t - (T.lower[0] + T.lower[1])) * 0.8);
    hook.rotation.x = 0.05 * Math.sin(t * 2.1) * excite * Math.min(1, s * 3) + (settled ? 0.006 * Math.sin(ambient * 0.9) : 0);
    hook.rotation.z = 0.03 * Math.sin(t * 1.7 + 1) * excite * Math.min(1, tr * 3);
  }

  return { group, update };
}
