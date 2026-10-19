// EZN hardware + game database.
//
// All performance values are RELATIVE INDEXES, not benchmarks:
//   CPU index: Ryzen 5 5600 = 100 (typical gaming performance)
//   GPU index: GeForce RTX 3060 = 100 (typical 1080p raster performance)
// Prices are rough reference prices in CHF (new, Swiss market). They change
// constantly - adjust them here, or replace them with a price feed later.
// price 0 = no longer sold new (can be detected/selected, never recommended).

const cpuRows = [
  // id, name, vendor, socket, idx, cores, threads, price
  ['r5-1600', 'Ryzen 5 1600', 'AMD', 'AM4', 58, 6, 12, 0],
  ['r5-2600', 'Ryzen 5 2600', 'AMD', 'AM4', 65, 6, 12, 0],
  ['r5-3600', 'Ryzen 5 3600', 'AMD', 'AM4', 82, 6, 12, 0],
  ['r5-5500', 'Ryzen 5 5500', 'AMD', 'AM4', 90, 6, 12, 85],
  ['r5-5600', 'Ryzen 5 5600', 'AMD', 'AM4', 100, 6, 12, 110],
  ['r5-5600x', 'Ryzen 5 5600X', 'AMD', 'AM4', 105, 6, 12, 125],
  ['r7-5700x', 'Ryzen 7 5700X', 'AMD', 'AM4', 108, 8, 16, 150],
  ['r7-5800x', 'Ryzen 7 5800X', 'AMD', 'AM4', 112, 8, 16, 0],
  ['r7-5700x3d', 'Ryzen 7 5700X3D', 'AMD', 'AM4', 132, 8, 16, 230],
  ['r7-5800x3d', 'Ryzen 7 5800X3D', 'AMD', 'AM4', 142, 8, 16, 320],
  ['r5-7500f', 'Ryzen 5 7500F', 'AMD', 'AM5', 128, 6, 12, 150],
  ['r5-7600', 'Ryzen 5 7600', 'AMD', 'AM5', 132, 6, 12, 190],
  ['r5-7600x', 'Ryzen 5 7600X', 'AMD', 'AM5', 137, 6, 12, 210],
  ['r5-9600x', 'Ryzen 5 9600X', 'AMD', 'AM5', 145, 6, 12, 230],
  ['r7-7700', 'Ryzen 7 7700', 'AMD', 'AM5', 142, 8, 16, 260],
  ['r7-9700x', 'Ryzen 7 9700X', 'AMD', 'AM5', 152, 8, 16, 330],
  ['r7-7800x3d', 'Ryzen 7 7800X3D', 'AMD', 'AM5', 185, 8, 16, 400],
  ['r7-9800x3d', 'Ryzen 7 9800X3D', 'AMD', 'AM5', 215, 8, 16, 500],
  ['r9-7950x3d', 'Ryzen 9 7950X3D', 'AMD', 'AM5', 190, 16, 32, 550],
  ['r9-9950x3d', 'Ryzen 9 9950X3D', 'AMD', 'AM5', 220, 16, 32, 700],

  ['i5-6600k', 'Core i5-6600K', 'Intel', 'LGA1151', 60, 4, 4, 0],
  ['i7-7700k', 'Core i7-7700K', 'Intel', 'LGA1151', 74, 4, 8, 0],
  ['i5-8400', 'Core i5-8400', 'Intel', 'LGA1151', 78, 6, 6, 0],
  ['i5-9400f', 'Core i5-9400F', 'Intel', 'LGA1151', 80, 6, 6, 0],
  ['i7-8700k', 'Core i7-8700K', 'Intel', 'LGA1151', 90, 6, 12, 0],
  ['i7-9700k', 'Core i7-9700K', 'Intel', 'LGA1151', 92, 8, 8, 0],
  ['i3-10100', 'Core i3-10100', 'Intel', 'LGA1200', 62, 4, 8, 0],
  ['i5-10400f', 'Core i5-10400F', 'Intel', 'LGA1200', 80, 6, 12, 0],
  ['i5-11400f', 'Core i5-11400F', 'Intel', 'LGA1200', 92, 6, 12, 0],
  ['i7-10700k', 'Core i7-10700K', 'Intel', 'LGA1200', 98, 8, 16, 0],
  ['i5-11600k', 'Core i5-11600K', 'Intel', 'LGA1200', 105, 6, 12, 0],
  ['i3-12100f', 'Core i3-12100F', 'Intel', 'LGA1700', 88, 4, 8, 90],
  ['i5-12400f', 'Core i5-12400F', 'Intel', 'LGA1700', 100, 6, 12, 130],
  ['i5-13400f', 'Core i5-13400F', 'Intel', 'LGA1700', 110, 10, 16, 190],
  ['i5-12600k', 'Core i5-12600K', 'Intel', 'LGA1700', 118, 10, 16, 210],
  ['i7-12700k', 'Core i7-12700K', 'Intel', 'LGA1700', 132, 12, 20, 0],
  ['i5-13600k', 'Core i5-13600K', 'Intel', 'LGA1700', 138, 14, 20, 290],
  ['i5-14600k', 'Core i5-14600K', 'Intel', 'LGA1700', 143, 14, 20, 310],
  ['i7-13700k', 'Core i7-13700K', 'Intel', 'LGA1700', 152, 16, 24, 0],
  ['i7-14700k', 'Core i7-14700K', 'Intel', 'LGA1700', 162, 20, 28, 400],
  ['i9-13900k', 'Core i9-13900K', 'Intel', 'LGA1700', 162, 24, 32, 0],
  ['i9-14900k', 'Core i9-14900K', 'Intel', 'LGA1700', 172, 24, 32, 520],
  ['cu5-245k', 'Core Ultra 5 245K', 'Intel', 'LGA1851', 138, 14, 14, 280],
  ['cu7-265k', 'Core Ultra 7 265K', 'Intel', 'LGA1851', 152, 20, 20, 380],
  ['cu9-285k', 'Core Ultra 9 285K', 'Intel', 'LGA1851', 158, 24, 24, 560],
];

