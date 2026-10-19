# EZN

Browser-only PC analysis and upgrade advisor. Opens straight on the dashboard, detects what a website can detect,
asks only for the rest, and answers one question: **what should I upgrade first?**

No backend, no install, no extension, no sign-up. Plain HTML, CSS and ES modules. The only build step is
`node build.mjs`, which copies `src/` to `dist/` and writes `dist/config.js` from environment variables.

## Deploy

| Host | Build command | Output directory |
|---|---|---|
| Vercel | `node build.mjs` | `dist` (set in `vercel.json`) |
| Netlify | `node build.mjs` | `dist` (set in `netlify.toml`) |
| Cloudflare Pages | `node build.mjs` | `dist` (enter in the dashboard) |

Set the shop variables below in the host's dashboard, then redeploy. Local preview: `npm run dev`
(ES modules do not load from `file://`, a local server is required).

## Shop links (environment variables)

Each `EZN_<SHOP>_URL` is a template. `{q}` is replaced with the product name. Set a value to `off` to hide a shop.

| Variable | Default |
|---|---|
| `EZN_AMAZON_URL` | `https://www.amazon.de/s?k={q}` |
| `EZN_AMAZON_TAG` | appended as `&tag=...` |
| `EZN_GALAXUS_URL` | `https://www.galaxus.ch/de/search?q={q}` |
| `EZN_DIGITEC_URL` | `https://www.digitec.ch/de/search?q={q}` |
| `EZN_BRACK_URL` | `https://www.brack.ch/search?query={q}` |
| `EZN_<SHOP>_PARAMS` | extra query string, e.g. `partner=abc` |

The defaults are plain search links. Check the Galaxus, Digitec and Brack URLs against your affiliate program;
networks usually give you the exact deep-link format. Copy `.env.example` to `.env` for local builds.
Affiliate links need a disclosure; the footer already contains one.

## What is detected, what is asked

| Detected (when the browser allows) | Asked (dropdown, preselected where possible) |
|---|---|
| GPU via WebGL and WebGPU, logical threads, screen size, refresh rate (measured), OS, architecture, browser | CPU model, RAM size / modules / type, storage type |

Browsers cannot read the CPU model, RAM kit or drive type. The CPU list is sorted so models that match the reported
thread count come first. `deviceMemory` is capped at 8 GB by browsers, so RAM is assumed (16 GB, dual channel) until
you change it; assumptions are labelled "Assumed" in the Source column. Firefox and Safari hide more than Chromium.

## How the numbers are made

Honest limits: **estimates, not benchmarks.** Every CPU and GPU has a relative performance index and every game a
CPU ceiling and GPU curve (`src/data.js`). `src/engine.js` blends the CPU and GPU limits, then adjusts for resolution,
VRAM, RAM capacity, single-channel memory and hard disks. Upgrade value counts FPS only up to your display's refresh rate.
CPU/GPU load values are modelled, not measured. Prices are rough CHF reference values.

Update the hardware list and prices in `src/data.js`. Run `npm test` after changes.

## Files

- `src/data.js` hardware, games, prices
- `src/engine.js` estimation, upgrade ranking, explanations
- `src/detect.js` browser detection and GPU name matching
- `src/app.js`, `index.html`, `style.css` the dashboard
- `build.mjs` env-driven config; `test/engine.test.mjs` tests
