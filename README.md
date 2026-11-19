# Pathirana Hardware — Coming Soon website

This is a standalone, static Coming Soon page for **pathiranahardware.lk**. It is built with **Vite + Three.js (WebGL) + vanilla JavaScript**. There is no backend, API, database or authentication.

It is independent of `Pathirana-Hardware-Web`, `-Admin` and `-Backend`. The logo files were **copied** from the Customer Website's approved assets, and the logo artwork is unchanged.

## Commands

```bash
npm ci            # install exact dependency versions
npm run dev       # development server  → http://localhost:5173
npm run build     # production build    → dist/
npm run preview   # serve dist/ locally → http://localhost:4173
```

Node 20.19+ is required (tested with Node 24).

## Project structure

```
index.html                  Page markup: header, hero copy, CTAs, contact details, footer
src/main.js                 Entry point: fonts, WebGL detection, lazy-loads the 3D scene, fallback
src/styles/main.css         All styling, responsive layout and text animations
src/scene/Scene.js          Renderer, camera choreography, lights, render loop, pause/resize, cleanup
src/scene/building.js       Procedural modern house, and the blueprint-to-solid transition
src/scene/crane.js          Procedural tower crane, slewing, trolley, hoist and beam animation
src/scene/supplies.js       Bricks, hollow blocks, steel pipes, rebar, roofing sheets, sand
src/scene/blueprint.js      Shader blueprint grid and gold construction guidelines
src/scene/timeline.js       Opening-sequence timings and easing
src/scene/quality.js        Device tier detection and adaptive pixel ratio
src/scene/util.js           Geometry helpers (edge merging, procedural textures)
public/                     Logo, favicons, share image, static fallback still, robots and sitemap
vercel.json                 Vercel build settings and security/caching headers
_archive/v1-svg-static/     The earlier SVG version (kept for reference; not built or deployed)
```

## How the 3D scene works

- **Everything is original procedural geometry.** No third-party models, HDRIs or texture downloads are used. Wood, brick and concrete textures are drawn at runtime on small canvases.
- **Blueprint to reality:**
  1. The building's edges are merged into one line mesh, which draws bottom-up.
  2. A rising clipping plane then reveals the real materials, with a gold scan line riding on it.
  3. A future third floor and a side wing stay as glowing blueprint lines.
- **Crane:** it rises into view, slews to the work position, runs the trolley out and lowers a steel I-beam onto the future floor. After that it holds a gentle sway.
- **Performance:**
  - Three.js loads as a separate chunk after the text has painted.
  - The pixel ratio is capped (2 on desktop, 1.5 on lower-end devices) and steps down automatically if frames are slow.
  - Repeated parts use instancing.
  - Once the intro ends, shadows refresh only occasionally and lower-end devices drop to 30 fps.
  - Rendering pauses when the tab is hidden or the scene is scrolled off-screen.
  - All GPU resources are released on `pagehide`.
- **Accessibility and fallbacks:**
  - All text and links are plain HTML; the canvas is decorative (`aria-hidden`).
  - With `prefers-reduced-motion`, the finished scene is drawn once with no loop.
  - Without WebGL, or if the GPU context is lost, a still image of the scene is shown instead.

## Debug aid

When the URL contains `?debug`, `?debug&t=3.2` freezes the opening sequence at 3.2 seconds, which is useful for reviewing individual phases. It has no effect for normal visitors.

## Business details used

These are the only business details on the page:

- Pathirana Hardware
- Pallama Road, Bangadeniya, Sri Lanka
- +94 71 225 9699 (`tel:+94712259699`)
- WhatsApp `https://wa.me/94712259699`
- Tagline: "Shop smarter, save bigger!"
