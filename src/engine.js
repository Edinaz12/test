// EZN estimation engine. Pure functions, no DOM - testable in Node.
import { CPUS, GPUS, COSTS, SOCKET_RAM, RES_FACTOR, PRESETS } from './data.js';

const K = 5; // soft-minimum sharpness: CPU and GPU limits blend instead of a hard min()
const softMin = (a, b) => Math.pow(Math.pow(a, -K) + Math.pow(b, -K), -1 / K);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const fps = (n) => (n >= 100 ? Math.round(n / 5) * 5 : Math.round(n));
export const chf = (n) => 'CHF ' + Math.round(n).toLocaleString('de-CH');

export function recommendedPsu(idx) {
  return idx < 120 ? 450 : idx < 180 ? 550 : idx < 230 ? 650 : idx < 300 ? 750 : idx < 400 ? 850 : 1000;
}

function capFactor(gb, sens) {
  if (gb >= 32) return 1;
  if (gb >= 16) return 1 - 0.04 * sens;
  if (gb >= 8) return 1 - 0.22 * sens;
  return 0.5;
}

/** sys: {cpu, gpu, gpuMobile, ramGb, ramSticks, ramType, storage} */
export function estimate(sys, game, p, res) {
  const { cpu, gpu } = sys;
  if (!cpu || !gpu) return null;

  const gpuIdx = gpu.idx * (sys.gpuMobile ? 0.7 : 1);
  const cf = capFactor(sys.ramGb, game.ramSens);
  const chan = sys.ramSticks >= 2 ? 1 : 0.94;

  const cpuFps = game.cpu * (cpu.idx / 100) * game.cpuMul[p] * cf * chan;

  const vramNeed = game.vram[p] + (res === 1440 ? 1.5 : res === 2160 ? 3.5 : 0);
  const vramShort = gpu.vram < vramNeed;
  const vf = vramShort ? Math.max(0.4, Math.pow(gpu.vram / vramNeed, 1.2)) : 1;
  const gpuFps = game.gpu[p] * (gpuIdx / 100) * RES_FACTOR[res] * vf;

  const avg = softMin(cpuFps, gpuFps);
  const ratio = cpuFps / gpuFps;
  const limiter = ratio < 0.85 ? 'cpu' : ratio > 1.18 ? 'gpu' : 'balanced';

  let low = avg * { cpu: 0.7, gpu: 0.82, balanced: 0.76 }[limiter];
  low *= Math.pow(cf, 1.5);
  if (chan < 1) low *= 0.95;
  if (sys.storage === 'hdd') low *= 1 - 0.18 * (0.4 + 0.6 * game.ramSens);
  else if (sys.storage === 'ssd') low *= 0.99;
  if (vramShort) low *= 0.85;

  return {
    avg, low, cpuFps, gpuFps, limiter, vramShort, vramNeed,
    cpuLoad: clamp((100 * avg) / cpuFps, 5, 99),
    gpuLoad: clamp((100 * avg) / gpuFps, 5, 99),
  };
}

export function presetTable(sys, game, res) {
  return PRESETS.map((name, p) => ({ name, p, est: estimate(sys, game, p, res) }));
}

const kit = (type, gb) => COSTS.ramKit[type][gb >= 32 ? 32 : 16];

