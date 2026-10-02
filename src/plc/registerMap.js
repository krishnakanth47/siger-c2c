// ═══════════════════════════════════════════════════════════════════════════
// SIEGER OHC — Modbus register map between the PLC and the Master Mind PC
// Built from the plant setup, so the number of loaders / unloaders / stations /
// baskets always matches. Addresses are 0-based holding-register offsets
// (classic notation: 4xxxx = 40001 + offset). Every value is one 16-bit word.
// The base address of each block can be changed to match the PLC program.
// Pure JavaScript — used by the web page, the gateway and the PLC simulator.
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_BASES = {
  system: 0,      // 16 words
  loaders: 100,   // 8 words per loader
  unloaders: 300, // 6 words per unloader
  stations: 400,  // 8 words per pallet station
  baskets: 1000,  // 4 words per basket (tracking table)
  commands: 3000, // brain → PLC (written by the brain)
};

export const SYSTEM_FIELDS = [
  { key: 'plcHeartbeat', desc: 'PLC heartbeat (counts up every cycle)', unit: '' },
  { key: 'plcMode', desc: 'PLC mode: 0 manual · 1 auto FIFO · 2 auto brain', unit: 'enum' },
  { key: 'chainRunning', desc: 'Chain running 0/1', unit: 'bool' },
  { key: 'speedX10', desc: 'Chain speed × 10', unit: 'm/min ×10' },
  { key: 'pulsesHi', desc: 'Pitch pulse counter — high word', unit: '' },
  { key: 'pulsesLo', desc: 'Pitch pulse counter — low word', unit: '' },
  { key: 'r0Basket', desc: 'Basket ID last read at R0 (origin RFID reader)', unit: 'ID' },
  { key: 'encoderX1000', desc: 'Encoder: part of a pitch moved since last pulse × 1000', unit: '‰' },
  { key: 'faultWord', desc: 'Fault bits: 0 e-stop · 1 chain · 2 RFID R0 · 3 comms', unit: 'bits' },
  { key: 'homeCheck', desc: 'R0 home check: 0 unknown · 1 OK · 2 error', unit: 'enum' },
  { key: 'loops', desc: 'Loops completed (B001 seen at R0)', unit: '' },
  { key: 'spare11', desc: 'spare', unit: '' },
  { key: 'spare12', desc: 'spare', unit: '' },
  { key: 'spare13', desc: 'spare', unit: '' },
  { key: 'spare14', desc: 'spare', unit: '' },
  { key: 'spare15', desc: 'spare', unit: '' },
];

export const LOADER_FIELDS = [
  { key: 'cones', desc: 'Cones waiting in loader buffer (all lots)', unit: 'cones' },
  { key: 'oldLotCones', desc: 'Of those, cones of the old lot (after a lot change)', unit: 'cones' },
  { key: 'status', desc: 'Loader: 0 idle · 1 ready · 2 loading · 3 fault · 4 manual · 5 off', unit: 'enum' },
  { key: 'stopped', desc: 'Autoconer stopped (buffer full) 0/1', unit: 'bool' },
  { key: 'variety', desc: 'Variety code (1 = first variety of the setup)', unit: 'code' },
  { key: 'lot', desc: 'Current lot number', unit: '' },
  { key: 'loadedCount', desc: 'Cones loaded counter (wraps at 65535)', unit: 'cones' },
  { key: 'basketInFront', desc: 'Basket ID read by this loader’s RFID reader', unit: 'ID' },
];

export const UNLOADER_FIELDS = [
  { key: 'status', desc: 'Unloader: 0 ready · 1 busy · 2 fault · 3 manual', unit: 'enum' },
  { key: 'basketInFront', desc: 'Basket ID read by this unloader’s RFID reader', unit: 'ID' },
  { key: 'unloadedCount', desc: 'Cones unloaded counter (wraps at 65535)', unit: 'cones' },
  { key: 'cycleX10', desc: 'Last unloading cycle time × 10', unit: 's ×10' },
  { key: 'spare4', desc: 'spare', unit: '' },
  { key: 'spare5', desc: 'spare', unit: '' },
];

