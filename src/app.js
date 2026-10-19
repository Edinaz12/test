// EZN - UI. Opens on the dashboard, runs detection immediately, renders results.
import { CPUS, GPUS, GAMES, PRESETS, COMMON_HZ, SOCKET_RAM } from './data.js';
import { detect } from './detect.js';
import { presetTable, buildUpgrades, analysis, estimate, fps, chf } from './engine.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CFG = window.EZN_CONFIG || {};
const SHOPS = [['amazon', 'Amazon'], ['galaxus', 'Galaxus'], ['digitec', 'Digitec'], ['brack', 'Brack']];
const STORE_KEY = 'ezn.v1';
const RES_LABEL = { 1080: '1080p (1920x1080)', 1440: '1440p (2560x1440)', 2160: '4K (3840x2160)' };
const RAM_SIZES = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128];
const STORAGE = [['nvme', 'NVMe SSD'], ['ssd', 'SATA SSD'], ['hdd', 'Hard disk (HDD)']];

const S = { det: null, user: loadUser(), t0: performance.now() };

function loadUser() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveUser() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S.user)); } catch { /* storage blocked: fine */ }
}

/* ---------- derive the effective system: user choice > detection > assumption ---------- */
function effective() {
  const u = S.user;
  const d = S.det || {};
  const e = { src: {}, assumed: [] };

  e.cpu = CPUS.find((c) => c.id === u.cpuId) || null;
  e.src.cpu = e.cpu ? 'sel' : 'none';

  const ug = GPUS.find((g) => g.id === u.gpuId);
  if (ug) { e.gpu = ug; e.src.gpu = 'sel'; }
  else if (d.gpuMatch) { e.gpu = d.gpuMatch; e.src.gpu = 'det'; }
  else { e.gpu = null; e.src.gpu = 'none'; }
  e.laptop = u.laptop ?? (u.gpuId ? false : d.gpuMobile) ?? false;

  if (u.ramGb) { e.ramGb = u.ramGb; e.src.ram = 'sel'; }
  else if (d.deviceMemory && d.deviceMemory < 8) { e.ramGb = d.deviceMemory; e.src.ram = 'det'; }
  else { e.ramGb = 16; e.src.ram = 'ass'; }
  e.ramSticks = u.ramSticks ?? 2;
  if (!u.ramSticks) e.assumed.push('dual channel');
  const inferred = e.cpu ? (SOCKET_RAM[e.cpu.socket] || ['DDR4'])[0] : 'DDR4';
  e.ramType = u.ramType || inferred;
  if (!u.ramType) e.assumed.push(inferred);

  e.storage = u.storage || 'ssd';
  e.src.storage = u.storage ? 'sel' : 'ass';

  e.hz = u.hz || d.hz || 60;
  e.src.hz = u.hz ? 'sel' : d.hz ? 'det' : 'ass';

  const h = d.screen?.h || 1080;
  const autoRes = h >= 2000 ? 2160 : h >= 1300 ? 1440 : 1080;
  e.res = u.res || autoRes;
  e.src.res = u.res ? 'sel' : d.screen ? 'det' : 'ass';

  e.game = GAMES.find((g) => g.id === u.game) || GAMES[0];
  e.preset = Number.isInteger(u.preset) ? u.preset : 1;

  e.sys = e.cpu && e.gpu ? {
    cpu: e.cpu, gpu: e.gpu, gpuMobile: e.laptop,
    ramGb: e.ramGb, ramSticks: e.ramSticks, ramType: e.ramType, storage: e.storage,
  } : null;
  return e;
}