/** Build ranked upgrade candidates for the selected game/preset/resolution. */
export function buildUpgrades(sys, game, p, res, hz) {
  const cur = estimate(sys, game, p, res);
  if (!cur) return null;
  // FPS above the display's refresh rate has little value, so ranking, thresholds and
  // cost-per-FPS count FPS only up to `hz`. The table still shows the full modelled numbers.
  const useful = (v) => Math.min(v, hz);
  const curScore = (useful(cur.avg) + useful(cur.low)) / 2;
  const out = [];

  const add = (cat, label, current, cost, newSys, q, notes = []) => {
    const nxt = estimate(newSys, game, p, res);
    const dAvg = nxt.avg - cur.avg;
    const dLow = nxt.low - cur.low;
    const eff = 0.5 * (useful(nxt.avg) - useful(cur.avg)) + 0.5 * (useful(nxt.low) - useful(cur.low));
    out.push({ cat, label, current, cost, q, notes, nxt, dAvg, dLow, eff, newSys });
  };

  const desktop = !sys.gpuMobile;

  if (desktop) {
    for (const c of CPUS) {
      if (!c.price || c.idx < sys.cpu.idx * 1.1) continue;
      const notes = [];
      let cost = c.price;
      const ns = { ...sys, cpu: c };
      if (c.socket !== sys.cpu.socket) {
        cost += COSTS.board;
        notes.push(`Needs a new ${c.socket} mainboard (about ${chf(COSTS.board)} included).`);
        const allowed = SOCKET_RAM[c.socket] || [];
        if (!allowed.includes(sys.ramType)) {
          const t = allowed[0];
          const gb = Math.max(16, Math.min(32, sys.ramGb));
          cost += kit(t, gb);
          ns.ramType = t; ns.ramGb = gb; ns.ramSticks = 2;
          notes.push(`This platform needs ${t} memory (${gb} GB kit about ${chf(kit(t, gb))} included).`);
        }
      }
      add('cpu', c.label, sys.cpu.label, cost, ns, c.q, notes);
    }
    for (const g of GPUS) {
      if (!g.price || g.idx < sys.gpu.idx * 1.15) continue;
      const notes = [`Recommended PSU: about ${recommendedPsu(g.idx)} W or more. Check case clearance.`];
      add('gpu', g.label, sys.gpu.label, g.price, { ...sys, gpu: g }, g.q, notes);
    }
  }

  // RAM
  if (sys.ramSticks === 1 && sys.ramGb >= 8) {
    const gb = sys.ramGb * 2;
    add('ram', `Add a matching stick: ${gb} GB dual channel`, `${sys.ramGb} GB single stick (${sys.ramType})`,
      kit(sys.ramType, Math.min(gb, 32)) / 2, { ...sys, ramGb: gb, ramSticks: 2 },
      `${sys.ramGb}GB ${sys.ramType} RAM module`);
  }
  if (sys.ramGb < 16) {
    add('ram', '16 GB (2 x 8 GB) dual channel', `${sys.ramGb} GB ${sys.ramType}`,
      kit(sys.ramType, 16), { ...sys, ramGb: 16, ramSticks: 2 }, `16GB 2x8GB ${sys.ramType} kit`);
  }
  if (sys.ramGb < 32) {
    add('ram', '32 GB (2 x 16 GB) dual channel', `${sys.ramGb} GB ${sys.ramType}`,
      kit(sys.ramType, 32), { ...sys, ramGb: 32, ramSticks: 2 }, `32GB 2x16GB ${sys.ramType} kit`);
  }

  // Storage
  if (sys.storage === 'hdd') {
    add('storage', 'NVMe SSD 1 TB', 'Hard disk (HDD)', COSTS.nvme1tb, { ...sys, storage: 'nvme' }, 'NVMe SSD 1TB');
  }

  // Big-ticket parts must give a noticeable gain. Cheap RAM/storage fixes mostly improve
  // frame consistency (1% lows), so they qualify at a smaller gain.
  const minGain = (c) => (c.cat === 'ram' || c.cat === 'storage' ? Math.max(1.5, 0.03 * curScore) : Math.max(3, 0.08 * curScore));
  const meaningful = out.filter((c) => c.eff >= minGain(c));
  meaningful.forEach((c) => {
    c.ratio = c.eff / c.cost;          // FPS per CHF
    c.costPerFps = c.cost / c.eff;     // CHF per FPS
  });
  const best = Math.max(0, ...meaningful.map((c) => c.ratio));
  meaningful.forEach((c) => { c.valueScore = Math.round((100 * c.ratio) / best); });

  // Keep the best two per category (by value) so the list stays readable.
  const byCat = {};
  for (const c of meaningful.sort((a, b) => b.ratio - a.ratio)) {
    (byCat[c.cat] = byCat[c.cat] || []).push(c);
  }
  const picked = [];
  for (const list of Object.values(byCat)) {
    picked.push(...list.slice(0, 2));
    const top = list.reduce((m, c) => (c.eff > m.eff ? c : m), list[0]);
    if (!picked.includes(top)) picked.push(top);
  }
  picked.sort((a, b) => b.ratio - a.ratio);
  picked.forEach((c, i) => {
    c.rank = i + 1;
    c.explanation = explainUpgrade(c, cur, sys, game);
  });

  return { cur, list: picked.slice(0, 8), verdict: verdict(cur, picked, sys, game, hz) };
}