export const STATION_FIELDS = [
  { key: 'status', desc: 'Pallet station: 0 free · 1 active · 2 held · 3 out of service', unit: 'enum' },
  { key: 'variety', desc: 'Variety code on this pallet (0 = none)', unit: 'code' },
  { key: 'lot', desc: 'Lot number on this pallet', unit: '' },
  { key: 'acc', desc: 'Cones in the accumulator', unit: 'cones' },
  { key: 'pallet', desc: 'Cones on the pallet', unit: 'cones' },
  { key: 'palletPresent', desc: 'Empty/partial pallet present 0/1', unit: 'bool' },
  { key: 'palletsDone', desc: 'Full pallets dispatched counter', unit: '' },
  { key: 'spare7', desc: 'spare', unit: '' },
];

export const BASKET_FIELDS = [
  { key: 'state', desc: 'Basket: 0 empty · 1 loaded · 2 loaded and returned (passed all unloaders)', unit: 'enum' },
  { key: 'variety', desc: 'Variety code of the cone (0 = none)', unit: 'code' },
  { key: 'lot', desc: 'Lot number of the cone', unit: '' },
  { key: 'target', desc: 'Target pallet station (1 = P01, 0 = none)', unit: 'code' },
];

// brain → PLC
export const COMMAND_SYSTEM_FIELDS = [
  { key: 'brainHeartbeat', desc: 'Brain heartbeat (PLC falls back to FIFO if it stops)', unit: '' },
  { key: 'brainActive', desc: 'Brain requests control 0/1', unit: 'bool' },
];
export const COMMAND_LOADER_FIELDS = [
  { key: 'permit', desc: 'PERMIT_LOAD 0/1', unit: 'bool' },
  { key: 'pace', desc: 'LOAD_PACE — load every Nth basket', unit: 'baskets' },
  { key: 'station', desc: 'STATION — target pallet station (1 = P01)', unit: 'code' },
  { key: 'trigger', desc: 'Triggering count decided by the brain', unit: 'cones' },
];
export const COMMAND_STATION_FIELDS = [
  { key: 'variety', desc: 'Assign variety code to station', unit: 'code' },
  { key: 'lot', desc: 'Assign lot number to station', unit: '' },
  { key: 'command', desc: '0 none · 1 assign · 2 change over (dispatch partial pallet)', unit: 'enum' },
  { key: 'spare', desc: 'spare', unit: '' },
];

const pad = (n, w = 2) => String(n).padStart(w, '0');

// The full map for a plant: blocks to read + every register described
export function buildRegisterMap(cfg, bases = DEFAULT_BASES) {
  const B = { ...DEFAULT_BASES, ...bases };
  const nL = cfg.loaderCount;
  const nU = cfg.unloaderCount;
  const nS = cfg.palletStations;
  const nB = cfg.basketCount;
  const blocks = [
    { name: 'system', start: B.system, count: SYSTEM_FIELDS.length, stride: SYSTEM_FIELDS.length, items: 1, fields: SYSTEM_FIELDS, label: () => 'System' },
    { name: 'loaders', start: B.loaders, count: nL * LOADER_FIELDS.length, stride: LOADER_FIELDS.length, items: nL, fields: LOADER_FIELDS, label: (i) => `L${pad(i + 1)}` },
    { name: 'unloaders', start: B.unloaders, count: nU * UNLOADER_FIELDS.length, stride: UNLOADER_FIELDS.length, items: nU, fields: UNLOADER_FIELDS, label: (i) => `U${pad(i + 1)}` },
    { name: 'stations', start: B.stations, count: nS * STATION_FIELDS.length, stride: STATION_FIELDS.length, items: nS, fields: STATION_FIELDS, label: (i) => `P${pad(i + 1)}` },
    { name: 'baskets', start: B.baskets, count: nB * BASKET_FIELDS.length, stride: BASKET_FIELDS.length, items: nB, fields: BASKET_FIELDS, label: (i) => `B${pad(i + 1, 3)}` },
  ];
  const cmdSysLen = 10;
  const commandBlocks = [
    { name: 'cmdSystem', start: B.commands, count: COMMAND_SYSTEM_FIELDS.length, stride: COMMAND_SYSTEM_FIELDS.length, items: 1, fields: COMMAND_SYSTEM_FIELDS, label: () => 'Brain' },
    { name: 'cmdLoaders', start: B.commands + cmdSysLen, count: nL * COMMAND_LOADER_FIELDS.length, stride: COMMAND_LOADER_FIELDS.length, items: nL, fields: COMMAND_LOADER_FIELDS, label: (i) => `L${pad(i + 1)}` },
    { name: 'cmdStations', start: B.commands + cmdSysLen + nL * COMMAND_LOADER_FIELDS.length, count: nS * COMMAND_STATION_FIELDS.length, stride: COMMAND_STATION_FIELDS.length, items: nS, fields: COMMAND_STATION_FIELDS, label: (i) => `P${pad(i + 1)}` },
  ];
  // Overlap check
  const all = [...blocks, ...commandBlocks].map((b) => ({ n: b.name, a: b.start, z: b.start + b.count - 1 })).sort((x, y) => x.a - y.a);
  const overlaps = [];
  for (let i = 1; i < all.length; i++) if (all[i].a <= all[i - 1].z) overlaps.push(`${all[i - 1].n} (${all[i - 1].a}–${all[i - 1].z}) overlaps ${all[i].n} (${all[i].a}–${all[i].z})`);
  return { bases: B, blocks, commandBlocks, overlaps };
}