/* ---------- small html helpers ---------- */
const SRC = { det: ['Detected', 'src-det'], sel: ['Selected', 'src-sel'], ass: ['Assumed', 'src-ass'], none: ['Not detected', 'src-none'] };
const srcCell = (k) => `<span class="${SRC[k][1]}">${SRC[k][0]}</span>`;
const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`;
const natural = (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true });

function cpuSelect(cur, threads) {
  let h = `<option value="">Select CPU...</option>`;
  const used = new Set();
  if (threads) {
    const m = CPUS.filter((c) => c.threads === threads).sort(natural);
    if (m.length) {
      h += `<optgroup label="Matches ${threads} threads reported by browser">${m.map((c) => opt(c.id, c.label, cur)).join('')}</optgroup>`;
      m.forEach((c) => used.add(c.id));
    }
  }
  for (const [vendor, label] of [['AMD', 'AMD Ryzen'], ['Intel', 'Intel Core']]) {
    const list = CPUS.filter((c) => c.vendor === vendor && !used.has(c.id)).sort(natural);
    if (list.length) h += `<optgroup label="${label}">${list.map((c) => opt(c.id, c.name, cur)).join('')}</optgroup>`;
  }
  return `<select id="f-cpu" data-k="cpuId" class="${cur ? '' : 'need'}" aria-label="CPU">${h}</select>`;
}

function gpuSelect(cur, matched) {
  let h = `<option value="">${matched ? 'Select GPU...' : 'Select GPU (not recognised)...'}</option>`;
  const groups = [
    ['NVIDIA GeForce', (g) => g.vendor === 'NVIDIA' && !g.integrated],
    ['AMD Radeon', (g) => g.vendor === 'AMD' && !g.integrated],
    ['Intel Arc', (g) => g.vendor === 'Intel' && !g.integrated],
    ['Integrated graphics', (g) => g.integrated],
  ];
  for (const [label, f] of groups) {
    h += `<optgroup label="${label}">${GPUS.filter(f).sort(natural).map((g) => opt(g.id, g.name, cur)).join('')}</optgroup>`;
  }
  return `<select id="f-gpu" data-k="gpuId" class="${cur ? '' : 'need'}" aria-label="GPU">${h}</select>`;
}

/* ---------- renderers ---------- */
function renderToolbar(e) {
  $('sel-game').innerHTML = GAMES.map((g) => opt(g.id, g.name, e.game.id)).join('');
  $('sel-res').innerHTML = [1080, 1440, 2160].map((r) => opt(r, RES_LABEL[r], e.res)).join('');
  $('sel-preset').innerHTML = PRESETS.map((n, i) => opt(i, n, e.preset)).join('');
  const hzs = [...new Set([...COMMON_HZ, e.hz])].sort((a, b) => a - b);
  $('sel-hz').innerHTML = hzs.map((h) => opt(h, `${h} Hz`, e.hz)).join('');
}

function renderSystem(e) {
  const d = S.det;
  if (!d) { $('system').innerHTML = '<div class="empty">Detecting hardware...</div>'; return; }

  const rows = [];
  const threadsNote = d.threads ? `Browser reports ${d.threads} logical threads. The CPU model cannot be read by a website.` : 'The CPU model cannot be read by a website.';
  rows.push(['CPU', `${cpuSelect(S.user.cpuId, d.threads)}<div class="sub-line">${esc(threadsNote)}</div>`, srcCell(e.src.cpu)]);

  const gpuSub = [];
  if (d.gpuRaw) gpuSub.push(`Browser reports: ${esc(d.gpuRaw)}`);
  if (d.gpuSoftware) gpuSub.push('Software rendering detected. Turn on hardware acceleration in the browser to read the real GPU.');
  rows.push(['GPU',
    `${gpuSelect(e.gpu?.id || '', !!d.gpuMatch)}
     <div class="inline"><label><input type="checkbox" id="f-laptop" data-k="laptop"${e.laptop ? ' checked' : ''}> Laptop GPU</label>${e.gpu ? `<span class="num sub-line">${e.gpu.vram} GB VRAM</span>` : ''}</div>
     <div class="sub-line">${gpuSub.join('<br>')}</div>`,
    srcCell(e.src.gpu)]);

  const ramSub = [];
  if (!S.user.ramGb && d.deviceMemory >= 8) ramSub.push('Browser only reports "8 GB or more" (API limit).');
  if (e.assumed.length || e.src.ram === 'ass') ramSub.push(`Assumed: ${[e.src.ram === 'ass' ? '16 GB' : null, ...e.assumed].filter(Boolean).join(', ')}. Change if wrong.`);
  rows.push(['RAM',
    `<div class="inline">
       <select id="f-ram" data-k="ramGb" data-num aria-label="RAM size">${RAM_SIZES.map((n) => opt(n, n + ' GB', e.ramGb)).join('')}</select>
       <select id="f-sticks" data-k="ramSticks" data-num aria-label="Number of RAM modules">${[1, 2, 4].map((n) => opt(n, n === 1 ? '1 module' : n + ' modules', e.ramSticks)).join('')}</select>
       <select id="f-ramtype" data-k="ramType" aria-label="RAM type">${['DDR3', 'DDR4', 'DDR5'].map((t) => opt(t, t, e.ramType)).join('')}</select>
     </div>${ramSub.length ? `<div class="sub-line">${esc(ramSub.join(' '))}</div>` : ''}`,
    srcCell(S.user.ramGb && S.user.ramSticks && S.user.ramType ? 'sel' : e.src.ram === 'det' && !e.assumed.length ? 'det' : 'ass')]);

  rows.push(['Storage',
    `<select id="f-storage" data-k="storage" aria-label="Game storage">${STORAGE.map(([v, l]) => opt(v, l, e.storage)).join('')}</select>
     <div class="sub-line">Drive where your games are installed.</div>`,
    srcCell(e.src.storage)]);

  const sc = d.screen;
  const dispSub = [];
  if (sc && sc.dpr !== 1) dispSub.push(`Pixel ratio ${sc.dpr}. Windows scaling or browser zoom can change the reported size.`);
  if (!d.hz) dispSub.push('Refresh rate could not be measured (tab in background?). Pick it in the toolbar.');
  rows.push(['Display',
    `<span class="num">${sc ? `${sc.w} x ${sc.h}` : 'unknown'}${d.hz ? ` @ ${d.hz} Hz` : ''}</span>${dispSub.length ? `<div class="sub-line">${esc(dispSub.join(' '))}</div>` : ''}`,
    srcCell(sc ? 'det' : 'none')]);

  rows.push(['System', `${esc([d.os, d.arch].filter(Boolean).join(', ') || 'unknown')}<div class="sub-line">${esc(d.browser || '')}</div>`, srcCell(d.os ? 'det' : 'none')]);

  $('system').innerHTML = `<table class="sys"><tbody>${rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table>`;
}

function renderRaw() {
  const d = S.det;
  if (!d) { $('detect-raw').innerHTML = '<div class="empty">Running...</div>'; return; }
  const g = d.webgpu || {};
  const gpuApi = !g.supported ? 'not supported' : !g.adapter ? 'supported, no adapter' :
    [g.vendor, g.architecture, g.description].filter(Boolean).join(' / ') || 'supported (adapter info hidden)';
  const rows = [
    ['hardwareConcurrency', d.threads ?? 'not available'],
    ['deviceMemory', d.deviceMemory ? `${d.deviceMemory} GB (API maximum is 8)` : 'not available in this browser'],
    ['Screen', d.screen ? `${d.screen.cssW} x ${d.screen.cssH} CSS px, ratio ${d.screen.dpr}, ${d.screen.colorDepth}-bit` : 'unknown'],
    ['Refresh rate', d.hzRaw ? `${d.hzRaw.toFixed(1)} Hz measured` : 'not measured'],
    ['WebGL renderer', d.webgl ? `${d.webgl.renderer}${d.webgl.masked ? ' (masked by browser)' : ''}` : 'WebGL unavailable'],
    ['WebGPU', gpuApi],
    ['userAgentData', navigator.userAgentData ? 'available' : 'not available in this browser'],
    ['Not detectable', 'CPU model, RAM modules, storage type, mainboard, power supply'],
  ];
  $('detect-raw').innerHTML = `<table class="raw"><tbody>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
}

