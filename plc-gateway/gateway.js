// ═══════════════════════════════════════════════════════════════════════════
// SIEGER OHC — PLC gateway (runs on the Master Mind PC)
//
// A web page cannot open a Modbus TCP connection itself, so this small program
// sits in between:   PLC  ⇄  Modbus TCP  ⇄  gateway.js  ⇄  WebSocket  ⇄  web page
//
//   node gateway.js                 (WebSocket on ws://localhost:8765)
//   GATEWAY_PORT=9000 node gateway.js
//
// The page sends the PLC address, the unit ID, the poll time and the list of
// register blocks to read (from the register map). The gateway polls the PLC and
// pushes every result back. Writes (brain commands) are only accepted when the
// page has enabled them.
// ═══════════════════════════════════════════════════════════════════════════
import http from 'node:http';
import { WebSocketServer } from 'ws';
import ModbusRTU from 'modbus-serial';

const PORT = Number(process.env.GATEWAY_PORT || 8765);
const VERSION = '1.0.0';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify({ service: 'sieger-plc-gateway', version: VERSION, websocket: `ws://localhost:${PORT}` }));
});
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  log('page connected from', req.socket.remoteAddress);
  const send = (msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
  let client = null;
  let settings = null;
  let timer = null;
  let wanted = false;
  let polling = false;
  let count = 0;
  let errors = 0;
  let retryDelay = 2000;   // exponential backoff: starts at 2 s
  const MAX_RETRY_DELAY = 30000;  // caps at 30 s

  const status = (state, message = '') => send({ type: 'status', state, message, host: settings?.host, port: settings?.port, unitId: settings?.unitId, count, errors });

  async function open() {
    if (!wanted || !settings) return;
    status('connecting', `Connecting to ${settings.host}:${settings.port} (unit ${settings.unitId})…`);
    try {
      client = new ModbusRTU();
      await client.connectTCP(settings.host, { port: settings.port });
      client.setID(settings.unitId);
      client.setTimeout(settings.timeoutMs);
      status('connected', `Connected to ${settings.host}:${settings.port}`);
      log('PLC connected', settings.host, settings.port);
      retryDelay = 2000;  // reset backoff on successful connect
      schedule(0);
    } catch (e) {
      errors += 1;
      status('error', `Cannot connect: ${e.message} (retry in ${Math.round(retryDelay / 1000)}s)`);
      log('connect failed:', e.message, `retry in ${retryDelay}ms`);
      close();
      if (wanted) {
        timer = setTimeout(open, retryDelay);
        retryDelay = Math.min(MAX_RETRY_DELAY, retryDelay * 2);
      }
    }
  }

  function close() {
    clearTimeout(timer);
    timer = null;
    try { client?.close(() => {}); } catch { /* ignore */ }
    client = null;
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  }

  async function readAll() {
    const words = {};
    const fn = settings.registerType === 'input' ? 'readInputRegisters' : 'readHoldingRegisters';
    for (const r of settings.requests) {
      const res = await client[fn](r.start, r.count);
      if (!words[r.block]) words[r.block] = [];
      res.data.forEach((v, i) => { words[r.block][r.offset + i] = v; });
    }
    return words;
  }

  async function poll() {
    if (!wanted || !client || polling) return;
    polling = true;
    const t0 = Date.now();
    try {
      const words = await readAll();
      count += 1;
      send({ type: 'data', t: Date.now(), words, durationMs: Date.now() - t0, count, errors });
    } catch (e) {
      errors += 1;
      status('error', `Read failed: ${e.message} — reconnecting in ${Math.round(retryDelay / 1000)}s`);
      log('read failed:', e.message);
      polling = false;
      close();
      if (wanted) {
        timer = setTimeout(open, retryDelay);
        retryDelay = Math.min(MAX_RETRY_DELAY, retryDelay * 2);
      }
      return;
    }
    polling = false;
    if (wanted) schedule(Math.max(50, settings.pollMs - (Date.now() - t0)));
  }

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return send({ type: 'error', message: 'Bad message' }); }
    if (msg.type === 'connect') {
      settings = {
        host: String(msg.host || '192.168.0.1'),
        port: Number(msg.port) || 502,
        unitId: Number(msg.unitId) || 1,
        pollMs: Math.max(100, Number(msg.pollMs) || 1000),
        timeoutMs: Math.max(200, Number(msg.timeoutMs) || 1500),
        registerType: msg.registerType === 'input' ? 'input' : 'holding',
        requests: Array.isArray(msg.requests) ? msg.requests : [],
        allowWrite: !!msg.allowWrite,
      };
      wanted = true;
      close();
      count = 0;
      errors = 0;
      open();
    } else if (msg.type === 'disconnect') {
      wanted = false;
      close();
      status('disconnected', 'Disconnected');
      log('PLC disconnected by page');
    } else if (msg.type === 'write') {
      if (!settings?.allowWrite) return send({ type: 'error', message: 'Writing is disabled — enable "Allow brain to write" on the page.' });
      if (!client) return send({ type: 'error', message: 'Not connected to the PLC.' });
      try {
        await client.writeRegisters(Number(msg.start), msg.values.map((v) => Math.max(0, Math.min(65535, Math.round(v)))));
        send({ type: 'written', start: msg.start, count: msg.values.length });
      } catch (e) {
        send({ type: 'error', message: `Write failed: ${e.message}` });
      }
    }
  });

  ws.on('close', () => { wanted = false; close(); log('page disconnected'); });
  send({ type: 'hello', version: VERSION });
});

server.listen(PORT, () => log(`SIEGER PLC gateway ${VERSION} — WebSocket ws://localhost:${PORT} (open the setup page → PLC data source)`));
