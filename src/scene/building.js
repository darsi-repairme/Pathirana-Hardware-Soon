import * as THREE from 'three';
import { boxFromExtents, mergeEdges, ghostBox, segments, setDrawFraction, canvasTexture } from './util.js';
import { T, phase, ease, lerp, clamp01 } from './timeline.js';

/*
 * Original procedural two-storey modern house (metres).
 * Blueprint -> reality: an edge wireframe draws first, then a rising clipping
 * plane reveals the real materials from the ground up. A "future" third floor
 * and side wing stay as glowing blueprint lines, ready for the crane's beam.
 */

const TOP = 7.1; // highest solid point (roof + starter bars)

export function createBuilding({ shadows }) {
  const group = new THREE.Group();
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); // shows y < constant

  // ---------- Materials ----------
  const woodTex = canvasTexture(256, (g, s) => {
    g.fillStyle = '#8f5531'; g.fillRect(0, 0, s, s);
    const boards = 8;
    for (let i = 0; i < boards; i++) {
      const x = (i / boards) * s;
      const l = 40 + ((i * 37) % 17);
      g.fillStyle = `hsl(24, 48%, ${l}%)`;
      g.fillRect(x, 0, s / boards - 2, s);
      g.globalAlpha = 0.18;
      for (let k = 0; k < 14; k++) {
        g.fillStyle = k % 2 ? '#5e3519' : '#b97a4c';
        g.fillRect(x + ((k * 7 + i * 3) % (s / boards - 4)), 0, 1.4, s);
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(30,15,5,.55)';
      g.fillRect(x + s / boards - 2, 0, 2, s);
    }
  });

  const common = { clippingPlanes: [clip], clipShadows: true };
  const M = {
    render: new THREE.MeshStandardMaterial({ color: 0xeeece4, roughness: 0.82, ...common }),
    plinth: new THREE.MeshStandardMaterial({ color: 0x8b8a82, roughness: 0.95, ...common }),
    wood: new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTex, roughness: 0.6, ...common }),
    door: new THREE.MeshStandardMaterial({ color: 0x4a2a17, roughness: 0.5, ...common }),
    frame: new THREE.MeshStandardMaterial({ color: 0x232625, roughness: 0.35, metalness: 0.7, ...common }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0e2f2d, roughness: 0.04, metalness: 0.35, transparent: true, opacity: 0.32,
      envMapIntensity: 2.2, ...common,
    }),
    rail: new THREE.MeshStandardMaterial({
      color: 0x9fd8cf, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.22, depthWrite: false, ...common,
    }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc99a2e, roughness: 0.28, metalness: 1, ...common }),
    glow: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa040, emissiveIntensity: 0, roughness: 1, ...common }),
    led: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd27a, emissiveIntensity: 0, ...common }),
    steel: new THREE.MeshStandardMaterial({ color: 0x4b4038, roughness: 0.6, metalness: 0.8, ...common }),
  };

  const solids = [];
  const add = (x0, x1, y0, y1, z0, z1, mat, { cast = true } = {}) => {
    const m = boxFromExtents(x0, x1, y0, y1, z0, z1, mat);
    m.castShadow = shadows && cast;
    m.receiveShadow = shadows;
    group.add(m);
    solids.push(m);
    return m;
  };

  // ---------- Ground floor (y 0.35 – 3.35) ----------
  add(-4.6, 4.6, 0, 0.35, -3.6, 3.6, M.plinth);                 // plinth
  add(1.4, 2.9, 0, 0.12, 3.6, 4.25, M.plinth);                  // step
  add(-4.2, 4.2, 0.35, 3.35, -3.2, -2.95, M.render);            // back wall
  add(-4.2, -3.95, 0.35, 3.35, -3.2, 2.75, M.render);           // left wall
  add(3.95, 4.2, 0.35, 3.35, -3.2, 2.75, M.render);             // right wall
  add(-4.35, -3.9, 0.35, 3.35, 2.65, 3.1, M.render);            // corner column L
  add(3.9, 4.35, 0.35, 3.35, 2.65, 3.1, M.render);              // corner column R
  add(-0.18, 0.18, 0.35, 3.35, 2.65, 3.08, M.render);           // centre column
  // living-room glazing + frame
  add(-3.9, -0.18, 0.4, 3.3, 2.84, 2.9, M.glass, { cast: false });
  add(-3.9, -0.18, 0.35, 0.45, 2.8, 2.95, M.frame);
  add(-3.9, -0.18, 3.25, 3.35, 2.8, 2.95, M.frame);
  add(-2.08, -2.0, 0.35, 3.35, 2.8, 2.95, M.frame);
  add(-3.85, -0.25, 0.4, 3.3, 2.2, 2.25, M.glow, { cast: false }); // warm interior
  // timber-clad entrance wall with recessed door and slot window
  add(0.18, 1.6, 0.35, 3.35, 2.7, 2.98, M.wood);
  add(1.6, 2.7, 2.55, 3.35, 2.7, 2.98, M.wood);
  add(1.65, 2.65, 0.35, 2.55, 2.55, 2.62, M.door);
  add(2.42, 2.48, 1.2, 1.6, 2.62, 2.7, M.gold);                 // door handle
  add(2.7, 3.9, 0.35, 1.0, 2.7, 2.98, M.wood);
  add(2.7, 3.9, 3.05, 3.35, 2.7, 2.98, M.wood);
  add(2.75, 3.85, 1.0, 3.05, 2.84, 2.9, M.glass, { cast: false });
  add(2.75, 3.85, 1.05, 3.0, 2.3, 2.35, M.glow, { cast: false });

  // ---------- First-floor slab with balcony cantilever ----------
  add(-5.4, 4.5, 3.35, 3.72, -3.5, 4.4, M.render);
  add(-5.4, 4.5, 3.35, 3.42, 4.4, 4.46, M.gold, { cast: false }); // brass edge trim

  // ---------- Upper floor (y 3.72 – 6.6) ----------
  add(-5.0, 3.6, 3.72, 6.6, -3.2, -2.95, M.render);             // back wall
  add(3.35, 3.6, 3.72, 6.6, -3.2, 2.6, M.render);               // right wall
  // left wall with tall window
  add(-5.0, -4.75, 3.72, 6.6, -3.2, -1.0, M.render);
  add(-5.0, -4.75, 3.72, 6.6, 1.8, 2.6, M.render);
  add(-5.0, -4.75, 3.72, 4.3, -1.0, 1.8, M.render);
  add(-5.0, -4.75, 6.0, 6.6, -1.0, 1.8, M.render);
  add(-4.92, -4.86, 4.3, 6.0, -1.0, 1.8, M.glass, { cast: false });
  add(-4.6, -4.55, 4.35, 5.95, -0.95, 1.75, M.glow, { cast: false });
  // front glazing with mullions
  add(-4.75, 0.8, 3.72, 6.6, 2.42, 2.48, M.glass, { cast: false });
  for (const x of [-4.75, -2.9, -1.05, 0.74]) add(x, x + 0.08, 3.72, 6.6, 2.38, 2.52, M.frame);
  add(-4.75, 0.8, 6.5, 6.6, 2.38, 2.52, M.frame);
  add(-4.65, 0.7, 3.8, 6.5, 1.9, 1.95, M.glow, { cast: false });
  add(0.8, 3.6, 3.72, 6.6, 2.35, 2.6, M.wood);                  // timber feature panel
  // balcony glass railing
  add(-5.2, 0.9, 3.72, 4.75, 4.22, 4.27, M.rail, { cast: false });
  add(-5.2, 0.9, 4.75, 4.81, 4.2, 4.3, M.frame);
  for (const x of [-5.2, -2.2, 0.84]) add(x, x + 0.06, 3.72, 4.75, 4.2, 4.3, M.frame);
  // slender steel columns under the cantilever
  add(-5.25, -5.1, 0.35, 3.35, 4.1, 4.25, M.frame);
  add(4.3, 4.45, 0.35, 3.35, 4.1, 4.25, M.frame);

  // ---------- Roof ----------
  add(-5.7, 4.0, 6.6, 6.92, -3.6, 3.2, M.render);
  add(-5.7, 4.0, 6.54, 6.6, 3.1, 3.16, M.led, { cast: false });  // warm LED soffit line
  // starter bars sticking out of the roof: the next floor is coming
  const barGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6);
  for (const [x, z] of [[-3.6, -2.6], [-0.6, -2.6], [2.4, -2.6], [-3.6, 2.2], [-0.6, 2.2], [2.4, 2.2]]) {
    for (const dx of [-0.08, 0.08]) {
      const b = new THREE.Mesh(barGeo, M.steel);
      b.position.set(x + dx, 6.92 + 0.45, z);
      b.castShadow = shadows;
      group.add(b);
      solids.push(b);
    }
  }

  // ---------- Blueprint wireframe of the solid house ----------
  const wireMat = new THREE.LineBasicMaterial({
    color: 0xd8fff0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const wire = new THREE.LineSegments(mergeEdges(solids), wireMat);
  wire.renderOrder = 2;
  group.add(wire);

  // ---------- Future construction: third floor + side wing (lines only) ----------
  const ghosts = [
    ghostBox(-3.6, 2.4, 6.92, 9.6, -2.6, 2.2),            // third-floor volume
    ghostBox(-3.9, 2.7, 9.6, 9.9, -2.9, 2.5),             // its roof slab
    ghostBox(-10.4, -5.4, 0, 0.35, -3.0, 2.6),            // wing plinth
    ghostBox(-10.2, -5.4, 0.35, 3.35, -2.8, 2.4),         // wing volume
    ghostBox(-10.5, -5.4, 3.35, 3.65, -3.0, 2.7),         // wing roof slab
    ghostBox(-9.4, -6.2, 0.6, 3.0, 2.38, 2.42),           // wing window opening
  ];
  const ghostGeo = mergeEdges(ghosts);
  // extra structural lines: columns and floor-level lines of the new floor
  const extra = [];
  for (const x of [-3.6, -0.6, 2.4]) for (const z of [-2.6, 2.2]) extra.push([x, 6.92, z], [x, 9.6, z]);
  for (const x of [-10.2, -7.8, -5.4]) extra.push([x, 0.35, 2.4], [x, 3.35, 2.4]);
  extra.push([-3.6, 8.25, 2.2], [2.4, 8.25, 2.2], [-10.2, 1.85, 2.4], [-5.4, 1.85, 2.4]);
  const extraGeo = segments(extra);
  const ghostMat = new THREE.LineBasicMaterial({
    color: 0xbff7e6, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const ghost = new THREE.LineSegments(ghostGeo, ghostMat);
  const ghostExtra = new THREE.LineSegments(extraGeo, ghostMat);
  ghost.renderOrder = ghostExtra.renderOrder = 2;
  group.add(ghost, ghostExtra);
  ghosts.forEach((g) => g.geometry.dispose());

  // ---------- Gold scan ring that rides the rising build plane ----------
  const ringGeo = segments([
    [-5.9, 0, -3.9], [4.8, 0, -3.9], [4.8, 0, -3.9], [4.8, 0, 4.7],
    [4.8, 0, 4.7], [-5.9, 0, 4.7], [-5.9, 0, 4.7], [-5.9, 0, -3.9],
  ]);
  const ringMat = new THREE.LineBasicMaterial({
    color: 0xffd36b, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.LineSegments(ringGeo, ringMat);
  ring.renderOrder = 3;
  group.add(ring);

  /** Drives the building for timeline time t (seconds). */
  function update(t, ambient) {
    const w = phase(t, T.wire[0], T.wire[1], ease.inOutSine);
    const s = phase(t, T.solid[0], T.solid[1], ease.inOutCubic);
    const l = phase(t, T.light[0], T.light[1], ease.inOutSine);

    setDrawFraction(wire, w);
    setDrawFraction(ghost, w);
    setDrawFraction(ghostExtra, phase(t, T.wire[0] + 0.6, T.wire[1], ease.inOutSine));

    // wireframe bright while drawing, then recedes once materials appear
    wireMat.opacity = w > 0 ? lerp(0.85, 0.1, s) : 0;
    ghostMat.opacity = clamp01(w * 1.2) * (0.55 + 0.12 * Math.sin(ambient * 1.4));

    // rising clip plane: solid materials reveal bottom-up
    const h = s >= 1 ? 1000 : lerp(-0.05, TOP + 0.1, s);
    clip.constant = h;
    ring.position.y = Math.min(h, TOP);
    ringMat.opacity = s > 0 && s < 1 ? Math.sin(s * Math.PI) * 0.95 : 0;

    // interior lights & LED soffit warm up with the final lighting
    M.glow.emissiveIntensity = l * (3.2 + 0.12 * Math.sin(ambient * 0.9));
    M.led.emissiveIntensity = l * 2.2;
  }

  return {
    group,
    update,
    beamTarget: new THREE.Vector3(-0.6, 9.9, -0.2), // top of the future floor
  };
}