function waitingMsg(e) {
  const miss = [];
  if (!e.cpu) miss.push('CPU');
  if (!e.gpu) miss.push('GPU');
  return `Select your ${miss.join(' and ')} in the System Overview to see results.`;
}

function shopLinks(q) {
  return SHOPS.map(([k, label]) => {
    const t = CFG[k];
    if (!t) return '';
    const url = t.replace('{q}', encodeURIComponent(q));
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer sponsored">${label}</a>`;
  }).join('');
}

const perFps = (v) => 'CHF ' + (v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('de-CH'));

function renderResults(e) {
  const waiting = !S.det || !e.sys;
  if (waiting) {
    const msg = S.det ? waitingMsg(e) : 'Detecting hardware...';
    for (const id of ['verdict', 'upgrades', 'analysis', 'presets']) $(id).innerHTML = `<div class="empty">${esc(msg)}</div>`;
    return;
  }
  const { sys, game, preset, res, hz } = e;
  const up = buildUpgrades(sys, game, preset, res, hz);
  const cur = up.cur;

  $('verdict').innerHTML = `<p class="verdict-head">${esc(up.verdict.headline)}</p><p class="verdict-detail">${esc(up.verdict.detail)}</p>
    <p class="verdict-detail num">Basis: ${esc(game.name)}, ${PRESETS[preset]} settings, ${res === 2160 ? '4K' : res + 'p'}, target ${hz} Hz. Now about ${fps(cur.avg)} FPS average, ${fps(cur.low)} FPS 1% lows.</p>`;

  if (!up.list.length) {
    $('upgrades').innerHTML = '<div class="empty">No meaningful upgrade available for this game and these settings.</div>';
  } else {
    const rows = up.list.map((c, i) => `
      <tr class="${i === 0 ? 'best' : ''}">
        <td class="r num">${c.rank}</td>
        <td><div class="comp">${esc(c.label)}</div><div class="cur">replaces ${esc(c.current)}</div></td>
        <td class="num">Avg +${fps(c.dAvg)} <span class="cur">(${fps(cur.avg)} to ${fps(c.nxt.avg)})</span><br>Low +${fps(c.dLow)} <span class="cur">(${fps(cur.low)} to ${fps(c.nxt.low)})</span></td>
        <td class="r num">${chf(c.cost)}</td>
        <td class="r num">${perFps(c.costPerFps)}</td>
        <td class="num"><span class="pill"><i style="width:${c.valueScore}%"></i></span> ${c.valueScore}</td>
        <td class="shops">${shopLinks(c.q)}</td>
      </tr>
      <tr class="exp"><td></td><td colspan="6">${esc(c.explanation)}${c.notes.map((n) => `<span class="note">${esc(n)}</span>`).join('')}</td></tr>`).join('');
    $('upgrades').innerHTML = `<div class="tbl-scroll"><table class="up">
      <thead><tr><th class="r">#</th><th>Upgrade</th><th>Est. FPS gain</th><th class="r">Est. price</th><th class="r" title="Estimated price per FPS gained (average and 1% lows combined)">Cost / FPS</th><th title="Gain per CHF, best option = 100">Value</th><th>Shops</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <div class="empty">Ranking and Cost / FPS count FPS only up to your display's ${hz} Hz. Prices are reference values, check the shops.</div>`;
  }

  $('analysis').innerHTML = `<ul class="alist">${analysis(sys, game, preset, res, hz, cur, PRESETS[preset]).map((l) =>
    `<li><span class="tag ${l.lvl}">${{ ok: 'OK', warn: 'WARN', info: 'INFO' }[l.lvl]}</span><span>${esc(l.text)}</span></li>`).join('')}</ul>`;

  $('presets-title').textContent = `Game Presets - ${game.name} at ${res === 2160 ? '4K' : res + 'p'}`;
  const rowsP = presetTable(sys, game, res).map(({ name, p, est }) => `
    <tr class="${p === preset ? 'cur-preset' : ''}" data-p="${p}" style="cursor:pointer">
      <td>${name}</td><td class="r num">${fps(est.avg)}</td><td class="r num">${fps(est.low)}</td>
      <td class="num"><span class="bar ${est.cpuLoad > 90 ? 'hi' : ''}"><i style="width:${est.cpuLoad}%"></i></span>${Math.round(est.cpuLoad)}%</td>
      <td class="num"><span class="bar ${est.gpuLoad > 90 ? 'hi' : ''}"><i style="width:${est.gpuLoad}%"></i></span>${Math.round(est.gpuLoad)}%</td>
      <td class="lim">${est.limiter === 'cpu' ? 'CPU' : est.limiter === 'gpu' ? 'GPU' : 'Balanced'}${est.vramShort ? ', VRAM' : ''}</td></tr>`).join('');
  $('presets').innerHTML = `<div class="tbl-scroll"><table class="presets">
    <thead><tr><th>Settings</th><th class="r">Expected FPS</th><th class="r">1% lows</th><th title="Modelled, not measured">CPU load</th><th title="Modelled, not measured">GPU load</th><th>Limit</th></tr></thead>
    <tbody>${rowsP}</tbody></table></div>`;
}

