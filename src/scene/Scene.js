import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { T, phase, ease, lerp } from './timeline.js';
import { AdaptiveDpr } from './quality.js';
import { canvasTexture } from './util.js';
import { createBuilding } from './building.js';
import { createCrane } from './crane.js';
import { createSupplies } from './supplies.js';
import { createBlueprint } from './blueprint.js';

/**
 * Builds and runs the hero 3D scene.
 * Returns { dispose } — call it to free every GPU resource.
 */
export function createScene(canvas, { quality, reducedMotion, onFirstFrame, onContextLost }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;

  let dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b3a28, 42, 100);

  // Image-based reflections without downloading an HDR
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.45;
  room.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 220);

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xd6efe4, 0x0a3220, 0.3);
  const key = new THREE.DirectionalLight(0xffd6a6, 0.4);
  key.position.set(14, 19, 13);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  Object.assign(key.shadow.camera, { left: -17, right: 17, top: 17, bottom: -12, near: 1, far: 70 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  const rim = new THREE.DirectionalLight(0xff9a4a, 0.5);
  rim.position.set(12, 6, -18);
  const fill = new THREE.DirectionalLight(0x8fd3c4, 0.45);
  fill.position.set(-18, 9, 6);
  const porch = new THREE.PointLight(0xffb366, 0, 11, 2);
  porch.position.set(1.4, 2.8, 4.4);
  scene.add(hemi, key, key.target, rim, fill, porch);

  // ---------- Ground: soft site pad fading into the background ----------
  const padAlpha = canvasTexture(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, '#fff'); r.addColorStop(0.55, '#bbb'); r.addColorStop(1, '#000');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }, { srgb: false });
  padAlpha.wrapS = padAlpha.wrapT = THREE.ClampToEdgeWrapping;
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(19, 48),
    new THREE.MeshStandardMaterial({ color: 0x1c4434, roughness: 1, transparent: true, alphaMap: padAlpha, depthWrite: false }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0, 1.5);
  pad.receiveShadow = true;
  scene.add(pad);

  // ---------- Content ----------
  const shadows = true;
  const blueprint = createBlueprint();
  const building = createBuilding({ shadows });
  const crane = createCrane({ base: new THREE.Vector3(10.5, 0, -7.5), target: building.beamTarget, shadows });
  const supplies = createSupplies({ shadows, tier: quality.tier });
  scene.add(blueprint.group, building.group, crane.group, supplies.group);

  // ---------- Camera choreography ----------
  const finalTarget = new THREE.Vector3(1.8, 7.1, 1.2);
  const startTarget = new THREE.Vector3(0, 4.2, 0);
  const view = { az: 0.42, el: 0.13, dist: 35.5 };
  const start = { az: 0.95, el: 0.42, dist: 46 };
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  const tmpTarget = new THREE.Vector3();
  let distScale = 1;

  function placeCamera(t) {
    const p = phase(t, T.camera[0], T.camera[1], ease.inOutCubic);
    const az = lerp(start.az, view.az, p) + parallax.x * 0.05;
    const el = lerp(start.el, view.el, p) + parallax.y * 0.025;
    const d = lerp(start.dist, view.dist, p) * distScale;
    tmpTarget.lerpVectors(startTarget, finalTarget, p);
    camera.position.set(
      tmpTarget.x - Math.sin(az) * Math.cos(el) * d,
      tmpTarget.y + Math.sin(el) * d,
      tmpTarget.z + Math.cos(az) * Math.cos(el) * d,
    );
    camera.lookAt(tmpTarget);
  }

  // ---------- Sizing ----------
  const container = canvas.parentElement;
  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole composition in frame on narrow canvases
    distScale = camera.aspect < 1.05 ? Math.pow(1.05 / camera.aspect, 0.85) : 1;
    camera.updateProjectionMatrix();
    if (!running) renderFrame();
  }
  const ro = new ResizeObserver(resize);

  // ---------- Pointer parallax (desktop only) ----------
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointer = (e) => {
    parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (finePointer && !reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });

  // ---------- Update & render ----------
  const debug = import.meta.env.DEV || location.search.includes('debug');
  const frozen = debug ? parseFloat(new URLSearchParams(location.search).get('t')) : NaN;
  let t = reducedMotion ? T.END : Number.isFinite(frozen) ? frozen : 0;
  let ambient = 0;
  let shadowTick = 0;
  let first = true;

  function update() {
    const settled = t >= T.END;
    blueprint.update(t, ambient);
    building.update(t, ambient);
    crane.update(t, ambient, settled && !reducedMotion);
    supplies.update(t);

    const l = phase(t, T.light[0], T.light[1], ease.inOutSine);
    const breathe = settled && !reducedMotion ? Math.sin(ambient * 0.45) : 0;
    hemi.intensity = lerp(0.3, 0.75, l);
    key.intensity = lerp(0.4, 2.3, l) * (1 + 0.04 * breathe);
    rim.intensity = lerp(0.5, 3.0, l) * (1 - 0.05 * breathe);
    porch.intensity = lerp(0, 7, l);
    renderer.toneMappingExposure = lerp(0.72, 1.0, l);

    parallax.x += (parallax.tx - parallax.x) * 0.05;
    parallax.y += (parallax.ty - parallax.y) * 0.05;
    placeCamera(t);
  }

  function renderFrame() {
    update();
    renderer.render(scene, camera);
    if (first) { first = false; onFirstFrame?.(); }
  }

  // ---------- Loop with pause / throttle / adaptive resolution ----------
  const adaptive = new AdaptiveDpr(dpr, quality.minDpr, (next) => {
    dpr = next;
    renderer.setPixelRatio(dpr);
    resize();
  });
  let running = false;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let visible = true;
  let inView = true;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const settled = t >= T.END;
    if (settled && quality.ambientFps < 60) {
      acc += dt;
      if (acc < 1 / quality.ambientFps - 0.002) return;
      acc = 0;
    }
    if (!settled && !Number.isFinite(frozen)) t = Math.min(T.END, t + dt);
    ambient += settled ? dt : 0;

    // Once the scene is still, refresh shadows only occasionally
    if (settled) {
      renderer.shadowMap.autoUpdate = false;
      if (++shadowTick % 20 === 0) renderer.shadowMap.needsUpdate = true;
    }
    renderFrame();
    adaptive.sample(dt);
  }

  function setRunning() {
    const should = visible && inView && !reducedMotion;
    if (should && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  const onVisibility = () => { visible = !document.hidden; setRunning(); };
  document.addEventListener('visibilitychange', onVisibility);
  const io = new IntersectionObserver((entries) => {
    inView = entries[0]?.isIntersecting ?? true;
    setRunning();
  });

  const onLost = (e) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
    onContextLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  resize();
  ro.observe(container);
  io.observe(container);
  if (reducedMotion) renderFrame();
  setRunning();

  // Read-only hook for automated checks (?debug in the URL)
  if (debug) {
    window.__phwScene = {
      get time() { return t; },
      get settled() { return t >= T.END; },
      get running() { return running; },
      get dpr() { return dpr; },
      get drawCalls() { return renderer.info.render.calls; },
      get triangles() { return renderer.info.render.triangles; },
      _internals: { renderer, scene, camera },
    };
  }

  function dispose() {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('webglcontextlost', onLost);
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose();
      }
      if (o.isInstancedMesh) o.dispose();
    });
    envTex.dispose();
    key.shadow.map?.dispose();
    renderer.dispose();
  }

  return { dispose };
}