// Optional 8th value: custom match tokens (lowercase) for renderer strings.
const gpuRows = [
  // id, name, vendor, idx, vramGB, price, integrated?, tokens
  ['gtx-1050ti', 'GeForce GTX 1050 Ti', 'NVIDIA', 30, 4, 0],
  ['gtx-1650', 'GeForce GTX 1650', 'NVIDIA', 38, 4, 0],
  ['gtx-1650s', 'GeForce GTX 1650 Super', 'NVIDIA', 50, 4, 0],
  ['gtx-1060', 'GeForce GTX 1060', 'NVIDIA', 53, 6, 0],
  ['gtx-1660', 'GeForce GTX 1660', 'NVIDIA', 58, 6, 0],
  ['gtx-1660s', 'GeForce GTX 1660 Super', 'NVIDIA', 62, 6, 0],
  ['gtx-1660ti', 'GeForce GTX 1660 Ti', 'NVIDIA', 64, 6, 0],
  ['rtx-3050', 'GeForce RTX 3050', 'NVIDIA', 68, 8, 0],
  ['gtx-1070', 'GeForce GTX 1070', 'NVIDIA', 78, 8, 0],
  ['rtx-2060', 'GeForce RTX 2060', 'NVIDIA', 80, 6, 0],
  ['gtx-1080', 'GeForce GTX 1080', 'NVIDIA', 90, 8, 0],
  ['rtx-2060s', 'GeForce RTX 2060 Super', 'NVIDIA', 92, 8, 0],
  ['rtx-2070', 'GeForce RTX 2070', 'NVIDIA', 100, 8, 0],
  ['gtx-1080ti', 'GeForce GTX 1080 Ti', 'NVIDIA', 110, 11, 0],
  ['rtx-2070s', 'GeForce RTX 2070 Super', 'NVIDIA', 112, 8, 0],
  ['rtx-2080', 'GeForce RTX 2080', 'NVIDIA', 122, 8, 0],
  ['rtx-2080s', 'GeForce RTX 2080 Super', 'NVIDIA', 130, 8, 0],
  ['rtx-2080ti', 'GeForce RTX 2080 Ti', 'NVIDIA', 150, 11, 0],
  ['rtx-3060', 'GeForce RTX 3060', 'NVIDIA', 100, 12, 280],
  ['rtx-3060ti', 'GeForce RTX 3060 Ti', 'NVIDIA', 130, 8, 0],
  ['rtx-3070', 'GeForce RTX 3070', 'NVIDIA', 150, 8, 0],
  ['rtx-3070ti', 'GeForce RTX 3070 Ti', 'NVIDIA', 160, 8, 0],
  ['rtx-3080', 'GeForce RTX 3080', 'NVIDIA', 195, 10, 0],
  ['rtx-3080ti', 'GeForce RTX 3080 Ti', 'NVIDIA', 215, 12, 0],
  ['rtx-3090', 'GeForce RTX 3090', 'NVIDIA', 230, 24, 0],
  ['rtx-4060', 'GeForce RTX 4060', 'NVIDIA', 118, 8, 300],
  ['rtx-4060ti', 'GeForce RTX 4060 Ti', 'NVIDIA', 140, 8, 380],
  ['rtx-4070', 'GeForce RTX 4070', 'NVIDIA', 175, 12, 520],
  ['rtx-4070s', 'GeForce RTX 4070 Super', 'NVIDIA', 205, 12, 600],
  ['rtx-4070ti', 'GeForce RTX 4070 Ti', 'NVIDIA', 215, 12, 0],
  ['rtx-4070tis', 'GeForce RTX 4070 Ti Super', 'NVIDIA', 245, 16, 780],
  ['rtx-4080', 'GeForce RTX 4080', 'NVIDIA', 290, 16, 0],
  ['rtx-4080s', 'GeForce RTX 4080 Super', 'NVIDIA', 300, 16, 1000],
  ['rtx-4090', 'GeForce RTX 4090', 'NVIDIA', 400, 24, 1900],
  ['rtx-5060', 'GeForce RTX 5060', 'NVIDIA', 135, 8, 300],
  ['rtx-5060ti', 'GeForce RTX 5060 Ti', 'NVIDIA', 160, 16, 430],
  ['rtx-5070', 'GeForce RTX 5070', 'NVIDIA', 210, 12, 580],
  ['rtx-5070ti', 'GeForce RTX 5070 Ti', 'NVIDIA', 285, 16, 800],
  ['rtx-5080', 'GeForce RTX 5080', 'NVIDIA', 335, 16, 1100],
  ['rtx-5090', 'GeForce RTX 5090', 'NVIDIA', 480, 32, 2300],

  ['rx-580', 'Radeon RX 580', 'AMD', 50, 8, 0],
  ['rx-5600xt', 'Radeon RX 5600 XT', 'AMD', 85, 6, 0],
  ['rx-5700xt', 'Radeon RX 5700 XT', 'AMD', 105, 8, 0],
  ['rx-6600', 'Radeon RX 6600', 'AMD', 98, 8, 190],
  ['rx-6600xt', 'Radeon RX 6600 XT', 'AMD', 112, 8, 0],
  ['rx-6650xt', 'Radeon RX 6650 XT', 'AMD', 118, 8, 0],
  ['rx-6700xt', 'Radeon RX 6700 XT', 'AMD', 145, 12, 0],
  ['rx-6750xt', 'Radeon RX 6750 XT', 'AMD', 155, 12, 0],
  ['rx-6800', 'Radeon RX 6800', 'AMD', 185, 16, 0],
  ['rx-6800xt', 'Radeon RX 6800 XT', 'AMD', 205, 16, 0],
  ['rx-6900xt', 'Radeon RX 6900 XT', 'AMD', 225, 16, 0],
  ['rx-7600', 'Radeon RX 7600', 'AMD', 110, 8, 260],
  ['rx-7600xt', 'Radeon RX 7600 XT', 'AMD', 118, 16, 320],
  ['rx-7700xt', 'Radeon RX 7700 XT', 'AMD', 168, 12, 430],
  ['rx-7800xt', 'Radeon RX 7800 XT', 'AMD', 190, 16, 480],
  ['rx-7900gre', 'Radeon RX 7900 GRE', 'AMD', 210, 16, 0],
  ['rx-7900xt', 'Radeon RX 7900 XT', 'AMD', 245, 20, 650],
  ['rx-7900xtx', 'Radeon RX 7900 XTX', 'AMD', 290, 24, 800],
  ['rx-9060xt', 'Radeon RX 9060 XT', 'AMD', 150, 16, 380],
  ['rx-9070', 'Radeon RX 9070', 'AMD', 235, 16, 580],
  ['rx-9070xt', 'Radeon RX 9070 XT', 'AMD', 275, 16, 650],

  ['arc-a750', 'Intel Arc A750', 'Intel', 95, 8, 0, false, ['arc a750', ' a750']],
  ['arc-b570', 'Intel Arc B570', 'Intel', 105, 10, 220, false, ['arc b570', ' b570']],
  ['arc-b580', 'Intel Arc B580', 'Intel', 120, 12, 270, false, ['arc b580', ' b580']],

  ['igpu-intel-uhd', 'Intel UHD / HD Graphics (integrated)', 'Intel', 20, 1, 0, true, ['uhd graphics', 'hd graphics']],
  ['igpu-intel-iris', 'Intel Iris Xe / Arc iGPU (integrated)', 'Intel', 38, 2, 0, true, ['iris xe', 'iris(r) xe', 'iris plus', 'intel arc graphics']],
  ['igpu-amd-vega', 'AMD Radeon Vega (integrated)', 'AMD', 30, 2, 0, true, ['vega 3', 'vega 6', 'vega 7', 'vega 8', 'vega 10', 'vega 11']],
  ['igpu-amd-780m', 'AMD Radeon 780M / 890M (integrated)', 'AMD', 70, 4, 0, true, ['780m', '890m', '760m', '740m']],
  ['igpu-amd-generic', 'AMD Radeon Graphics (Ryzen integrated)', 'AMD', 45, 2, 0, true, ['radeon graphics']],
];

