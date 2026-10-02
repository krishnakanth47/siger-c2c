import React, { useState } from 'react';
import { Brain, X, Pause, Play, Radar, Layers, Timer, Calculator, ShieldCheck, Send, HeartPulse, RotateCcw, Trophy } from 'lucide-react';
import { DYN_WEIGHTS, DYN_WEIGHT_META } from './dynamicBrain';
import { compareStrategies, summarize } from './dynamicEngine';
import { fmtDuration } from './config';
import '../components/brain.css';
import './dynamic.css';

const COMP_COLORS = { variant: '#a855f7', buffer: '#f59e0b', stopped: '#f43f5e', wait: '#3b82f6', urgent: '#10b981', lot: '#f97316', pallet: '#22d3ee', unloader: '#38bdf8', forced: '#ec4899' };
const COMP_LABELS = { variant: 'Variety on loop', buffer: 'Buffer risk', stopped: 'Autoconer stopped', wait: 'Fairness (wait)', urgent: 'High demand', lot: 'Old lot (lot change)', pallet: 'Pallet waiting', unloader: 'Unloader free', forced: 'Anti-starvation' };

function VTag({ v, varieties }) {
  const x = varieties[v];
  if (!x) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: x.color }} /><span style={{ color: '#fff', fontWeight: 600 }}>{x.name}</span></span>;
}

