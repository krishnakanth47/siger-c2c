import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Settings2, Star, RefreshCw, Terminal, Radio } from 'lucide-react';
import { derive, fmtDuration } from './config';
import { DynamicEngine, summarize } from './dynamicEngine';
import DynamicPlant from './DynamicPlant';
import DynamicBrainPanel from './DynamicBrainPanel';
import BrainButton from '../components/BrainButton';
import { basketTrack, fmtLeg } from './tracking';
import './dynamic.css';

const SPEEDS = [1, 10, 30, 60, 180];

function Detail({ sel, view, d }) {
  if (!sel) return <div className="dyn-muted">Click a loader, basket, unloader or pallet station on the plant.</div>;
  const vName = (v) => view.varieties[v]?.name || '—';
  if (sel.type === 'loader') {
    const l = view.loaders.find((x) => x.id === sel.id);
    return (
      <table className="dyn-kv"><tbody>
        <tr><td>Loader</td><td>{l.id} · {vName(l.variety)}</td></tr>
        <tr><td>Position from R0</td><td>{(l.slot * d.pitch).toFixed(1)} m · pitch {l.slot}</td></tr>
        <tr><td>Basket in front (RFID)</td><td>{view.rfid.stationReads[l.id]?.id || '—'}</td></tr>
        <tr><td>Cones waiting</td><td>{l.count} / {d.cfg.loaderBufferCones}</td></tr>
        <tr><td>By lot</td><td>{l.queue.map((q) => `lot ${q.lot}: ${q.n}`).join(' · ') || '—'}</td></tr>
        <tr><td>Output</td><td>{l.rate.toFixed(1)} cones/h</td></tr>
        <tr><td>State</td><td>{l.stopped ? 'STOPPED (buffer full)' : l.permit ? `LOADING (${l.decidedBy})` : l.eligibleSince !== null ? `WAITING ${fmtDuration(view.t - l.eligibleSince)}` : 'accumulating'}</td></tr>
        <tr><td>Stopped time</td><td>{fmtDuration(l.stoppedSec)}</td></tr>
        <tr><td>Loaded total</td><td>{l.loadedTotal}</td></tr>
      </tbody></table>
    );
  }
  if (sel.type === 'unloader') {
    const u = view.unloaders.find((x) => x.id === sel.id);
    return (
      <table className="dyn-kv"><tbody>
        <tr><td>Unloader</td><td>{u.id}</td></tr>
        <tr><td>Position from R0</td><td>{(u.slot * d.pitch).toFixed(1)} m · pitch {u.slot}</td></tr>
        <tr><td>Basket in front (RFID)</td><td>{view.rfid.stationReads[u.id]?.id || '—'}</td></tr>
        <tr><td>Pallet stations</td><td>{u.stations.map((k) => view.stations[k].id).join(', ')}</td></tr>
        <tr><td>State</td><td>{u.cooldown > 0 ? `busy ${u.cooldown}s` : 'ready'}</td></tr>
        <tr><td>Unloaded total</td><td>{u.unloaded}</td></tr>
      </tbody></table>
    );
  }
  if (sel.type === 'station') {
    const s = view.stations.find((x) => x.id === sel.id);
    return (
      <table className="dyn-kv"><tbody>
        <tr><td>Pallet station</td><td>{s.id} on {view.unloaders[s.unloader].id}</td></tr>
        <tr><td>Status</td><td>{s.status}</td></tr>
        <tr><td>Variety / lot</td><td>{s.variety >= 0 ? `${vName(s.variety)} · lot ${s.lot}` : '—'}</td></tr>
        <tr><td>Accumulator</td><td>{s.acc} / {d.cfg.conesPerAccumulator}</td></tr>
        <tr><td>Pallet</td><td>{s.pallet} / {d.cfg.conesPerPallet} · {s.pallets} full dispatched</td></tr>
      </tbody></table>
    );
  }
  const b = view.baskets.find((x) => x.id === sel.id);
  const tr = basketTrack(view, d, b);
  const target = b.variety >= 0 && b.targetStation !== null ? view.stations[b.targetStation] : null;
  const tU = target ? view.unloaders[target.unloader] : null;
  const nextLoader = view.loaders.map((l) => ({ l, g: tr.leg(l.slot) })).sort((a, c) => a.g.pitches - c.g.pitches)[0];
  return (
    <>
      <table className="dyn-kv"><tbody>
        <tr><td>Basket</td><td>{b.id} · place {b.idx + 1} in the R0 order list</td></tr>
        <tr><td>Contents</td><td>{b.variety >= 0 ? `${vName(b.variety)} · lot ${b.lot}` : 'empty'}</td></tr>
        <tr><td>Position from R0</td><td><b>{tr.posM.toFixed(1)} m</b> · pitch {Math.floor(tr.pos)} of {d.slots}</td></tr>
        <tr><td>Zone</td><td>{tr.zone}</td></tr>
        <tr><td>Next station</td><td>{tr.next ? `${tr.next.id} in ${fmtLeg(tr.next)}` : '—'}</td></tr>
        {tU && <tr><td>To its unloader</td><td>{tU.id} ({target.id}) in {fmtLeg(tr.leg(tU.slot))}</td></tr>}
        {!tU && nextLoader && <tr><td>Next loader</td><td>{nextLoader.l.id} in {fmtLeg(nextLoader.g)}</td></tr>}
        <tr><td>To R0 (loop end)</td><td>{fmtLeg(tr.toR0)}</td></tr>
        <tr><td>Extra laps</td><td>{b.laps}</td></tr>
      </tbody></table>
      <div className="dyn-track-note">
        <b>How the position is found:</b> R0 last read <b>{tr.lastR0.id}</b> ({tr.pulsesSince} pulse{tr.pulsesSince === 1 ? '' : 's'} ago). {b.id} is {tr.ahead} place{tr.ahead === 1 ? '' : 's'} ahead of it in the order list →
        ({tr.ahead} places + {tr.pulsesSince} pulses + {view.chainFrac.toFixed(2)} pitch from the encoder) × {d.pitch} m = <b>{tr.posM.toFixed(1)} m</b> {tr.error ? <span style={{ color: 'var(--accent-rose)' }}>— does not match the chain!</span> : <span style={{ color: 'var(--accent-emerald)' }}>✓ matches the chain</span>}
      </div>
      <table className="dyn-kv" style={{ marginTop: 6 }}><tbody>
        {view.unloaders.map((u) => <tr key={u.id}><td>to {u.id} ({(u.slot * d.pitch).toFixed(1)} m)</td><td>{fmtLeg(tr.leg(u.slot))}</td></tr>)}
      </tbody></table>
    </>
  );
}

