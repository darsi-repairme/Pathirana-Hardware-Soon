import * as THREE from 'three';
import { segments, setDrawFraction } from './util.js';
import { T, phase, ease } from './timeline.js';

/*
 * Blueprint layer: an analytic (shader) ground grid that reveals outward from
 * the site, plus gold construction guidelines (setting-out lines, level lines,
 * dimension lines) that draw themselves into view.
 */

export function createBlueprint() {
  const group = new THREE.Group();

  // ---------- Ground grid (no textures; anti-aliased with fwidth) ----------
  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uReveal: { value: 0 },
      uMinor: { value: new THREE.Color(0x9fe8cf) },
      uMajor: { value: new THREE.Color(0xe9c25a) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uReveal;
      uniform vec3 uMinor;
      uniform vec3 uMajor;
      uniform float uOpacity;
      varying vec2 vXZ;
      float gridLine(vec2 p, float step) {
        vec2 g = abs(fract(p / step - 0.5) - 0.5) / fwidth(p / step);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }
      void main() {
        vec2 c = vXZ - vec2(-1.0, 1.5);
        float d = length(c);
        float minor = gridLine(vXZ, 1.0) * 0.35;
        float major = gridLine(vXZ, 5.0);
        float fade = smoothstep(26.0, 6.0, d);
        float front = smoothstep(uReveal, uReveal - 4.0, d);
        float edgeGlow = smoothstep(3.0, 0.0, abs(d - uReveal)) * step(0.01, uReveal) * (1.0 - step(39.0, uReveal));
        vec3 col = mix(uMinor, uMajor, major);
        float a = max(minor, major * 0.7) * fade * front * 0.42 + edgeGlow * fade * 0.12;
        gl_FragColor = vec4(col + edgeGlow * 0.3, a * uOpacity);
      }`,
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0.012;
  grid.renderOrder = 1;
  group.add(grid);

  // ---------- Gold construction guidelines ----------
  const pts = [];
  // setting-out verticals at the building corners and crane-side
  for (const [x, z] of [[-4.6, 3.6], [4.6, 3.6], [-5.7, -3.6], [4.6, -3.6], [-10.4, 2.6]]) pts.push([x, 0, z], [x, 11.5, z]);
  // level lines (floor & roof levels) carried across the façade
  for (const y of [3.35, 6.6, 9.6]) pts.push([-12.5, y, 4.5], [6.5, y, 4.5]);
  // dimension line in front of the house with ticks
  const dz = 5.4;
  pts.push([-10.4, 0.02, dz], [4.6, 0.02, dz]);
  for (const x of [-10.4, -5.4, -4.6, 0, 4.6]) pts.push([x, 0.02, dz - 0.35], [x, 0.02, dz + 0.35]);
  // side dimension
  pts.push([5.6, 0.02, -3.6], [5.6, 0.02, 3.6], [5.25, 0.02, -3.6], [5.95, 0.02, -3.6], [5.25, 0.02, 3.6], [5.95, 0.02, 3.6]);
  // diagonal setting-out on the slab
  pts.push([-4.6, 0.37, -3.6], [4.6, 0.37, 3.6], [-4.6, 0.37, 3.6], [4.6, 0.37, -3.6]);

  const guideMat = new THREE.LineBasicMaterial({
    color: 0xf2c94c, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const guides = new THREE.LineSegments(segments(pts), guideMat);
  guides.renderOrder = 2;
  group.add(guides);

  function update(t, ambient) {
    gridMat.uniforms.uReveal.value = phase(t, T.grid[0], T.grid[1] + 1.4, ease.outCubic) * 40;
    setDrawFraction(guides, phase(t, T.guides[0], T.guides[1], ease.inOutSine));
    // guidelines step back once the real building is standing
    const settle = phase(t, T.solid[0] + 1.2, 1.6, ease.inOutSine);
    guideMat.opacity = 0.85 - settle * 0.6 + (t > T.END ? 0.05 * Math.sin(ambient * 0.8) : 0);
  }

  return { group, update };
}
