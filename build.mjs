// EZN build: copies src/ to dist/ and generates dist/config.js from environment variables.
// No dependencies. Works on Vercel, Netlify and Cloudflare Pages (build command: node build.mjs, output: dist).
import { mkdirSync, readdirSync, copyFileSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

// Optional local .env (never committed). Real environment variables win.
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/i, '').replace(/["']$/, '');
  }
}

const DEFAULTS = {
  amazon: 'https://www.amazon.de/s?k={q}',
  galaxus: 'https://www.galaxus.ch/de/search?q={q}',
  digitec: 'https://www.digitec.ch/de/search?q={q}',
  brack: 'https://www.brack.ch/search?query={q}',
};

function shopTemplate(key) {
  const raw = process.env[`EZN_${key.toUpperCase()}_URL`];
  let t = raw === undefined || raw === '' ? DEFAULTS[key] : raw;
  if (/^(off|none|false|0)$/i.test(t)) return '';
  if (key === 'amazon') {
    const tag = process.env.EZN_AMAZON_TAG;
    if (tag && !/[?&]tag=/.test(t)) t += (t.includes('?') ? '&' : '?') + 'tag=' + encodeURIComponent(tag);
  }
  const extra = process.env[`EZN_${key.toUpperCase()}_PARAMS`]; // e.g. "partner=abc&campaign=ezn"
  if (extra) t += (t.includes('?') ? '&' : '?') + extra.replace(/^[?&]/, '');
  if (!t.includes('{q}')) {
    console.warn(`[ezn] EZN_${key.toUpperCase()}_URL has no {q} placeholder - links will not contain the product name.`);
  }
  return t;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const f of readdirSync(src)) copyFileSync(join(src, f), join(dist, f));

const cfg = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, shopTemplate(k)]));
writeFileSync(join(dist, 'config.js'), `window.EZN_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);

// Security headers for Netlify and Cloudflare Pages (Vercel reads vercel.json instead).
writeFileSync(join(dist, '_headers'), `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`);

console.log('[ezn] built to dist/ with shops:', Object.entries(cfg).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none');