export default function DynamicSim({ config, onEditSetup }) {
  const d = useMemo(() => derive(config), [config]);
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new DynamicEngine(d, { mode: 'BRAIN' });
  const [view, setView] = useState(() => engineRef.current.view());
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [showBrain, setShowBrain] = useState(false);
  const [sel, setSel] = useState(null);
  const [showLog, setShowLog] = useState(true);
  const acc = useRef(0);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      acc.current += speed / 10;
      const n = Math.min(600, Math.floor(acc.current));
      acc.current -= n;
      for (let i = 0; i < n; i++) engineRef.current.tick();
      if (n) setView(engineRef.current.view());
    }, 100);
    return () => clearInterval(id);
  }, [running, speed]);

  const e = engineRef.current;
  const refresh = () => setView(e.view());
  const reset = () => { setRunning(false); engineRef.current = new DynamicEngine(d, { mode: e.mode, weights: e.brain.weights }); setView(engineRef.current.view()); };
  const k = summarize(view.kpi[view.mode === 'BRAIN' && view.brainOnline ? 'BRAIN' : 'FIFO'], view.loaders.length);
  const maxOnLoop = Math.max(1, ...view.onLoopByVariety);
  const cfg = d.cfg;

  return (
    <div className="dyn-sim">
      <header className="dyn-simbar">
        <div className="dyn-brand">
          <div className="brand-badge">SIEGER</div>
          <div>
            <h1>OHC dynamic simulation</h1>
            <p>{cfg.loaderCount} loaders · {cfg.unloaderCount} unloaders · {cfg.palletStations} pallet stations · {cfg.varieties} varieties · {cfg.basketCount} baskets</p>
          </div>
        </div>
        <div className="dyn-simctl">
          <span className="dyn-clock">SIM {fmtDuration(view.t)}</span>
          {running
            ? <button className="dyn-btn warn" onClick={() => setRunning(false)}><Pause size={14} /> Pause</button>
            : <button className="dyn-btn primary" onClick={() => setRunning(true)}><Play size={14} /> Start</button>}
          <div className="dyn-seg">
            {SPEEDS.map((s) => <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{s}x</button>)}
          </div>
          <button className="dyn-btn" onClick={reset}><RotateCcw size={14} /> Reset</button>
          <button className="dyn-btn" onClick={onEditSetup}><Settings2 size={14} /> Edit setup</button>
        </div>
      </header>

      <div className="dyn-main">
        <aside className="dyn-side">
          <section className="dyn-card tight">
            <h3>Live KPIs <span>{view.mode === 'BRAIN' && view.brainOnline ? 'MASTER MIND' : 'FIFO'}</span></h3>
            <div className="dyn-kpis">
              <div><b>{k.unloadedPerHour}</b><span>to pallets /h</span></div>
              <div><b>{cfg.packagesPerHour}</b><span>design /h</span></div>
              <div><b>{view.stats.loadedOnLoop}</b><span>loaded on loop</span></div>
              <div><b>{view.stats.emptyOnLoop}</b><span>empty on loop</span></div>
              <div className={view.stats.stopped ? 'bad' : ''}><b>{view.stats.stopped}</b><span>autoconers stopped</span></div>
              <div><b>{k.stopPct}%</b><span>stop time</span></div>
            </div>
          </section>

          <section className="dyn-card tight">
            <h3>Loading places <span>{view.stats.loading} / {cfg.maxLoadsAtOnce}</span></h3>
            {view.loaders.filter((l) => l.permit).map((l) => (
              <div className="dyn-row" key={l.id}>
                <i style={{ background: view.varieties[l.variety].color }} />
                <b>{l.id}</b><span>{view.varieties[l.variety].name}</span><em>{l.count} left → {view.stations[l.targets?.[l.queue[0]?.lot]]?.id || '—'}</em>
              </div>
            ))}
            {!view.stats.loading && <div className="dyn-muted">No loader loading.</div>}
            <div className="dyn-muted" style={{ marginTop: 4 }}>{view.stats.waiting} loader(s) waiting for a permit</div>
          </section>

          <section className="dyn-card tight">
            <h3>Information (dynamic) <span>{view.activeVarieties.length} / {view.varietyLimit} varieties{view.varietyLimitAuto ? ' (auto)' : ''}</span></h3>
            <div className="dyn-var-head"><span>Category (variant)</span><span>pkgs in OHC</span><span>returned</span><span /></div>
            {view.varieties.map((v) => (
              <div className="dyn-var" key={v.idx}>
                <span className="nm" title={`lot ${v.lot}`}>
                  <i style={{ background: v.color, outline: view.activeVarieties.includes(v.idx) ? '2px solid #fff' : 'none' }} />
                  {v.name}
                </span>
                <span className="bar"><span style={{ width: `${(view.onLoopByVariety[v.idx] / maxOnLoop) * 100}%`, background: v.color }} /><em>{view.onLoopByVariety[v.idx]}</em></span>
                <span className="ret">{v.returned}</span>
                <span className="acts">
                  <button title="Mark high demand" className={v.highDemand ? 'on' : ''} onClick={() => { e.toggleDemand(v.idx); refresh(); }}><Star size={11} /></button>
                  <button title="Lot change" onClick={() => { e.lotChange(v.idx); refresh(); }}><RefreshCw size={11} /></button>
                </span>
                {v.remaining && (
                  <div className="lot">Lot change {v.remaining.lot} → {v.lot}: <b>{v.remaining.total}</b> cones left ({v.remaining.atLoaders} at loaders, {v.remaining.onLoop} on loop)</div>
                )}
              </div>
            ))}
            <div className="dyn-muted" style={{ marginTop: 4 }}>
              Packages in OHC: <b>{view.stats.loadedOnLoop}</b> · returned after unloader: <b>{view.kpi.FIFO.returned + view.kpi.BRAIN.returned}</b> total ({view.stats.returningNow} going round now)
              {' '}· lot change remaining: <b>{view.varieties.reduce((s, v) => s + (v.remaining ? v.remaining.total : 0), 0)}</b> cones
            </div>
          </section>

          <section className="dyn-card tight">
            <h3><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'inherit' }}><Radio size={11} /> Origin R0 · RFID tracking</span> <span>{view.rfid.homeErrors ? `${view.rfid.homeErrors} ERROR` : 'IN SYNC'}</span></h3>
            <div className="dyn-muted" style={{ lineHeight: 1.6 }}>
              R0 at <b>0 m</b> ({cfg.originToL01M} m before L01) = loop end at <b>{d.loopLength.toFixed(1)} m</b><br />
              Reading now: <b>{view.rfid.lastR0.id}</b> · pulse counter <b>{view.rfid.pulses}</b><br />
              Loops: {view.rfid.loops} · home checks OK: {view.rfid.homeChecks - view.rfid.homeErrors}/{view.rfid.homeChecks}
              {view.rfid.lastHome && <> · last B001 at {fmtDuration(view.rfid.lastHome.t)}</>}
            </div>
            <div className="dyn-muted" style={{ marginTop: 3 }}>Click any basket to see its position and distances.</div>
          </section>

          <section className="dyn-card tight">
            <h3>Selected</h3>
            <Detail sel={sel} view={view} d={d} />
          </section>
        </aside>

        <div className="dyn-center">
          <DynamicPlant view={view} d={d} onSelect={setSel} sel={sel}>
            <BrainButton
              brain={{ lastCycle: view.lastCycle, pulse: view.pulse }}
              mode={view.mode}
              brainOnline={view.brainOnline}
              simTime={view.t}
              onOpen={() => setShowBrain(true)}
              onSetMode={(m) => { e.setMode(m); refresh(); }}
            />
          </DynamicPlant>
          <div className={`dyn-log ${showLog ? '' : 'closed'}`}>
            <div className="dyn-log-head" onClick={() => setShowLog(!showLog)}><Terminal size={12} /> Event log ({view.events.length}) — click to {showLog ? 'hide' : 'show'}</div>
            {showLog && (
              <div className="dyn-log-body">
                {view.events.slice(0, 40).map((ev) => (
                  <div key={ev.id} className={`dyn-ev ${ev.level}`}><span>{fmtDuration(ev.t)}</span>{ev.message}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DynamicBrainPanel
        open={showBrain}
        onClose={() => setShowBrain(false)}
        view={view}
        d={d}
        onSetWeights={(w) => { e.setWeights(w); refresh(); }}
        onSetBrainOnline={(on) => { e.setBrainOnline(on); refresh(); }}
      />
    </div>
  );
}