function render() {
  const keep = document.activeElement?.id;
  const e = effective();
  renderToolbar(e);
  renderSystem(e);
  renderRaw();
  renderResults(e);
  if (keep) $(keep)?.focus();
}

/* ---------- events ---------- */
function setUser(k, raw, isNum) {
  if (raw === '' || raw == null) delete S.user[k];
  else S.user[k] = isNum ? Number(raw) : raw;
  saveUser();
  render();
}

document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.id === 'f-laptop') { S.user.laptop = t.checked; saveUser(); render(); return; }
  const k = t.dataset?.k;
  if (k) return setUser(k, t.value, t.hasAttribute('data-num'));
  const map = { 'sel-game': ['game', false], 'sel-res': ['res', true], 'sel-preset': ['preset', true], 'sel-hz': ['hz', true] };
  if (map[t.id]) setUser(map[t.id][0], t.value, map[t.id][1]);
});

document.addEventListener('click', (ev) => {
  const row = ev.target.closest('tr[data-p]');
  if (row) setUser('preset', row.dataset.p, true);
});

$('btn-reset').addEventListener('click', () => { S.user = {}; saveUser(); render(); });
$('btn-redetect').addEventListener('click', run);

async function run() {
  S.det = null;
  $('status-detect').textContent = 'Detecting...';
  render();
  const t0 = performance.now();
  try {
    S.det = await detect(COMMON_HZ);
    $('status-detect').textContent = `Detection finished in ${Math.round(performance.now() - t0)} ms`;
  } catch (err) {
    S.det = { threads: navigator.hardwareConcurrency || null, screen: null };
    $('status-detect').textContent = 'Detection failed partially: select your hardware manually';
  }
  render();
}

if (!Object.values(CFG).some(Boolean)) $('foot-aff').textContent = '';
render();
run();