const stripPrefix = (n) => n.toLowerCase().replace(/^(geforce|radeon)\s+/, '');

export const CPUS = cpuRows.map(([id, name, vendor, socket, idx, cores, threads, price]) => ({
  id, name, vendor, socket, idx, cores, threads, price,
  label: `${vendor === 'AMD' ? 'AMD' : 'Intel'} ${name}`,
  q: `${vendor === 'AMD' ? 'AMD' : 'Intel'} ${name}`,
}));

export const GPUS = gpuRows.map(([id, name, vendor, idx, vram, price, integrated, tokens]) => ({
  id, name, vendor, idx, vram, price,
  integrated: !!integrated,
  tokens: tokens || [stripPrefix(name)],
  label: name,
  q: name,
}));

export const SOCKET_RAM = {
  AM4: ['DDR4'], AM5: ['DDR5'], LGA1151: ['DDR4'], LGA1200: ['DDR4'],
  LGA1700: ['DDR4', 'DDR5'], LGA1851: ['DDR5'],
};

// Rough reference prices (CHF) used for upgrade cost estimates.
export const COSTS = {
  board: 250,                                   // new mainboard when the socket changes
  ramKit: { DDR3: { 16: 50, 32: 100 }, DDR4: { 16: 60, 32: 120 }, DDR5: { 16: 100, 32: 190 } },
  nvme1tb: 70,
};

