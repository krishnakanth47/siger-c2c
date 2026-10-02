import React, { useMemo, useState } from 'react';
import { Cable, Cpu, Play, Square, Download, CheckCircle2, AlertTriangle, XCircle, Radio, Database, History } from 'lucide-react';
import { derive, normaliseConfig, fmtDuration, varietyInfo, setVarietyNames } from './config';
import { DEFAULT_BASES, registerRows, registerCsv } from '../plc/registerMap';
import { analyzeSnapshot, basketPositionM } from '../plc/analyze';
import { usePlcSource, loadPlcSettings, savePlcSettings } from '../plc/usePlcSource';
import SetupTabs from './SetupTabs';
import './dynamic.css';

const LOADER_STATUS = ['idle', 'ready', 'loading', 'fault', 'manual', 'off'];
const UNLOADER_STATUS = ['ready', 'busy', 'fault', 'manual'];
const STATION_STATUS = ['free', 'active', 'held', 'out of service'];
const BASKET_STATE = ['empty', 'loaded', 'returned'];
const PLC_MODE = ['manual', 'auto FIFO', 'auto brain'];

function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Num({ label, value, onChange, min, max, step = 1, unit, width }) {
  return (
    <label className="dyn-field" style={width ? { maxWidth: width } : undefined}>
      <span>{label}</span>
      <div className="dyn-input">
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  );
}

function Tile({ k, v, bad }) {
  return <div className={`plc-tile ${bad ? 'bad' : ''}`}><b>{v}</b><span>{k}</span></div>;
}

