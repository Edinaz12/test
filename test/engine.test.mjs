import assert from 'node:assert/strict';
import { CPUS, GPUS, GAMES, SOCKET_RAM } from '../src/data.js';
import { estimate, buildUpgrades, presetTable, analysis, fps } from '../src/engine.js';
import { matchGpu, cleanRenderer, snapHz } from '../src/detect.js';
import { COMMON_HZ } from '../src/data.js';

const cpu = (id) => CPUS.find((c) => c.id === id);
const gpu = (id) => GPUS.find((g) => g.id === id);
const game = (id) => GAMES.find((g) => g.id === id);
const sys = (c, g, o = {}) => ({ cpu: cpu(c), gpu: gpu(g), gpuMobile: false, ramGb: 16, ramSticks: 2, ramType: 'DDR4', storage: 'nvme', ...o });
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

// ---- data integrity
t('unique ids, positive indexes', () => {
  for (const list of [CPUS, GPUS]) {
    assert.equal(new Set(list.map((x) => x.id)).size, list.length);
    list.forEach((x) => assert.ok(x.idx > 0 && x.name));
  }
  CPUS.forEach((c) => assert.ok(SOCKET_RAM[c.socket], c.id + ' socket'));
});

// ---- GPU string matching
const cases = [
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 SUPER (0x00002783) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rtx-4070s', false],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti SUPER (0x00002705) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rtx-4070tis', false],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti (0x00002782) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rtx-4070ti', false],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rtx-4070', false],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rtx-3060ti', false],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rtx-3060', false],
  ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER (0x000021C4) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'gtx-1660s', false],
  ['ANGLE (AMD, AMD Radeon RX 7800 XT (0x0000747E) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rx-7800xt', false],
  ['ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rx-6600xt', false],
  ['ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'igpu-amd-generic', false],
  ['ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'igpu-intel-uhd', false],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028E0) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'rtx-4060', true],
  ['NVIDIA GeForce RTX 5070 Ti/PCIe/SSE2', 'rtx-5070ti', false],
];
for (const [raw, id, mobile] of cases) {
  t('match ' + id + (mobile ? ' (laptop)' : ''), () => {
    const m = matchGpu(raw);
    assert.equal(m.gpu?.id, id, raw + ' -> ' + m.gpu?.id);
    assert.equal(m.mobile, mobile);
  });
}
t('unknown renderer gives no match', () => assert.equal(matchGpu('Apple GPU').gpu, null));
t('cleanRenderer', () => assert.equal(cleanRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'NVIDIA GeForce RTX 4070'));
t('snapHz', () => { assert.equal(snapHz(143.6, COMMON_HZ), 144); assert.equal(snapHz(59.9, COMMON_HZ), 60); assert.equal(snapHz(null, COMMON_HZ), null); });

// ---- estimation sanity
t('FPS monotonic: faster CPU never lowers FPS', () => {
  for (const g of GAMES) for (let p = 0; p < 4; p++) {
    let prev = 0;
    for (const c of [...CPUS].sort((a, b) => a.idx - b.idx)) {
      const e = estimate(sys(c.id, 'rtx-4070'), g, p, 1080);
      assert.ok(e.avg >= prev - 1e-9, `${g.id} ${c.id}`); prev = e.avg;
    }
  }
});
t('FPS monotonic: faster GPU never lowers FPS', () => {
  for (const g of GAMES) {
    let prev = 0;
    for (const x of GPUS.filter((g) => g.vram >= 8).sort((a, b) => a.idx - b.idx)) { // VRAM differences are modelled separately
      const e = estimate(sys('r5-5600', x.id), g, 0, 1440); // preset 0: VRAM need is low, so index order must hold
      assert.ok(e.avg >= prev * 0.97, `${g.id} ${x.id} ${e.avg} < ${prev}`); prev = Math.max(prev, e.avg);
    }
  }
});
t('low <= avg and loads in range everywhere', () => {
  for (const g of GAMES) for (const r of [1080, 1440, 2160]) for (let p = 0; p < 4; p++) {
    const e = estimate(sys('i5-12400f', 'rtx-3060'), g, p, r);
    assert.ok(e.low < e.avg && e.low > 0 && e.cpuLoad <= 99 && e.gpuLoad <= 99 && e.cpuLoad >= 5);
  }
});
t('higher resolution costs FPS', () => {
  const s = sys('r7-7800x3d', 'rtx-4070');
  const f = (r) => estimate(s, game('cp2077'), 2, r).avg;
  assert.ok(f(1080) > f(1440) && f(1440) > f(2160));
});

// ---- recommendation logic
t('old CPU + strong GPU: CPU first, GPU kept', () => {
  const u = buildUpgrades(sys('r5-3600', 'rtx-4070'), game('valorant'), 1, 1440, 360);
  assert.equal(u.cur.limiter, 'cpu');
  assert.equal(u.verdict.kind, 'cpu');
  assert.match(u.verdict.headline, /Keep your GPU\. Upgrade your CPU first\./);
  assert.ok(u.list.every((c) => c.cost > 0 && c.eff > 0));
});
t('strong CPU + weak GPU: GPU first', () => {
  const u = buildUpgrades(sys('r7-7800x3d', 'gtx-1660s', { ramType: 'DDR5' }), game('cp2077'), 2, 1440, 144);
  assert.equal(u.cur.limiter, 'gpu');
  assert.equal(u.verdict.kind, 'gpu');
});
t('8 GB single stick in Warzone: RAM shows up and is cheap', () => {
  const u = buildUpgrades(sys('r5-5600', 'rtx-4070', { ramGb: 8, ramSticks: 1 }), game('warzone'), 1, 1080, 144);
  const ram = u.list.filter((c) => c.cat === 'ram');
  assert.ok(ram.length > 0);
  assert.ok(Math.min(...ram.map((c) => c.cost)) <= 80);
});
t('top-end system: no meaningful upgrade', () => {
  const u = buildUpgrades(sys('r7-9800x3d', 'rtx-5090', { ramGb: 32, ramType: 'DDR5' }), game('valorant'), 1, 1440, 240);
  assert.equal(u.verdict.kind, 'none');
  assert.equal(u.verdict.headline, 'No meaningful upgrade available.');
  assert.equal(u.list.length, 0);
});
t('HDD: SSD upgrade offered', () => {
  const u = buildUpgrades(sys('r5-5600', 'rtx-4060', { storage: 'hdd' }), game('fortnite'), 1, 1080, 144);
  assert.ok(u.list.some((c) => c.cat === 'storage'));
});
t('socket change adds board (and DDR5) to the cost', () => {
  const u = buildUpgrades(sys('i5-9400f', 'rtx-4070'), game('valorant'), 1, 1440, 360);
  const am5 = u.list.find((c) => c.newSys.cpu.socket === 'AM5');
  if (am5) assert.ok(am5.cost >= am5.newSys.cpu.price + 250 + 100, am5.label + ' ' + am5.cost);
  const any = u.list.find((c) => c.cat === 'cpu');
  assert.ok(any && any.notes.some((x) => /mainboard/.test(x)));
});
t('laptop: only RAM/storage upgrades', () => {
  const u = buildUpgrades(sys('i7-12700k', 'rtx-4060', { gpuMobile: true, ramGb: 8 }), game('cp2077'), 1, 1080, 144);
  assert.ok(u.list.every((c) => c.cat === 'ram' || c.cat === 'storage'));
});
t('ranking is sorted by value, value score in 1..100', () => {
  const u = buildUpgrades(sys('i5-10400f', 'rtx-2060'), game('apex'), 1, 1080, 144);
  assert.ok(u.list.length > 1);
  for (let i = 1; i < u.list.length; i++) assert.ok(u.list[i - 1].ratio >= u.list[i].ratio);
  u.list.forEach((c) => assert.ok(c.valueScore >= 1 && c.valueScore <= 100 && c.explanation.length > 10));
  assert.equal(u.list[0].valueScore, 100);
});
t('analysis text has no raw percentage strings', () => {
  const s = sys('r5-1600', 'rtx-4070'); // a Ryzen 5 3600 already holds ~300 FPS in Valorant, so use an older CPU
  const e = estimate(s, game('valorant'), 1, 1440);
  const a = analysis(s, game('valorant'), 1, 1440, 360, e, 'Balanced');
  assert.ok(a.length >= 4);
  a.forEach((l) => assert.ok(!/\d+\s?%/.test(l.text), l.text));
  assert.ok(a.some((l) => /struggle to maintain 360 FPS in Valorant/.test(l.text)));
  assert.ok(a.some((l) => /1440p/.test(l.text)));
});
t('preset table: 4 rows, FPS falls with heavier settings', () => {
  const rows = presetTable(sys('r5-5600', 'rtx-3060'), game('cp2077'), 1080);
  assert.equal(rows.length, 4);
  for (let i = 1; i < 4; i++) assert.ok(rows[i].est.avg <= rows[i - 1].est.avg);
});

t('display limit: no CPU upgrade when the CPU already exceeds the refresh rate', () => {
  const u = buildUpgrades(sys('r5-3600', 'rtx-4070'), game('valorant'), 1, 1440, 240);
  assert.equal(u.verdict.kind, 'none');
  assert.ok(!u.list.some((c) => c.cat === 'cpu'));
});
t('60 Hz display hint appears when the PC is far beyond it', () => {
  const u = buildUpgrades(sys('r5-5600', 'rtx-4070'), game('valorant'), 1, 1080, 60);
  assert.equal(u.verdict.kind, 'none');
  assert.match(u.verdict.detail, /higher refresh rate monitor/);
});

// ---- print a few scenarios for eyeballing
for (const [c, g, gm, r] of [['r5-3600', 'rtx-4070', 'valorant', 1440], ['i5-12400f', 'rtx-3060', 'cp2077', 1440], ['r5-1600', 'rx-580', 'fortnite', 1080]]) {
  const e = estimate(sys(c, g), game(gm), 1, r);
  console.log(`   ${c} + ${g} | ${gm} ${r}p balanced: ${fps(e.avg)} avg / ${fps(e.low)} low, limit ${e.limiter}`);
}
console.log(`\n${n} tests passed`);