function explainUpgrade(c, cur, sys, game) {
  const n = c.nxt;
  const gameName = game.name;
  if (c.cat === 'cpu') {
    if (cur.limiter === 'cpu') {
      return `Your CPU caps ${gameName} at about ${fps(cur.cpuFps)} FPS while your GPU could deliver about ${fps(cur.gpuFps)}. ` +
        `The ${c.label} lifts the CPU limit to about ${fps(n.cpuFps)} FPS` +
        (n.gpuFps < n.cpuFps * 0.95 ? ', after which your GPU becomes the limit.' : '.');
    }
    return `Your CPU is not the main limit in this setup, so the gain is smaller. It still raises 1% lows and helps in more CPU-heavy games.`;
  }
  if (c.cat === 'gpu') {
    if (cur.limiter === 'gpu') {
      return `Your GPU is the limiting component here (about ${fps(cur.gpuFps)} FPS vs. ${fps(cur.cpuFps)} FPS from the CPU). ` +
        `The ${c.label} lifts that to about ${fps(n.gpuFps)} FPS` + (n.cpuFps < n.gpuFps * 0.95 ? ', where your CPU starts to limit.' : '.');
    }
    return `Only part of this gain is reachable because your CPU limits first. Consider a CPU upgrade before or together with the GPU.`;
  }
  if (c.cat === 'ram') {
    if (sys.ramGb < 16) return `${sys.ramGb} GB is tight for current games. More memory mainly improves frame consistency (1% lows) and removes stutter from swapping.`;
    if (sys.ramSticks === 1) return `A single stick runs memory in single channel, which halves bandwidth. A matching second stick enables dual channel and usually smooths frame times.`;
    return `Games like ${game.name} can use more than 16 GB together with background apps. This mainly improves frame consistency, not average FPS.`;
  }
  if (c.cat === 'storage') {
    return `Games on a hard disk stutter when new assets load. An SSD mainly fixes stutter and long loading times (1% lows), not average FPS.`;
  }
  return '';
}

function verdict(cur, list, sys, game, hz) {
  const reaches = cur.avg >= hz;
  if (!list.length) {
    let detail = reaches
      ? `This setup already reaches roughly your display's ${hz} Hz in ${game.name}. Spending more would barely be noticeable.`
      : `No single part in the database lifts this setup by a noticeable amount at a sensible price.`;
    if (reaches && hz <= 75 && cur.avg >= hz * 1.5) {
      detail += ` Your ${hz} Hz display is the limit here: a higher refresh rate monitor would use this PC better.`;
    }
    return { kind: 'none', headline: 'No meaningful upgrade available.', detail };
  }
  const t = list[0];
  const gpuStillOk = cur.gpuFps >= cur.cpuFps * 1.1;
  let headline;
  if (t.cat === 'cpu') headline = gpuStillOk || cur.limiter === 'cpu' ? 'Keep your GPU. Upgrade your CPU first.' : 'Upgrade your CPU first.';
  else if (t.cat === 'gpu') headline = cur.limiter === 'gpu' ? 'Your CPU is fine here. Upgrade your GPU first.' : 'Upgrade your GPU first.';
  else if (t.cat === 'ram') headline = 'Upgrade RAM before replacing your graphics card.';
  else headline = 'Move your games to an SSD before spending on CPU or GPU.';
  let detail = `Best value: ${t.label} for ${chf(t.cost)}, about +${fps(t.dAvg)} FPS average and +${fps(t.dLow)} FPS in 1% lows.`;
  if (reaches) detail += ` Note: the current setup already reaches about your display's ${hz} Hz, so this is optional.`;
  return { kind: t.cat, headline, detail };
}