// One row per register — for the table on the page and the CSV for the PLC programmer
export function registerRows(map, { maxItemsPerBlock = Infinity } = {}) {
  const rows = [];
  const add = (b, dir) => {
    for (let i = 0; i < Math.min(b.items, maxItemsPerBlock); i++) {
      b.fields.forEach((f, j) => {
        const addr = b.start + i * b.stride + j;
        rows.push({ dir, block: b.name, item: b.label(i), key: f.key, desc: f.desc, unit: f.unit, address: addr, modbus: 40001 + addr });
      });
    }
  };
  map.blocks.forEach((b) => add(b, 'PLC → brain (read)'));
  map.commandBlocks.forEach((b) => add(b, 'brain → PLC (write)'));
  return rows;
}

export function registerCsv(map) {
  const rows = registerRows(map);
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return ['Direction,Block,Item,Tag,Description,Unit,Offset (0-based),Modbus address (4xxxx)']
    .concat(rows.map((r) => [r.dir, r.block, r.item, `${r.item}.${r.key}`, r.desc, r.unit, r.address, r.modbus].map(esc).join(',')))
    .join('\n');
}

// Read requests: Modbus allows at most 125 registers per read — split every block
export function readRequests(map, maxLen = 120) {
  const reqs = [];
  map.blocks.forEach((b) => {
    for (let off = 0; off < b.count; off += maxLen) reqs.push({ block: b.name, start: b.start + off, count: Math.min(maxLen, b.count - off), offset: off });
  });
  return reqs;
}

// Registers (per block, arrays of words) → structured snapshot
export function decodeSnapshot(map, words) {
  const out = {};
  map.blocks.forEach((b) => {
    const arr = words[b.name] || [];
    const items = [];
    for (let i = 0; i < b.items; i++) {
      const o = {};
      b.fields.forEach((f, j) => { o[f.key] = arr[i * b.stride + j] ?? 0; });
      items.push(o);
    }
    out[b.name] = b.name === 'system' ? items[0] : items;
  });
  const s = out.system || {};
  s.pulses = ((s.pulsesHi || 0) * 65536) + (s.pulsesLo || 0);
  s.speed = (s.speedX10 || 0) / 10;
  s.encoder = (s.encoderX1000 || 0) / 1000;
  return out;
}

// Structured snapshot → registers (per block). Used by the simulators.
export function encodeSnapshot(map, snap) {
  const words = {};
  map.blocks.forEach((b) => {
    const arr = Array.from({ length: b.count }, () => 0);
    const items = b.name === 'system' ? [snap.system] : snap[b.name] || [];
    for (let i = 0; i < b.items; i++) {
      const o = items[i] || {};
      b.fields.forEach((f, j) => { arr[i * b.stride + j] = clampWord(o[f.key]); });
    }
    words[b.name] = arr;
  });
  return words;
}

export const clampWord = (v) => Math.max(0, Math.min(65535, Math.round(Number(v) || 0)));