export const PRESETS = ['Competitive', 'Balanced', 'High', 'Ultra'];
export const RES_FACTOR = { 1080: 1, 1440: 0.68, 2160: 0.38 };

// Per game: cpu = FPS a CPU with index 100 reaches (CPU-bound ceiling),
// gpu = FPS a GPU with index 100 reaches at 1080p per preset,
// vram = VRAM (GB) needed at 1080p per preset, ramSens = 0..1 sensitivity to RAM/storage.
export const GAMES = [
  { id: 'valorant', name: 'Valorant', cpu: 420, cpuMul: [1, 0.98, 0.96, 0.94], gpu: [720, 620, 520, 430], vram: [2, 3, 3, 4], ramSens: 0.2 },
  { id: 'cs2', name: 'Counter-Strike 2', cpu: 230, cpuMul: [1, 0.97, 0.94, 0.9], gpu: [330, 230, 170, 130], vram: [3, 4, 5, 6], ramSens: 0.4 },
  { id: 'fortnite', name: 'Fortnite', cpu: 190, cpuMul: [1, 0.95, 0.9, 0.85], gpu: [300, 150, 100, 72], vram: [3, 5, 7, 9], ramSens: 0.6 },
  { id: 'warzone', name: 'Call of Duty: Warzone', cpu: 150, cpuMul: [1, 0.96, 0.92, 0.88], gpu: [170, 120, 90, 65], vram: [4, 6, 8, 10], ramSens: 1 },
  { id: 'apex', name: 'Apex Legends', cpu: 200, cpuMul: [1, 0.96, 0.92, 0.9], gpu: [260, 170, 125, 95], vram: [3, 5, 6, 8], ramSens: 0.7 },
  { id: 'r6', name: 'Rainbow Six Siege', cpu: 380, cpuMul: [1, 0.98, 0.95, 0.92], gpu: [480, 330, 250, 190], vram: [3, 4, 6, 8], ramSens: 0.5 },
  { id: 'gtav', name: 'GTA V', cpu: 190, cpuMul: [1, 0.97, 0.93, 0.9], gpu: [300, 200, 135, 95], vram: [2, 3, 4, 6], ramSens: 0.6 },
  { id: 'cp2077', name: 'Cyberpunk 2077', cpu: 120, cpuMul: [1, 0.97, 0.93, 0.88], gpu: [120, 90, 70, 55], vram: [4, 6, 8, 10], ramSens: 0.9 },
];

export const COMMON_HZ = [60, 75, 100, 120, 144, 165, 180, 240, 280, 360, 480];