const classOf = (idx) =>
  idx < 45 ? 'is an entry-level graphics solution: expect 1080p at low settings in demanding games, and esports titles at playable rates'
  : idx < 75 ? 'is suited to 1080p at low to medium settings in demanding games, and high frame rates in esports titles'
  : idx < 115 ? 'is capable of 1080p gaming at high settings in most games'
  : idx < 140 ? 'is powerful enough for 1080p at high to ultra settings, and entry-level 1440p'
  : idx < 260 ? 'is powerful enough for 1440p gaming'
  : 'is powerful enough for 4K gaming';

export function analysis(sys, game, p, res, hz, est, presetName) {
  const L = [];
  const add = (lvl, text) => L.push({ lvl, text });
  const { gpu, cpu } = sys;
  const gpuIdx = gpu.idx * (sys.gpuMobile ? 0.7 : 1);
  const resName = { 1080: '1080p', 1440: '1440p', 2160: '4K' }[res];

  add(gpuIdx >= 45 ? 'ok' : 'warn', `Your GPU (${gpu.name}${sys.gpuMobile ? ', laptop version' : ''}) ${classOf(gpuIdx)}.`);

  if (res === 2160 && gpuIdx < 260) add('warn', `Your display is ${resName}. This GPU will need lower settings or upscaling (DLSS, FSR) to hold good frame rates there.`);
  if (res === 1080 && gpuIdx >= 260) add('info', `This GPU is more than 1080p needs. A 1440p or 4K monitor would use it better.`);

  const compEst = estimate(sys, game, 0, res);
  if (compEst.cpuFps < hz) {
    add('warn', `Your current CPU (${cpu.name}) will struggle to maintain ${hz} FPS in ${game.name}. It tops out around ${fps(compEst.cpuFps)} FPS.`);
  } else {
    add('ok', `Your current CPU (${cpu.name}) can feed a ${hz} Hz display in ${game.name} (about ${fps(compEst.cpuFps)} FPS ceiling).`);
  }

  if (est.avg >= hz) add('ok', `At ${presetName} settings in ${resName}, ${game.name} should run at about ${fps(est.avg)} FPS, which covers your ${hz} Hz display.`);
  else add('info', `At ${presetName} settings in ${resName}, ${game.name} should run at about ${fps(est.avg)} FPS, below your ${hz} Hz display.`);

  if (est.limiter === 'cpu') add('warn', `In this setup your CPU is the bottleneck, not your graphics card.`);
  else if (est.limiter === 'gpu') add('info', `In this setup your GPU is the limiting component, not your CPU.`);
  else add('ok', `CPU and GPU are well matched for this game and resolution.`);

  if (est.vramShort) add('warn', `${gpu.name} has ${gpu.vram} GB VRAM, but these settings want about ${est.vramNeed} GB. Lower texture quality to avoid stutter.`);

  if (sys.ramGb < 16) add('warn', `${sys.ramGb} GB of RAM is below what modern games expect. Adding RAM will likely improve frame consistency.`);
  else if (sys.ramSticks === 1) add('warn', `Your RAM runs as a single stick. Adding a matching stick (dual channel) will likely improve frame consistency.`);
  else if (sys.ramGb >= 32) add('ok', `Memory capacity is not a limit for gaming.`);
  else add('ok', `${sys.ramGb} GB of dual channel RAM is enough for most games.`);

  if (sys.storage === 'hdd') add('warn', `Your games are on a hard disk. Expect stutter and long loading times; an SSD is the cheapest fix.`);

  if (cpu.cores < 6 && ['warzone', 'cp2077', 'fortnite'].includes(game.id)) {
    add('warn', `${cpu.name} has ${cpu.cores} cores. ${game.name} runs better on 6 or more.`);
  }
  if (sys.gpuMobile) add('info', `This looks like a laptop: CPU and GPU are normally not replaceable, so only RAM and storage upgrades are listed.`);
  return L;
}
