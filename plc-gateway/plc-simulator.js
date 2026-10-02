// ═══════════════════════════════════════════════════════════════════════════
// SIEGER OHC — Modbus TCP PLC simulator (for testing without the real PLC)
//
// Answers Modbus TCP exactly like the real PLC should, using the register map,
// with random but consistent plant values built from the plant setup.
//
//   node plc-simulator.js                         (port 5020, customer defaults)
//   node plc-simulator.js --port 502 --setup my-setup.json
//
// my-setup.json = "Download setup" on the PLC data source page.
// Then on the page choose "Actual PLC", host 127.0.0.1, port 5020, Connect.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import ModbusRTU from 'modbus-serial';
import { DEFAULT_CONFIG, normaliseConfig } from '../src/dynamic/config.js';
import { buildRegisterMap, encodeSnapshot } from '../src/plc/registerMap.js';
import { createSimPlc } from '../src/plc/simulatedPlc.js';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const port = Number(arg('port', 5020));
const unitId = Number(arg('unit', 1));
const setupFile = arg('setup', null);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

let cfg = normaliseConfig(DEFAULT_CONFIG);
let bases;
if (setupFile) {
  const j = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
  cfg = normaliseConfig(j.setup || j);
  bases = j.bases;
  log(`setup loaded from ${setupFile}`);
}
const map = buildRegisterMap(cfg, bases);
const sim = createSimPlc(cfg, { seed: Date.now() % 100000 });
const regs = new Uint16Array(65536);

function refresh() {
  sim.step(1);
  const words = encodeSnapshot(map, sim.snapshot());
  map.blocks.forEach((b) => words[b.name].forEach((v, i) => { regs[b.start + i] = v; }));
}
refresh();
setInterval(refresh, 1000);

const vector = {
  getHoldingRegister: (addr) => regs[addr],
  getInputRegister: (addr) => regs[addr],
  getCoil: () => false,
  getDiscreteInput: () => false,
  setRegister: (addr, value) => {
    regs[addr] = value;
    const cmd = map.commandBlocks.find((b) => addr >= b.start && addr < b.start + b.count);
    if (cmd) {
      const off = addr - cmd.start;
      const item = cmd.label(Math.floor(off / cmd.stride));
      const field = cmd.fields[off % cmd.stride];
      log(`brain wrote ${item}.${field.key} = ${value}  (address ${addr})`);
    }
  },
  setCoil: () => {},
};

const server = new ModbusRTU.ServerTCP(vector, { host: '0.0.0.0', port, unitID: unitId, debug: false });
server.on('socketError', (e) => log('socket error', e.message));
server.on('initialized', () => log(`Simulated SIEGER PLC on Modbus TCP port ${port}, unit ${unitId} — ${cfg.loaderCount} loaders, ${cfg.unloaderCount} unloaders, ${cfg.palletStations} stations, ${cfg.basketCount} baskets`));
log(`Register blocks: ${map.blocks.map((b) => `${b.name} ${b.start}–${b.start + b.count - 1}`).join(' · ')}`);