export default function PlcPage({ config, onTab, onClassic }) {
  const cfg = useMemo(() => normaliseConfig(config), [config]);
  setVarietyNames(cfg.varietyName);
  const d = useMemo(() => derive(cfg), [cfg]);
  const [settings, setSettings] = useState(loadPlcSettings);
  const set = (k, v) => setSettings((s) => { const n = { ...s, [k]: v }; savePlcSettings(n); return n; });
  const src = usePlcSource(cfg, settings);
  const { state, map } = src;
  const [view, setView] = useState('loaders');
  const snap = state.snap;
  const an = snap ? analyzeSnapshot(d, snap, src.prev) : null;
  const age = state.at ? Math.round((Date.now() - state.at) / 1000) : null;
  const bases = settings.bases || DEFAULT_BASES;
  const vn = (code) => (code >= 1 && code <= cfg.varieties ? cfg.varietyName[code - 1] : code ? `code ${code}` : '—');
  const vc = (code) => (code >= 1 ? varietyInfo(code - 1).color : '#334155');

  const connected = state.running && (state.link === 'plc' || state.link === 'sim');
  const linkText = { idle: 'Not connected', sim: 'SIMULATION', gateway: 'GATEWAY', plc: 'PLC ONLINE', error: 'ERROR' }[state.link] || state.link;

  return (
    <div className="dyn-page">
      <header className="dyn-top">
        <div className="dyn-brand">
          <div className="brand-badge">SIEGER</div>
          <div>
            <h1>OHC plant setup — PLC data source</h1>
            <p>Where the Master Mind gets its live data: the real PLC over Modbus TCP, or a simulated PLC with random values built from the plant setup.</p>
          </div>
        </div>
        <div className="dyn-top-actions">
          <button className="dyn-btn ghost" onClick={onClassic}><History size={14} /> Classic demo</button>
        </div>
      </header>
      <SetupTabs tab="plc" onTab={onTab} />

      <div className="plc-modes">
        <button className={`plc-mode ${settings.mode === 'PLC' ? 'on' : ''}`} onClick={() => { src.stop(); set('mode', 'PLC'); }}>
          <Cable size={22} />
          <div><b>Actual PLC data</b><span>Modbus TCP through the PLC gateway on this PC</span></div>
        </button>
        <button className={`plc-mode ${settings.mode === 'SIM' ? 'on' : ''}`} onClick={() => { src.stop(); set('mode', 'SIM'); }}>
          <Cpu size={22} />
          <div><b>Simulation</b><span>Random but realistic values from the plant setup — no PLC needed</span></div>
        </button>
      </div>

      <div className="dyn-setup-grid">
        <div className="dyn-setup-forms">
          {settings.mode === 'PLC' ? (
            <section className="dyn-card">
              <h2><Cable size={15} /> PLC connection (Modbus TCP)</h2>
              <div className="dyn-fields">
                <label className="dyn-field"><span>PLC IP address</span><div className="dyn-input"><input type="text" value={settings.host} onChange={(e) => set('host', e.target.value.trim())} /></div></label>
                <Num label="Modbus TCP port" value={settings.port} onChange={(v) => set('port', v)} min={1} max={65535} />
                <Num label="Unit ID (slave ID)" value={settings.unitId} onChange={(v) => set('unitId', v)} min={0} max={255} />
                <Num label="Poll every" value={settings.pollMs} onChange={(v) => set('pollMs', v)} min={100} max={60000} step={100} unit="ms" />
                <Num label="Timeout" value={settings.timeoutMs} onChange={(v) => set('timeoutMs', v)} min={200} max={10000} step={100} unit="ms" />
                <label className="dyn-field"><span>Register type</span>
                  <select value={settings.registerType} onChange={(e) => set('registerType', e.target.value)}>
                    <option value="holding">Holding registers (FC 03, 4xxxx)</option>
                    <option value="input">Input registers (FC 04, 3xxxx)</option>
                  </select>
                </label>
                <label className="dyn-field"><span>Gateway address (on this PC)</span><div className="dyn-input"><input type="text" value={settings.gatewayUrl} onChange={(e) => set('gatewayUrl', e.target.value.trim())} /></div></label>
                <label className="dyn-field plc-check"><input type="checkbox" checked={settings.allowWrite} onChange={(e) => set('allowWrite', e.target.checked)} /> <span>Allow the brain to write commands to the PLC</span></label>
              </div>
              <div className="plc-actions">
                {state.running
                  ? <button className="dyn-btn warn" onClick={src.stop}><Square size={14} /> Disconnect</button>
                  : <button className="dyn-btn primary" onClick={src.startPlc}><Play size={14} /> Connect to PLC</button>}
                {state.running && settings.allowWrite && state.link === 'plc' && (
                  <button className="dyn-btn" onClick={() => src.write(map.commandBlocks[0].start, [Date.now() % 65536, 0])}>Write test heartbeat</button>
                )}
              </div>
              <p className="dyn-note">
                A web page cannot open a Modbus connection itself, so the small <b>PLC gateway</b> runs on this PC and talks to the PLC:
                in the project folder run <code>npm run plc:install</code> once, then <code>npm run plc:gateway</code>.
                To test without the real PLC, also run <code>npm run plc:simulator</code> and connect to <b>127.0.0.1</b>, port <b>5020</b>.
              </p>
            </section>
          ) : (
            <section className="dyn-card">
              <h2><Cpu size={15} /> Simulated PLC</h2>
              <p className="dyn-note" style={{ marginTop: 0 }}>
                Values are generated from the plant setup: {cfg.loaderCount} loaders with their varieties and cones/h, {cfg.basketCount} baskets moving at {cfg.speedMPerMin} m/min,
                {' '}{cfg.unloaderCount} unloaders and {cfg.palletStations} pallet stations. Autoconer output varies randomly, the chain sometimes stops, pallets fill and are dispatched —
                exactly the registers the real PLC will send.
              </p>
              <div className="dyn-fields">
                <Num label="Random variation of autoconer output" value={settings.simVariation} onChange={(v) => set('simVariation', v)} min={0} max={80} unit="± %" />
                <Num label="Random seed — same number = same plant state again; another number = another state" value={settings.simSeed} onChange={(v) => set('simSeed', v)} min={1} max={999999} />
              </div>
              <div className="plc-actions">
                {state.running
                  ? <button className="dyn-btn warn" onClick={src.stop}><Square size={14} /> Stop simulation</button>
                  : <button className="dyn-btn primary" onClick={src.startSim}><Play size={14} /> Start simulated PLC</button>}
                <button className="dyn-btn" onClick={() => { set('simSeed', Math.floor(Math.random() * 999999) + 1); }}>New random plant</button>
              </div>
            </section>
          )}

          {snap && an && (
            <>
              <section className="dyn-card">
                <h2><Radio size={15} /> Live data <em className="dyn-h2note">{settings.mode === 'SIM' ? 'simulated PLC' : `${settings.host}:${settings.port}`} · read #{state.count}{state.durationMs ? ` in ${state.durationMs} ms` : ''}</em></h2>
                <div className="plc-tiles">
                  <Tile k="PLC heartbeat" v={snap.system.plcHeartbeat} />
                  <Tile k="PLC mode" v={PLC_MODE[snap.system.plcMode] || snap.system.plcMode} />
                  <Tile k="chain" v={snap.system.chainRunning ? `${snap.system.speed} m/min` : 'STOPPED'} bad={!snap.system.chainRunning} />
                  <Tile k="pulse counter" v={snap.system.pulses} />
                  <Tile k="R0 reading" v={snap.system.r0Basket ? `B${String(snap.system.r0Basket).padStart(3, '0')}` : '—'} />
                  <Tile k="home check · loops" v={`${['?', 'OK', 'ERROR'][snap.system.homeCheck] || '?'} · ${snap.system.loops}`} bad={snap.system.homeCheck === 2} />
                  <Tile k="baskets loaded / empty" v={`${an.info.loaded} / ${an.info.empty}`} />
                  <Tile k="varieties on loop" v={an.info.varietiesOnLoop} />
                  <Tile k="autoconers stopped" v={snap.loaders.filter((l) => l.stopped).length} bad={snap.loaders.some((l) => l.stopped)} />
                  <Tile k="loaders loading" v={snap.loaders.filter((l) => l.status === 2).length} />
                </div>
                <div className="plc-checks">
                  {an.checks.length === 0
                    ? <div className="dyn-msg ok"><CheckCircle2 size={14} /> All PLC values are consistent with the plant setup.</div>
                    : an.checks.slice(0, 8).map((c, i) => <div key={i} className={`dyn-msg ${c.level === 'error' ? 'error' : 'warn'}`}>{c.level === 'error' ? <XCircle size={14} /> : <AlertTriangle size={14} />} {c.msg}</div>)}
                  {an.checks.length > 8 && <div className="dyn-muted">…and {an.checks.length - 8} more</div>}
                </div>
              </section>

              <section className="dyn-card">
                <div className="plc-subtabs">
                  {[['loaders', `Loaders (${cfg.loaderCount})`], ['unloaders', `Unloaders (${cfg.unloaderCount})`], ['stations', `Pallet stations (${cfg.palletStations})`], ['baskets', `Baskets (${an.info.loaded} loaded)`], ['raw', 'Raw registers']].map(([k, t]) => (
                    <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{t}</button>
                  ))}
                </div>
                {view === 'loaders' && (
                  <table className="plc-table">
                    <thead><tr><th>Loader</th><th>Variety (PLC)</th><th>Lot</th><th>Cones waiting</th><th>Old lot</th><th>Status</th><th>Autoconer</th><th>Loaded</th><th>Basket in front</th></tr></thead>
                    <tbody>
                      {snap.loaders.map((l, i) => {
                        const mismatch = l.variety !== cfg.loaderVariety[i] + 1;
                        const pct = Math.min(100, (l.cones / cfg.loaderBufferCones) * 100);
                        return (
                          <tr key={i}>
                            <td className="mono">L{String(i + 1).padStart(2, '0')}</td>
                            <td><i className="dot" style={{ background: vc(l.variety) }} />{vn(l.variety)}{mismatch && <em className="bad"> ≠ setup</em>}</td>
                            <td className="mono">{l.lot}</td>
                            <td><span className="buf-bar"><span style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--accent-rose)' : pct >= 70 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }} /></span><span className="mono">{l.cones}/{cfg.loaderBufferCones}</span></td>
                            <td className="mono">{l.oldLotCones || ''}</td>
                            <td>{LOADER_STATUS[l.status] || l.status}</td>
                            <td className={l.stopped ? 'bad' : ''}>{l.stopped ? 'STOPPED' : 'running'}</td>
                            <td className="mono">{l.loadedCount}</td>
                            <td className="mono">{l.basketInFront ? `B${String(l.basketInFront).padStart(3, '0')}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {view === 'unloaders' && (
                  <table className="plc-table">
                    <thead><tr><th>Unloader</th><th>Status</th><th>Basket in front</th><th>Unloaded</th><th>Last cycle</th><th>Pallet stations</th></tr></thead>
                    <tbody>
                      {snap.unloaders.map((u, j) => (
                        <tr key={j}>
                          <td className="mono">U{String(j + 1).padStart(2, '0')}</td>
                          <td>{UNLOADER_STATUS[u.status] || u.status}</td>
                          <td className="mono">{u.basketInFront ? `B${String(u.basketInFront).padStart(3, '0')}` : '—'}</td>
                          <td className="mono">{u.unloadedCount}</td>
                          <td className="mono">{(u.cycleX10 / 10).toFixed(1)} s</td>
                          <td className="mono">{d.stationUnloader.map((x, k) => (x === j ? `P${String(k + 1).padStart(2, '0')}` : null)).filter(Boolean).join(' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {view === 'stations' && (
                  <table className="plc-table">
                    <thead><tr><th>Station</th><th>Unloader</th><th>Status</th><th>Variety</th><th>Lot</th><th>Accumulator</th><th>Pallet</th><th>Pallets done</th></tr></thead>
                    <tbody>
                      {snap.stations.map((p, k) => (
                        <tr key={k}>
                          <td className="mono">P{String(k + 1).padStart(2, '0')}</td>
                          <td className="mono">U{String(d.stationUnloader[k] + 1).padStart(2, '0')}</td>
                          <td>{STATION_STATUS[p.status] || p.status}</td>
                          <td><i className="dot" style={{ background: vc(p.variety) }} />{vn(p.variety)}</td>
                          <td className="mono">{p.lot || ''}</td>
                          <td className="mono">{p.acc} / {cfg.conesPerAccumulator}</td>
                          <td><span className="buf-bar"><span style={{ width: `${Math.min(100, (p.pallet / cfg.conesPerPallet) * 100)}%`, background: vc(p.variety) }} /></span><span className="mono">{p.pallet}/{cfg.conesPerPallet}</span></td>
                          <td className="mono">{p.palletsDone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {view === 'baskets' && (
                  <div className="plc-scroll">
                    <table className="plc-table">
                      <thead><tr><th>Basket</th><th>State</th><th>Variety</th><th>Lot</th><th>Target</th><th>Position from R0</th></tr></thead>
                      <tbody>
                        {snap.baskets.map((b, i) => (b.state ? (
                          <tr key={i}>
                            <td className="mono">B{String(i + 1).padStart(3, '0')}</td>
                            <td className={b.state === 2 ? 'bad' : ''}>{BASKET_STATE[b.state] || b.state}</td>
                            <td><i className="dot" style={{ background: vc(b.variety) }} />{vn(b.variety)}</td>
                            <td className="mono">{b.lot}</td>
                            <td className="mono">{b.target ? `P${String(b.target).padStart(2, '0')}` : '—'}</td>
                            <td className="mono">{(() => { const m = basketPositionM(d, snap, i); return m === null ? '—' : `${m.toFixed(1)} m`; })()}</td>
                          </tr>
                        ) : null))}
                      </tbody>
                    </table>
                  </div>
                )}
                {view === 'raw' && state.words && (
                  <div className="plc-scroll">
                    {map.blocks.map((b) => (
                      <div key={b.name} className="plc-raw">
                        <h3>{b.name} <span>{b.start}–{b.start + b.count - 1} · 4{String(b.start + 1).padStart(4, '0')}…</span></h3>
                        <div className="plc-raw-grid">
                          {(state.words[b.name] || []).slice(0, b.name === 'baskets' ? 160 : 200).map((v, i) => (
                            <span key={i} title={`${b.label(Math.floor(i / b.stride))}.${b.fields[i % b.stride].key}`}><em>{b.start + i}</em>{v}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          <section className="dyn-card">
            <h2><Database size={15} /> Modbus register map <em className="dyn-h2note">for the PLC programmer — built from this plant setup</em></h2>
            <div className="dyn-fields">
              {Object.keys(DEFAULT_BASES).map((k) => (
                <Num key={k} label={`${k} block starts at`} value={bases[k]} min={0} max={65000} onChange={(v) => set('bases', { ...bases, [k]: v === '' ? 0 : v })} unit={`4${String((Number(bases[k]) || 0) + 1).padStart(4, '0')}`} />
              ))}
            </div>
            {map.overlaps.length > 0 && map.overlaps.map((o) => <div key={o} className="dyn-msg error"><XCircle size={14} /> Blocks overlap: {o}</div>)}
            <table className="plc-table" style={{ marginTop: 10 }}>
              <thead><tr><th>Block</th><th>Direction</th><th>Address range</th><th>Words</th><th>Per item</th></tr></thead>
              <tbody>
                {[...map.blocks.map((b) => ({ ...b, dir: 'PLC → brain' })), ...map.commandBlocks.map((b) => ({ ...b, dir: 'brain → PLC' }))].map((b) => (
                  <tr key={b.name}>
                    <td className="mono">{b.name}</td><td>{b.dir}</td>
                    <td className="mono">{b.start}–{b.start + b.count - 1} (4{String(b.start + 1).padStart(4, '0')}–4{String(b.start + b.count).padStart(4, '0')})</td>
                    <td className="mono">{b.count}</td>
                    <td className="wrap">{b.items} × {b.stride}: {b.fields.map((f) => f.key).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="plc-details">
              <summary>Show every register ({registerRows(map).length})</summary>
              <div className="plc-scroll">
                <table className="plc-table">
                  <thead><tr><th>Tag</th><th>Offset</th><th>Modbus</th><th>Description</th><th>Direction</th></tr></thead>
                  <tbody>
                    {registerRows(map, { maxItemsPerBlock: 2 }).map((r) => (
                      <tr key={`${r.block}-${r.address}`}><td className="mono">{r.item}.{r.key}</td><td className="mono">{r.address}</td><td className="mono">{r.modbus}</td><td className="wrap">{r.desc}</td><td>{r.dir}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="dyn-muted">First two items of each block shown — the pattern repeats for every loader, station and basket. The CSV has every register.</div>
              </div>
            </details>
            <div className="plc-actions">
              <button className="dyn-btn" onClick={() => download('SIEGER_OHC_Modbus_register_map.csv', registerCsv(map), 'text/csv')}><Download size={14} /> Register map (CSV)</button>
              <button className="dyn-btn" onClick={() => download('sieger-setup.json', JSON.stringify({ setup: cfg, bases }, null, 2), 'application/json')}><Download size={14} /> Setup for the PLC simulator (JSON)</button>
            </div>
          </section>
        </div>

        <aside className="dyn-card dyn-derived">
          <h2><Radio size={15} /> Connection</h2>
          <div className={`plc-link ${state.link}`}>
            <span className="led" />
            <div><b>{linkText}</b><div className="dyn-muted">{state.message || (settings.mode === 'SIM' ? 'Press "Start simulated PLC".' : 'Press "Connect to PLC".')}</div></div>
          </div>
          <table className="dyn-kv" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td>Source</td><td>{settings.mode === 'SIM' ? 'Simulation (in this page)' : `Modbus TCP ${settings.host}:${settings.port} · unit ${settings.unitId}`}</td></tr>
              <tr><td>Reads</td><td>{state.count}{connected && age !== null ? ` · last ${age} s ago` : ''}</td></tr>
              <tr><td>Errors</td><td>{state.errors}</td></tr>
              <tr><td>Registers per read</td><td>{map.blocks.reduce((a, b) => a + b.count, 0)} in {Math.ceil(map.blocks.reduce((a, b) => a + Math.ceil(b.count / 120), 0))} requests</td></tr>
            </tbody>
          </table>

          {snap && an && (
            <>
              <h3 style={{ marginTop: 14 }}>Information (dynamic) <span>from {settings.mode === 'SIM' ? 'simulation' : 'PLC'}</span></h3>
              <table className="dyn-kv plc-info">
                <thead><tr><td>Variety</td><td>in OHC</td><td>returned</td><td>lot rem.</td></tr></thead>
                <tbody>
                  {an.info.inOhc.map((n, v) => (
                    <tr key={v}>
                      <td><i className="dot" style={{ background: varietyInfo(v).color }} />{cfg.varietyName[v]}</td>
                      <td>{n}</td>
                      <td className={an.info.returned[v] ? 'bad' : ''}>{an.info.returned[v]}</td>
                      <td>{an.info.lotRemaining[v] || ''}</td>
                    </tr>
                  ))}
                  <tr><td><b>Total</b></td><td><b>{an.info.loaded}</b></td><td><b>{an.info.returned.reduce((a, b) => a + b, 0)}</b></td><td><b>{an.info.lotRemaining.reduce((a, b) => a + b, 0) || ''}</b></td></tr>
                </tbody>
              </table>
              <p className="dyn-note">Chain position: pulse {snap.system.pulses}, R0 reads B{String(snap.system.r0Basket).padStart(3, '0')}, {fmtDuration(d.loopSeconds)} per loop.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
