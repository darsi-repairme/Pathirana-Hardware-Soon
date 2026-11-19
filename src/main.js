// Fonts are self-hosted (bundled by Vite) — no third-party requests at runtime.
import '@fontsource-variable/montserrat/wght.css';
import '@fontsource/kaushan-script/latin-400.css';
import './styles/main.css';
import { detectQuality } from './scene/quality.js';

const root = document.documentElement;

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

function supportsWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

function showFallback() {
  root.classList.remove('webgl-ready');
  root.classList.add('no-webgl');
}

const canvas = document.querySelector('.scene__canvas');
if (!canvas || !supportsWebGL2()) {
  showFallback();
} else {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The 3D code (and three.js) is a separate chunk, so the text and buttons paint first.
  import('./scene/Scene.js')
    .then(({ createScene }) => {
      const scene = createScene(canvas, {
        quality: detectQuality(),
        reducedMotion,
        onFirstFrame: () => root.classList.add('webgl-ready'),
        onContextLost: showFallback,
      });
      window.addEventListener('pagehide', (e) => { if (!e.persisted) scene.dispose(); });
    })
    .catch((err) => {
      console.warn('3D scene unavailable, showing still image.', err);
      showFallback();
    });
}
