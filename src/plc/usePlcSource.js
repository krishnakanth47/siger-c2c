// Data source for the PLC page: either the real PLC through the gateway (Modbus TCP),
// or the simulated PLC running in the browser. Both deliver the same registers.
import { useEffect, useRef, useState } from 'react';
import { buildRegisterMap, readRequests, decodeSnapshot, encodeSnapshot } from './registerMap';
import { createSimPlc } from './simulatedPlc';

export const PLC_SETTINGS_KEY = 'sieger-plc-settings-v1';

export const DEFAULT_PLC_SETTINGS = {
  mode: 'SIM',                    // SIM = simulation, PLC = actual PLC
  gatewayUrl: 'ws://localhost:8765',
  host: '192.168.0.10',
  port: 502,
  unitId: 1,
  pollMs: 1000,
  timeoutMs: 1500,
  registerType: 'holding',
  allowWrite: false,
  bases: null,                    // null = default addresses
  simVariation: 25,               // ± % random variation of autoconer output
  simSeed: 12345,
};

export function loadPlcSettings() {
  try {
    const raw = window.localStorage.getItem(PLC_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_PLC_SETTINGS, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return { ...DEFAULT_PLC_SETTINGS };
}
export function savePlcSettings(s) {
  try { window.localStorage.setItem(PLC_SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function usePlcSource(cfg, settings) {
  const map = buildRegisterMap(cfg, settings.bases || undefined);
  const mapKey = JSON.stringify([cfg.loaderCount, cfg.unloaderCount, cfg.palletStations, cfg.basketCount, settings.bases]);
  const [state, setState] = useState({ running: false, link: 'idle', message: '', snap: null, words: null, at: 0, count: 0, errors: 0, durationMs: 0 });
  const prevRef = useRef(null);
  const wsRef = useRef(null);
  const simRef = useRef(null);
  const timerRef = useRef(null);
  const mapRef = useRef(map);
  mapRef.current = map;

  const deliver = (words, extra = {}) => {
    const snap = decodeSnapshot(mapRef.current, words);
    setState((s) => {
      prevRef.current = s.snap ? { snap: s.snap, at: s.at } : null;
      return { ...s, snap, words, at: Date.now(), count: s.count + 1, ...extra };
    });
  };

  const stop = () => {
    return new Promise((resolve) => {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        try { ws.send(JSON.stringify({ type: 'disconnect' })); } catch { /* closed */ }
        // Wait for the close event or a short timeout to ensure clean shutdown
        const timeout = setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 500);
        ws.addEventListener('close', () => { clearTimeout(timeout); resolve(); }, { once: true });
        try { ws.close(); } catch { clearTimeout(timeout); resolve(); }
      } else {
        resolve();
      }
      setState((s) => ({ ...s, running: false, link: 'idle', message: 'Stopped' }));
    });
  };

  const startSim = async () => {
    await stop();
    simRef.current = createSimPlc(cfg, { seed: settings.simSeed, variation: settings.simVariation / 100 });
    setState({ running: true, link: 'sim', message: 'Simulated PLC running in this page', snap: null, words: null, at: 0, count: 0, errors: 0, durationMs: 0 });
    const tick = () => {
      simRef.current.step(1);
      deliver(encodeSnapshot(mapRef.current, simRef.current.snapshot()));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  };

  const startPlc = async () => {
    await stop();
    setState({ running: true, link: 'gateway', message: `Opening gateway ${settings.gatewayUrl}…`, snap: null, words: null, at: 0, count: 0, errors: 0, durationMs: 0 });
    let ws;
    try {
      ws = new WebSocket(settings.gatewayUrl);
    } catch (e) {
      setState((s) => ({ ...s, running: false, link: 'error', message: `Bad gateway address: ${e.message}` }));
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      setState((s) => ({ ...s, link: 'gateway', message: 'Gateway reached — connecting to the PLC…' }));
      ws.send(JSON.stringify({
        type: 'connect', host: settings.host, port: settings.port, unitId: settings.unitId, pollMs: settings.pollMs,
        timeoutMs: settings.timeoutMs, registerType: settings.registerType, allowWrite: settings.allowWrite,
        requests: readRequests(mapRef.current),
      }));
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'data') deliver(msg.words, { link: 'plc', message: `Reading ${settings.host}:${settings.port}`, errors: msg.errors, durationMs: msg.durationMs });
      else if (msg.type === 'status') setState((s) => ({ ...s, link: msg.state === 'connected' ? 'plc' : msg.state === 'error' ? 'error' : 'gateway', message: msg.message, errors: msg.errors ?? s.errors }));
      else if (msg.type === 'error') setState((s) => ({ ...s, message: msg.message }));
      else if (msg.type === 'written') setState((s) => ({ ...s, message: `Wrote ${msg.count} register(s) at ${msg.start}` }));
    };
    ws.onerror = () => setState((s) => ({ ...s, link: 'error', message: `Cannot reach the gateway at ${settings.gatewayUrl}. Is "node gateway.js" running on this PC?` }));
    ws.onclose = () => { if (wsRef.current === ws) { wsRef.current = null; setState((s) => ({ ...s, running: false, link: s.link === 'error' ? 'error' : 'idle' })); } };
  };

  const write = (start, values) => {
    if (!wsRef.current) return false;
    wsRef.current.send(JSON.stringify({ type: 'write', start, values }));
    return true;
  };

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Restart the simulation at once when the plant size, the seed or the variation changes
  useEffect(() => { if (state.running && state.link === 'sim') startSim(); }, [mapKey, settings.simSeed, settings.simVariation]); // eslint-disable-line react-hooks/exhaustive-deps

  return { map, state, prev: prevRef.current, startSim, startPlc, stop, write };
}
