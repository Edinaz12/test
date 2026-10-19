// EZN browser hardware detection. Only standard web APIs, no installs, no extensions.
import { GPUS } from './data.js';

const safe = async (fn, fallback = null) => {
  try { return await fn(); } catch { return fallback; }
};

/** Measure the display refresh rate via requestAnimationFrame (median frame time). */
export function measureRefreshRate(frames = 90) {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') return resolve(null);
    const t = [];
    let last = 0;
    const step = (now) => {
      if (last) t.push(now - last);
      last = now;
      if (t.length < frames) requestAnimationFrame(step);
      else {
        t.sort((a, b) => a - b);
        const med = t[Math.floor(t.length / 2)];
        resolve(med > 0 ? 1000 / med : null);
      }
    };
    requestAnimationFrame(step);
    setTimeout(() => resolve(null), 4000); // background tab: rAF is throttled
  });
}

/** Snap a measured value to the nearest common panel refresh rate. */
export function snapHz(v, common) {
  if (!v) return null;
  let best = common[0];
  for (const c of common) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return Math.abs(best - v) / best < 0.08 ? best : Math.round(v);
}

/** Read the GPU name from WebGL (unmasked renderer when the browser allows it). */
export function webglRenderer() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      masked: !ext,
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    };
  } catch { return null; }
}

/** WebGPU adapter info: gives vendor/architecture/description on supporting browsers. */
export async function webgpuInfo() {
  if (!navigator.gpu) return { supported: false };
  const adapter = await safe(() => navigator.gpu.requestAdapter());
  if (!adapter) return { supported: true, adapter: false };
  let info = adapter.info || null;
  if (!info && adapter.requestAdapterInfo) info = await safe(() => adapter.requestAdapterInfo());
  const lim = adapter.limits || {};
  return {
    supported: true,
    adapter: true,
    vendor: info?.vendor || '',
    architecture: info?.architecture || '',
    device: info?.device || '',
    description: info?.description || '',
    maxBuffer: lim.maxBufferSize || null,
    fallback: !!adapter.isFallbackAdapter,
  };
}

/** Parse the raw renderer string into a plain GPU name candidate. */
export function cleanRenderer(raw) {
  if (!raw) return '';
  let s = String(raw).replace(/\((R|TM)\)|®|™/gi, ''); // strip before parsing: "Radeon(TM)" has a ')' that ends the ANGLE match early
  // ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)
  const m = s.match(/ANGLE \(([^,]*),\s*(.*?)(?:\s+Direct3D|\s+\(0x|\s+OpenGL|,|\))/i);
  if (m) s = m[2];
  return s.replace(/\(R\)|\(TM\)|®|™/gi, '').replace(/\s+/g, ' ').trim();
}

/** Match a renderer string against the GPU database. Returns {gpu, mobile, confidence}. */
export function matchGpu(raw) {
  const s = ' ' + cleanRenderer(raw).toLowerCase().replace(/laptop gpu|mobile|max-q|with max-q design/g, ' ').replace(/\s+/g, ' ') + ' ';
  const mobile = /laptop|mobile|max-q/i.test(raw || '') || /\b\d{4}m\b/.test(s);
  let best = null;
  let bestLen = 0;
  const num = (str) => str.replace(/\s+(super|ti|xt|xtx|gre)\b/g, '$1').replace(/\s+/g, '');
  const target = num(s);
  for (const g of GPUS) {
    for (const t of g.tokens) {
      const tt = num(' ' + t + ' ').trim();
      if (!tt) continue;
      const idx = target.indexOf(tt);
      if (idx < 0) continue;
      // Reject partial numbers: "rtx3060" must not match inside "rtx30605".
      const after = target[idx + tt.length];
      if (after && /[0-9]/.test(after) && /[0-9]$/.test(tt)) continue;
      // Prefer the longest (= most specific) token: "4070ti super" beats "4070".
      const score = tt.length;
      if (score > bestLen) { best = g; bestLen = score; }
    }
  }
  if (!best) return { gpu: null, mobile, confidence: 'none' };
  return { gpu: best, mobile, confidence: 'good' };
}

export async function detect(commonHz) {
  const out = { os: null, arch: null, browser: null, mobileDevice: false };
  const nav = navigator;
  const hzPromise = measureRefreshRate(60); // runs while the other probes await

  // userAgentData (Chromium). High entropy values give platform, architecture, bitness.
  const uad = nav.userAgentData;
  if (uad) {
    out.mobileDevice = !!uad.mobile;
    out.os = uad.platform || null;
    out.browser = (uad.brands || []).filter((b) => !/not.?a.?brand/i.test(b.brand)).map((b) => `${b.brand} ${b.version}`).join(', ') || null;
    const he = await safe(() => uad.getHighEntropyValues(['architecture', 'bitness', 'platformVersion', 'model']));
    if (he) {
      out.arch = [he.architecture, he.bitness && he.bitness + '-bit'].filter(Boolean).join(' ') || null;
      out.platformVersion = he.platformVersion || null;
      if (he.platform === 'Windows' && he.platformVersion) {
        out.os = parseInt(he.platformVersion, 10) >= 13 ? 'Windows 11' : 'Windows 10';
      }
    }
  } else {
    const ua = nav.userAgent || '';
    out.os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : /iPhone|iPad/.test(ua) ? 'iOS' : null;
    out.browser = /Firefox\/([\d.]+)/.test(ua) ? 'Firefox ' + RegExp.$1 : /Version\/([\d.]+).*Safari/.test(ua) ? 'Safari ' + RegExp.$1 : null;
    out.mobileDevice = /Mobi|Android|iPhone|iPad/.test(ua);
  }

  // CPU threads. Browsers may cap or mask this value, so it is only a hint.
  out.threads = nav.hardwareConcurrency || null;

  // RAM. deviceMemory is capped at 8 GB (Chromium) and rounded to a power of two.
  out.deviceMemory = nav.deviceMemory || null;

  // Display
  const dpr = window.devicePixelRatio || 1;
  out.screen = {
    w: Math.round(screen.width * dpr),
    h: Math.round(screen.height * dpr),
    cssW: screen.width, cssH: screen.height, dpr,
    colorDepth: screen.colorDepth,
  };
  // Windows display scaling inflates dpr; a browser zoom also changes it. Report the raw numbers.
  out.hzRaw = null;

  // GPU
  const gl = webglRenderer();
  const gpuApi = await webgpuInfo();
  out.webgl = gl;
  out.webgpu = gpuApi;

  const candidates = [];
  if (gl?.renderer && !gl.masked) candidates.push(gl.renderer);
  if (gpuApi?.description) candidates.push(gpuApi.description);
  if (gpuApi?.device) candidates.push(gpuApi.device);
  if (gl?.renderer && gl.masked) candidates.push(gl.renderer);
  let m = { gpu: null, mobile: false, confidence: 'none' };
  for (const c of candidates) {
    const r = matchGpu(c);
    if (r.gpu) { m = r; break; }
    if (r.mobile) m.mobile = true;
  }
  out.gpuRaw = candidates[0] ? cleanRenderer(candidates[0]) : null;
  out.gpuMatch = m.gpu;
  out.gpuMobile = m.mobile;
  out.gpuSoftware = /swiftshader|llvmpipe|software|basic render/i.test(candidates.join(' '));

  const hzRaw = await hzPromise;
  out.hzRaw = hzRaw;
  out.hz = snapHz(hzRaw, commonHz);

  // Not detectable in any browser: CPU model, RAM kit, storage type. Those stay as selections.
  return out;
}