function CycleView({ snap, varieties, cfg }) {
  const i = snap.inputs;
  const permits = snap.actions.filter((a) => a.type === 'PERMIT');
  const steps = [
    { icon: Radar, h: 'Sense', b: `${i.waiting} loader(s) ready · ${i.loading}/${i.maxLoads} loading · ${i.loadedBaskets} loaded / ${i.emptyBaskets} empty baskets` },
    { icon: Layers, h: 'Variety slots', b: `${i.varietiesOnLoop}/${i.maxVarieties} on the loop${snap.drain ? ` · draining ${varieties[snap.drain.variety]?.name}` : ''}` },
    { icon: Timer, h: 'Trigger count', b: cfg.loadingCountMode === 'MANUAL' ? `Manual: ${cfg.manualTriggerCount} cones` : 'Automatic: decided per loader (see table)' },
    { icon: Calculator, h: 'Score', b: snap.candidates.length ? `Ranked ${snap.candidates.length}. Top: ${snap.candidates[0].loaderId} (${snap.candidates[0].total})` : 'Nothing to rank' },
    { icon: ShieldCheck, h: 'Check + timing', b: '4Q places, variety slot, pallet station, unloader arrival forecast' },
    { icon: Send, h: 'Command PLC', b: permits.length ? `${permits.length} permit(s) + station routing` : snap.actions.length ? 'Permit withdrawn (drain)' : 'Hold' },
  ];
  const hot = (k) => (k === 1 ? !!snap.drain || snap.notes.length > 0 : k >= 3 && k <= 4 ? snap.candidates.length > 0 : k === 5 ? snap.actions.length > 0 : false);
  const scale = Math.max(120, ...snap.candidates.map((c) => c.components.filter((x) => x.pts > 0 && x.key !== 'forced').reduce((s, x) => s + x.pts, 0)));
  return (
    <>
      <div className="brain-pipeline" style={{ gridTemplateColumns: 'repeat(6, minmax(0,1fr))' }}>
        {steps.map((s, k) => { const Icon = s.icon; return (
          <div key={s.h} className={`brain-step ${hot(k) ? 'hot' : ''}`}>
            <div className="n" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon size={12} /> STEP {k + 1}</div>
            <div className="h">{s.h}</div>
            <div className="b">{s.b}</div>
          </div>
        ); })}
      </div>
      <div className="brain-callout info"><b>Cycle #{snap.cycleId} · T+{fmtDuration(snap.t)} —</b> {snap.summary}</div>
      {snap.notes.map((n) => <div key={n} className="brain-callout warn">{n}</div>)}

      <div className="brain-grid-2">
        <div className="brain-card">
          <div className="brain-card-title"><span>VARIETY SLOTS ({snap.inputs.maxVarieties}{snap.inputs.autoLimit ? ' — AUTO: one per pallet station available' : ' — fixed'})</span></div>
          {snap.slots.map((s, k) => (
            <div className="slot-card" key={k}>
              <div className="row">
                <span className="name"><span className="mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>SLOT {k + 1}</span>{s.variety >= 0 ? <VTag v={s.variety} varieties={varieties} /> : <span style={{ color: 'var(--text-muted)' }}>Empty</span>}</span>
                <span className={`slot-pill slot-${s.state.split(' ')[0]}`}>{s.state}</span>
              </div>
              <div className="note">{s.note}</div>
            </div>
          ))}
          {snap.drain && <div className="brain-callout drain" style={{ marginTop: 6 }}><b>Why drain?</b> {snap.drain.reason}</div>}
          <div className="brain-card-title" style={{ marginTop: 10 }}><span>PALLET STATIONS</span></div>
          <div className="dyn-st-grid">
            {snap.stations.map((s) => (
              <div key={s.id} className={`dyn-st ${s.status}`} title={`${s.id} on U${String(s.unloader + 1).padStart(2, '0')}`}>
                <b>{s.id}</b>
                <span style={{ color: s.variety >= 0 ? varieties[s.variety]?.color : 'var(--text-muted)' }}>{s.variety >= 0 ? varieties[s.variety]?.name : 'free'}</span>
                <em>{s.status === 'FREE' ? `U${s.unloader + 1}` : `L${s.lot} · ${s.pallet}+${s.acc}`}</em>
              </div>
            ))}
          </div>
        </div>
        <div className="brain-card" style={{ minWidth: 0, overflowX: 'auto' }}>
          <div className="brain-card-title"><span>SCORING — every loader ready to load</span></div>
          {!snap.candidates.length ? <div className="brain-callout info">No loader has reached its triggering count. The brain is watching doff counts.</div> : (
            <>
              <table className="score-table">
                <thead><tr><th>#</th><th>LOADER</th><th>VARIETY</th><th>CONES / TRIGGER</th><th>BUFFER</th><th>SCORE BREAKDOWN</th><th style={{ textAlign: 'right' }}>TOTAL</th><th>DECISION</th></tr></thead>
                <tbody>
                  {snap.candidates.map((c) => {
                    const kind = c.verdict.split(' ')[0];
                    const bufColor = c.bufferPct >= 100 ? 'var(--accent-rose)' : c.bufferPct >= 70 ? 'var(--accent-amber)' : 'var(--accent-emerald)';
                    const forced = c.components.some((x) => x.key === 'forced');
                    return (
                      <tr key={c.loaderId} className={`${c.selected ? 'sel' : ''} ${c.stopped ? 'stopped' : ''}`}>
                        <td className="mono" style={{ color: 'var(--text-muted)' }}>{c.rank}</td>
                        <td className="mono" style={{ color: '#fff', fontWeight: 700 }}>{c.loaderId}</td>
                        <td><VTag v={c.variety} varieties={varieties} /></td>
                        <td className="mono" title={c.triggerReason}>{c.count} / {c.trigger}<div style={{ fontSize: 9, color: 'var(--text-muted)', maxWidth: 170 }}>{c.triggerReason}</div></td>
                        <td className="mono" style={{ whiteSpace: 'nowrap' }}><span className="buf-bar"><span style={{ width: `${c.bufferPct}%`, background: bufColor }} /></span>{c.stopped ? <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>STOPPED</span> : `${c.bufferPct}%`}</td>
                        <td>
                          <div className="stack-bar">
                            {c.components.filter((x) => x.pts > 0 && x.key !== 'forced').map((x) => <span key={x.key} style={{ width: `${(x.pts / scale) * 100}%`, background: COMP_COLORS[x.key] }} />)}
                            {forced && <span style={{ flex: 1, background: COMP_COLORS.forced }} />}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{c.components.filter((x) => x.pts !== 0).map((x) => `${x.pts > 0 ? '+' : ''}${x.pts} ${x.label.toLowerCase()}`).join(' · ')}</div>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: 12 }}>{c.total}</td>
                        <td>
                          <div className={`verdict ${kind}`}>{c.verdict}</div>
                          {c.timing && (
                            <div className="tm-mini">
                              first cone at {c.timing.unloader} in {fmtDuration(c.timing.firstSec)} · last {fmtDuration(c.timing.lastSec)} · {c.timing.paceSec} s/cone · {c.timing.misses ? `${c.timing.misses} return(s)` : 'no returns'}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="legend-row" style={{ marginTop: 8 }}>
                {Object.keys(COMP_COLORS).map((k) => <span key={k}><i style={{ background: COMP_COLORS[k] }} />{COMP_LABELS[k]}</span>)}
              </div>
            </>
          )}
        </div>
      </div>

      {snap.timing && <TimingCard tm={snap.timing} />}

      <div className="brain-card">
        <div className="brain-card-title"><span>COMMANDS TO PLC</span></div>
        {!snap.actions.length ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No command this cycle.</div> : snap.actions.map((a, k) => (
          <div className="cmd-item" key={k} style={a.type === 'REVOKE' ? { borderLeftColor: 'var(--accent-rose)' } : undefined}>
            {a.type === 'REVOKE' ? `Withdraw permit: ${a.explanation}.` : a.explanation}
          </div>
        ))}
      </div>
    </>
  );
}

function TimingCard({ tm }) {
  return (
    <div className="brain-card">
      <div className="brain-card-title"><span>TIMING — calculated from the setup data</span></div>
      <div className="tm-facts">
        <span><b>{tm.slotTime} s</b> a basket passes a station (pitch ÷ speed)</span>
        <span><b>{tm.loadCycleSec} s</b> loader cycle = every {tm.loadSlots}th basket</span>
        <span><b>{tm.unloadCycleSec} s</b> unloader cycle = every {tm.unloadSlots}th basket</span>
        <span><b>{tm.streamCapacity}</b> loading streams one unloader can take</span>
        <span><b>{tm.slotWaitSec ? fmtDuration(tm.slotWaitSec) : 'now'}</b> next free variety slot</span>
      </div>
      <table className="score-table tm-table">
        <thead><tr><th>UNLOADER</th><th>CONES BOOKED</th><th>NEXT CONE IN</th><th>BOOKED UNTIL</th><th>LOAD</th><th>FORECAST RETURNS</th></tr></thead>
        <tbody>
          {tm.unloaders.map((u) => (
            <tr key={u.id}>
              <td className="mono" style={{ color: '#fff', fontWeight: 700 }}>{u.id}</td>
              <td className="mono">{u.cones}</td>
              <td className="mono">{u.next === null ? '—' : fmtDuration(u.next)}</td>
              <td className="mono">{u.cones ? fmtDuration(u.busyUntil) : 'free'}</td>
              <td><span className="buf-bar"><span style={{ width: `${Math.min(100, u.load * 100)}%`, background: u.load > 1 ? 'var(--accent-rose)' : u.load > 0.8 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }} /></span><span className="mono">{Math.round(u.load * 100)}%</span></td>
              <td className="mono" style={{ color: u.misses ? 'var(--accent-rose)' : 'var(--text-muted)' }}>{u.misses}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
        For every loader it permits, the brain forecasts basket by basket when each cone reaches each unloader, and whether that unloader will be free (it needs {tm.unloadSlots} basket pitches between cones).
        It sends the loader to the unloader where the batch is cleared soonest with the fewest cones going round again, and never sends cones faster than one unloader can take them.
      </div>
    </div>
  );
}

function LiveTab({ view, cfg }) {
  const [frozen, setFrozen] = useState(null);
  const live = view.lastCycle && view.lastCycle.candidates.length ? view.lastCycle : view.lastActiveCycle || view.lastCycle;
  const snap = frozen || live;
  return (
    <>
      {view.mode !== 'BRAIN' && <div className="brain-callout warn">The plant is running <b>FIFO (customer spec)</b>. Switch to <b>MASTER MIND</b> to let the brain decide.{snap && ' Showing its last cycle.'}</div>}
      {view.mode === 'BRAIN' && !view.brainOnline && <div className="brain-callout drain">Brain heartbeat lost — PLC runs plain FIFO. Restore it under “Rules & weights”.</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>The brain re-decides every simulated second. {frozen ? 'View frozen — the plant keeps running.' : 'Live view.'}</span>
        <button className="brain-btn" onClick={() => setFrozen(frozen ? null : live)} disabled={!live}>{frozen ? <><Play size={12} /> Resume live view</> : <><Pause size={12} /> Freeze this cycle</>}</button>
      </div>
      {snap ? <CycleView snap={snap} varieties={view.varieties} cfg={cfg} /> : <div className="brain-callout info">Press START. The first decision cycle will appear here.</div>}
    </>
  );
}

function LogTab({ view, cfg }) {
  const [sel, setSel] = useState(null);
  const d = view.decisions.find((x) => x.id === sel) || view.decisions[0];
  if (!view.decisions.length) return <div className="brain-callout info">No decisions yet.</div>;
  return (
    <div className="log-layout">
      <div className="log-list">
        {view.decisions.map((x) => {
          const p = x.snapshot.actions.filter((a) => a.type === 'PERMIT');
          return (
            <button key={x.id} className={`log-entry ${d?.id === x.id ? 'active' : ''}`} onClick={() => setSel(x.id)}>
              <div className="t">T+{fmtDuration(x.t)} · CYCLE #{x.snapshot.cycleId}</div>
              <div>
                {p.length > 0 && <b style={{ color: 'var(--accent-emerald)' }}>Permit {p.map((a) => view.loaders[a.loaderIdx].id).join(', ')}</b>}
                {x.snapshot.notes.length > 0 && <b style={{ color: '#fb7185' }}>{p.length ? ' · ' : ''}{x.snapshot.notes[0].split(' ').slice(0, 2).join(' ')}</b>}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{x.snapshot.summary}</div>
            </button>
          );
        })}
      </div>
      <div className="log-detail">{d && <CycleView snap={d.snapshot} varieties={view.varieties} cfg={cfg} />}</div>
    </div>
  );
}

function RulesTab({ view, cfg, onSetWeights, onSetBrainOnline }) {
  const w = view.weights;
  return (
    <>
      <div className="brain-card">
        <div className="brain-card-title"><span>HARD RULES (from the setup page)</span></div>
        <ul style={{ paddingLeft: 18, fontSize: 11.5, lineHeight: 1.7 }}>
          <li>At most <b>{cfg.maxLoadsAtOnce}</b> loaders loading at the same time.</li>
          {cfg.varietyLimitMode === 'AUTO'
            ? <li>Varieties on the loop: <b>automatic</b> — the brain allows a new variety whenever a pallet station is free for it (up to {cfg.palletStations}) and the unloader forecast shows it can be unloaded without returns. Now: <b>{view.varietyLimit}</b>. (FIFO keeps the spec limit of {cfg.maxVarietiesOnLoop}.)</li>
            : <li>At most <b>{cfg.maxVarietiesOnLoop}</b> varieties on the loop at the same time (fixed).</li>}
          <li>A loader only loads when its lot has a pallet station ({cfg.palletStations} stations, allocated dynamically).</li>
          <li>Cones of different lots never share a pallet; after a lot change the old lot {cfg.lotChangePriority === 'NORMAL' ? 'keeps its own pallet (normal priority)' : <>is cleared first (<b>high priority</b>)</>}.</li>
          <li>Loader to start loading is chosen on <b>{{ BOTH: 'demand + unloader requirement', DEMAND: 'demand (autoconer side)', UNLOADER: 'unloader requirement' }[cfg.loaderStartRule || 'BOTH']}</b>.</li>
          <li>Loading count: <b>{cfg.loadingCountMode === 'MANUAL' ? `manual, ${cfg.manualTriggerCount} cones` : 'automatic (brain decides)'}</b> · {cfg.conesPerAccumulator} cones per accumulator.</li>
          <li>Timing: a basket passes every <b>{(cfg.pitchMm / 1000 / (cfg.speedMPerMin / 60)).toFixed(1)} s</b>; a loader can use every {Math.max(1, Math.ceil(cfg.loadingTimeSec / (cfg.pitchMm / 1000 / (cfg.speedMPerMin / 60)) - 1e-9))}th basket, an unloader every {Math.max(1, Math.ceil(cfg.unloadingTimeSec / (cfg.pitchMm / 1000 / (cfg.speedMPerMin / 60)) - 1e-9))}th. A loading stream is never faster than one unloader can take.</li>
          <li>If the brain goes silent, the PLC falls back to FIFO with the same limits.</li>
        </ul>
      </div>
      <div className="brain-card">
        <div className="brain-card-title"><span>SCORING & TIMING WEIGHTS (live)</span><button className="brain-btn" onClick={() => onSetWeights(DYN_WEIGHTS)}><RotateCcw size={12} /> Defaults</button></div>
        <div className="weights-grid">
          {DYN_WEIGHT_META.map((m) => (
            <div className="weight-row" key={m.key}>
              <label>{m.label} <span>{w[m.key]} {m.unit}</span></label>
              <input type="range" min={m.min} max={m.max} step={m.step} value={w[m.key]} onChange={(e) => onSetWeights({ [m.key]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
      </div>
      <div className="brain-card">
        <div className="brain-card-title"><span>FAILURE TEST</span></div>
        <button className={`brain-btn ${view.brainOnline ? 'danger' : 'primary'}`} onClick={() => onSetBrainOnline(!view.brainOnline)}><HeartPulse size={13} /> {view.brainOnline ? 'Simulate brain PC failure' : 'Restore brain heartbeat'}</button>
      </div>
    </>
  );
}

function KpiTable({ a, b }) {
  const rows = [
    ['Cones unloaded to pallets per hour', 'unloadedPerHour', false],
    ['Cones loaded per hour', 'loadedPerHour', false],
    ['Loaded baskets returned after unloader per hour', 'returnedPerHour', true],
    ['Autoconer stop time (% of all loaders)', 'stopPct', true],
    ['Average wait for a loading permit (min)', 'avgWait', true],
    ['Longest wait (min)', 'maxWait', true],
    ['Full pallets dispatched', 'pallets', false],
    ['Partial pallets (changeovers)', 'partialPallets', true],
  ];
  const ran = (x) => x.simSec > 0;
  return (
    <table className="kpi-table">
      <thead><tr><th>KPI</th><th>FIFO (SPEC)</th><th>MASTER MIND</th><th>CHANGE</th></tr></thead>
      <tbody>
        {rows.map(([label, k, lower]) => {
          const x = ran(a) ? a[k] : null; const y = ran(b) ? b[k] : null;
          let change = '—';
          if (x !== null && y !== null && x !== 0) { const pct = ((y - x) / Math.abs(x)) * 100; const good = lower ? pct < 0 : pct > 0; change = <span style={{ color: Math.abs(pct) < 0.5 ? 'var(--text-muted)' : good ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{pct > 0 ? '+' : ''}{pct.toFixed(0)}%</span>; }
          return <tr key={k}><td>{label}</td><td className="fifo">{x ?? 'not run'}</td><td className="brain">{y ?? 'not run'}</td><td className="gain">{change}</td></tr>;
        })}
      </tbody>
    </table>
  );
}

function PerfTab({ view, d }) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const hours = 3;
  const run = () => { setBusy(true); setTimeout(() => { setRes(compareStrategies(d, hours * 3600, view.weights)); setBusy(false); }, 30); };
  const n = view.loaders.length;
  return (
    <>
      <div className="brain-card">
        <div className="brain-card-title"><span>HEAD-TO-HEAD · {hours} SIMULATED HOURS · THIS PLANT SETUP</span><button className="brain-btn primary" onClick={run} disabled={busy}><Trophy size={12} /> {busy ? 'Running both strategies…' : res ? 'Run again' : 'Run comparison'}</button></div>
        {res ? <KpiTable a={res.FIFO} b={res.BRAIN} /> : <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Runs FIFO and Master Mind separately from the same starting plant with the values you entered. Takes a few seconds.</div>}
      </div>
      <div className="brain-card">
        <div className="brain-card-title"><span>THIS SESSION (LIVE)</span></div>
        <KpiTable a={summarize(view.kpi.FIFO, n)} b={summarize(view.kpi.BRAIN, n)} />
      </div>
    </>
  );
}

export default function DynamicBrainPanel({ open, onClose, view, d, onSetWeights, onSetBrainOnline }) {
  const [tab, setTab] = useState('live');
  if (!open) return null;
  const cfg = d.cfg;
  const tabs = [['live', 'LIVE THINKING'], ['log', `DECISION LOG (${view.decisions.length})`], ['rules', 'RULES & WEIGHTS'], ['perf', 'PERFORMANCE']];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="brain-window" onClick={(e) => e.stopPropagation()}>
        <div className="brain-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={`brain-orb ${view.mode !== 'BRAIN' ? 'fifo' : !view.brainOnline ? 'offline' : ''}`} style={{ width: 36, height: 36, flexBasis: 36 }}><Brain size={20} /></div>
            <div>
              <h2>MASTER MIND · DECISION ENGINE</h2>
              <div className="sub">{view.mode === 'BRAIN' ? (view.brainOnline ? 'In control' : 'OFFLINE — PLC fallback FIFO') : 'Standby — FIFO (customer spec)'} · loading {view.stats.loading}/{cfg.maxLoadsAtOnce} · varieties {view.activeVarieties.length}/{view.varietyLimit}{view.varietyLimitAuto ? ' auto' : ''} · {view.stats.waiting} waiting · {view.stats.stopped} stopped</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="brain-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
        <div className="brain-body">
          {tab === 'live' && <LiveTab view={view} cfg={cfg} />}
          {tab === 'log' && <LogTab view={view} cfg={cfg} />}
          {tab === 'rules' && <RulesTab view={view} cfg={cfg} onSetWeights={onSetWeights} onSetBrainOnline={onSetBrainOnline} />}
          {tab === 'perf' && <PerfTab view={view} d={d} />}
        </div>
      </div>
    </div>
  );
}
