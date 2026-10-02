import React, { useState } from 'react';
import { Brain, X, Pause, Play, Activity, Radar, Layers, Calculator, ShoppingBasket, Send, HeartPulse, RotateCcw, Trophy } from 'lucide-react';
import { VARIANTS } from '../constants/simulationConstants';
import { WEIGHT_META, DEFAULT_WEIGHTS } from '../simulation/masterMindBrain';
import { summarizeKpi } from '../simulation/masterMindEngine';
import './brain.css';

const COMPONENT_COLORS = {
  variant: '#a855f7',
  buffer: '#f59e0b',
  stopped: '#f43f5e',
  wait: '#3b82f6',
  urgent: '#10b981',
  forced: '#ec4899',
};
const COMPONENT_LABELS = {
  variant: 'Same variant open',
  buffer: 'Buffer risk',
  stopped: 'Machine stopped',
  wait: 'Fairness (wait)',
  urgent: 'Urgent order',
  forced: 'Anti-starvation',
};

const variant = (id) => VARIANTS.find((v) => v.id === id);

function VariantTag({ id }) {
  const v = variant(id);
  if (!v) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color }} />
      <span style={{ color: '#fff', fontWeight: 600 }}>{v.name}</span>
    </span>
  );
}

// ── Step 2: the 4 variant slots ───────────────────────────────────────────
function SlotsView({ slots, drain, reservation }) {
  return (
    <div>
      {slots.map((s, i) => (
        <div className="slot-card" key={`slot-${i}`}>
          <div className="row">
            <span className="name">
              <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>SLOT {i + 1}</span>
              {s.variantId ? <VariantTag id={s.variantId} /> : <span style={{ color: 'var(--text-muted)' }}>Empty</span>}
            </span>
            <span className={`slot-pill slot-${s.state.split(' ')[0]}`}>{s.state}</span>
          </div>
          <div className="note">{s.note}</div>
        </div>
      ))}
      {drain && (
        <div className="brain-callout drain" style={{ marginTop: 6 }}>
          <b>Why drain?</b> {drain.reason}
        </div>
      )}
      {reservation && !drain && (
        <div className="brain-callout info" style={{ marginTop: 6 }}>
          Free slot reserved for <b>{reservation.forMachine}</b> ({variant(reservation.variantId)?.name}) — other new variants may not take it.
        </div>
      )}
    </div>
  );
}

// ── Step 3: scoring table ─────────────────────────────────────────────────
function ScoreTable({ candidates }) {
  if (!candidates.length) {
    return <div className="brain-callout info">No machine is waiting. The brain is watching doff counts on all 16 autoconers.</div>;
  }
  const scale = Math.max(120, ...candidates.map((c) => c.components.filter((x) => x.key !== 'forced' && x.pts > 0).reduce((s, x) => s + x.pts, 0)));
  return (
    <div>
      <table className="score-table">
        <thead>
          <tr>
            <th>#</th>
            <th>MACHINE</th>
            <th>VARIANT</th>
            <th>WAIT</th>
            <th>CONE BUFFER</th>
            <th>SCORE BREAKDOWN</th>
            <th style={{ textAlign: 'right' }}>TOTAL</th>
            <th>DECISION</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const verdictKind = c.verdict.split(' ')[0];
            const bufColor = c.bufferPct >= 100 ? 'var(--accent-rose)' : c.bufferPct >= 70 ? 'var(--accent-amber)' : 'var(--accent-emerald)';
            const forced = c.components.some((x) => x.key === 'forced');
            return (
              <tr key={c.machineId} className={`${c.selected ? 'sel' : ''} ${c.stopped ? 'stopped' : ''}`}>
                <td className="mono" style={{ color: 'var(--text-muted)' }}>{c.rank}</td>
                <td className="mono" style={{ color: '#fff', fontWeight: 700 }}>
                  {c.machineId}
                  {c.urgent && <span style={{ color: 'var(--accent-amber)' }}> ★</span>}
                </td>
                <td><VariantTag id={c.variantId} /></td>
                <td className="mono">{c.waitSec}s</td>
                <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                  <span className="buf-bar"><span style={{ width: `${c.bufferPct}%`, background: bufColor }} /></span>
                  {c.stopped ? <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>STOPPED</span> : `${c.bufferPct}%`}
                </td>
                <td title={c.components.map((x) => `${x.label}: ${x.pts > 0 ? '+' : ''}${x.pts}`).join('\n')}>
                  <div className="stack-bar">
                    {c.components.filter((x) => x.pts > 0 && x.key !== 'forced').map((x) => (
                      <span key={x.key} style={{ width: `${(x.pts / scale) * 100}%`, background: COMPONENT_COLORS[x.key] }} />
                    ))}
                    {forced && <span style={{ flex: 1, background: COMPONENT_COLORS.forced }} />}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                    {c.components.filter((x) => x.pts !== 0).map((x) => `${x.pts > 0 ? '+' : ''}${x.pts} ${x.label.toLowerCase()}`).join(' · ')}
                  </div>
                </td>
                <td className="mono" style={{ textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: 12 }}>{c.total}</td>
                <td><div className={`verdict ${verdictKind}`}>{c.verdict}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="legend-row" style={{ marginTop: 8 }}>
        {Object.keys(COMPONENT_COLORS).map((k) => (
          <span key={k}><i style={{ background: COMPONENT_COLORS[k] }} />{COMPONENT_LABELS[k]}</span>
        ))}
      </div>
    </div>
  );
}

function Commands({ actions }) {
  if (!actions.length) return <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No command sent this cycle.</div>;
  return actions.map((a) => (
    <div className="cmd-item" key={a.machineId}>
      {a.explanation}
      <div className="plc">→ PLC WRITE: PERMIT_LOAD[{a.loaderId}] = 1 · BASKET_ID[{a.loaderId}] = {a.basketId} · VARIANT = {a.variantId}</div>
    </div>
  ));
}

function CycleView({ snap }) {
  const hot = (n) => {
    if (n === 2) return !!snap.drain || snap.notes.length > 0;
    if (n >= 4) return snap.actions.length > 0;
    if (n === 3) return snap.candidates.length > 0;
    return false;
  };
  const i = snap.inputs;
  const steps = [
    { icon: Radar, h: 'Sense', b: `${i.waiting} machine(s) waiting · 4Q ${i.qUsed}/${i.maxQ} · ${i.emptyBaskets} empty baskets · ${i.onRail} on rail` },
    { icon: Layers, h: 'Slot manager', b: `${i.slotsUsed}/${i.maxVariants} variant slots in use${snap.drain ? ' · draining ' + variant(snap.drain.variantId)?.name : ''}${snap.reservation ? ' · 1 reserved' : ''}` },
    { icon: Calculator, h: 'Score', b: snap.candidates.length ? `Ranked ${snap.candidates.length} machine(s). Top: ${snap.candidates[0].machineId} (${snap.candidates[0].total})` : 'Nothing to rank' },
    { icon: ShoppingBasket, h: 'Allocate basket', b: snap.actions.length ? snap.actions.map((a) => `${a.basketId}→${a.loaderId}`).join(', ') : 'No allocation' },
    { icon: Send, h: 'Command PLC', b: snap.actions.length ? `${snap.actions.length} permit(s) written` : 'Hold — no permit' },
  ];
  return (
    <>
      <div className="brain-pipeline">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={s.h} className={`brain-step ${hot(idx + 1) ? 'hot' : ''}`}>
              <div className="n" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon size={12} /> STEP {idx + 1}</div>
              <div className="h">{s.h}</div>
              <div className="b">{s.b}</div>
            </div>
          );
        })}
      </div>

      <div className="brain-callout info"><b>Cycle #{snap.cycleId} · T+{snap.t}s —</b> {snap.summary}</div>
      {snap.notes.map((n) => <div key={n} className="brain-callout warn">{n}</div>)}

      <div className="brain-grid-2">
        <div className="brain-card">
          <div className="brain-card-title"><span>STEP 2 · 4 VARIANT SLOTS</span></div>
          <SlotsView slots={snap.slots} drain={snap.drain} reservation={snap.reservation} />
        </div>
        <div className="brain-card" style={{ minWidth: 0, overflowX: 'auto' }}>
          <div className="brain-card-title"><span>STEP 3 · PRIORITY SCORING (every waiting machine)</span></div>
          <ScoreTable candidates={snap.candidates} />
        </div>
      </div>

      <div className="brain-card">
        <div className="brain-card-title"><span>STEP 4–5 · BASKET ALLOCATION & COMMANDS TO PLC</span></div>
        <Commands actions={snap.actions} />
      </div>
    </>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────
function LiveTab({ state, mode, brainOnline }) {
  const [frozen, setFrozen] = useState(null);
  const b = state.brain;
  const live = b?.lastCycle && b.lastCycle.candidates.length ? b.lastCycle : b?.lastActiveCycle || b?.lastCycle;
  const snap = frozen || live;

  return (
    <>
      {mode !== 'BRAIN' && (
        <div className="brain-callout warn">
          The plant is running <b>FIFO (customer spec)</b>. The brain is on standby — switch to <b>MASTER MIND</b> to let it decide.
          {snap && ' Showing the last cycle it ran.'}
        </div>
      )}
      {mode === 'BRAIN' && !brainOnline && (
        <div className="brain-callout drain">
          Brain heartbeat lost. The PLC has fallen back to plain FIFO with the 4-variant limit, so production keeps running. Restore it from “Rules & weights”.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          The brain re-decides every simulated second. {frozen ? 'View frozen — the plant keeps running.' : 'Live view.'}
        </span>
        <button className="brain-btn" onClick={() => setFrozen(frozen ? null : live)} disabled={!live}>
          {frozen ? <><Play size={12} /> Resume live view</> : <><Pause size={12} /> Freeze this cycle</>}
        </button>
      </div>
      {snap ? <CycleView snap={snap} /> : <div className="brain-callout info">Press START to run the plant. The brain’s first decision cycle will appear here.</div>}
      <div className="brain-card">
        <div className="brain-card-title"><span>DYNAMIC UNLOADER DECISIONS (where each loaded basket is sent)</span></div>
        {state.unloadDecisions?.length ? (
          state.unloadDecisions.slice(0, 6).map((d) => (
            <div className="cmd-item" key={`${d.t}-${d.basketId}`} style={{ borderLeftColor: '#c084fc' }}>
              <span className="mono" style={{ color: '#c4b5fd' }}>T+{d.t}s</span> · {d.text}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No basket has reached the unloaders yet.</div>
        )}
      </div>
    </>
  );
}

function noteTag(note) {
  if (note.startsWith('DRAIN')) return 'Drain started';
  if (note.startsWith('Slot of')) return 'Slot freed → reserved';
  if (note.startsWith('Drain of')) return 'Drain cancelled';
  return 'Slot change';
}

function LogTab({ decisions }) {
  const [selId, setSelId] = useState(null);
  const sel = decisions.find((d) => d.id === selId) || decisions[0];
  if (!decisions.length) return <div className="brain-callout info">No decisions yet. Every admission, drain and reservation the brain makes is recorded here with the full reasoning.</div>;
  return (
    <div className="log-layout">
      <div className="log-list">
        {decisions.map((d) => (
          <button key={d.id} className={`log-entry ${sel?.id === d.id ? 'active' : ''}`} onClick={() => setSelId(d.id)}>
            <div className="t">T+{d.t}s · CYCLE #{d.snapshot.cycleId}</div>
            <div>
              {d.actions.length > 0 && <b style={{ color: 'var(--accent-emerald)' }}>Admit {d.actions.map((a) => a.machineId).join(', ')}</b>}
              {d.actions.length > 0 && d.notes.length > 0 && ' · '}
              {d.notes.length > 0 && <b style={{ color: '#fb7185' }}>{noteTag(d.notes[0])}</b>}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{d.summary}</div>
          </button>
        ))}
      </div>
      <div className="log-detail">
        {sel && <CycleView snap={sel.snapshot} />}
      </div>
    </div>
  );
}

function RulesTab({ state, brainOnline, onSetWeights, onToggleUrgent, onSetBrainOnline }) {
  const w = state.brain.weights;
  return (
    <>
      <div className="brain-card">
        <div className="brain-card-title">
          <span>HARD RULES (never broken)</span>
        </div>
        <ul style={{ paddingLeft: 18, fontSize: 11.5, lineHeight: 1.7, color: 'var(--text-primary)' }}>
          <li>Maximum <b>4 loads</b> in progress at once (4Q).</li>
          <li>Maximum <b>4 variants</b> in the system (loading + on rail + unloading).</li>
          <li>No load permit without an assigned empty basket.</li>
          <li>A machine waiting longer than the anti-starvation limit gets forced priority.</li>
          <li>If the brain goes silent, the PLC falls back to FIFO with the same limits.</li>
        </ul>
      </div>

      <div className="brain-card">
        <div className="brain-card-title">
          <span>SCORING WEIGHTS (change live)</span>
          <button className="brain-btn" onClick={() => onSetWeights(DEFAULT_WEIGHTS)}><RotateCcw size={12} /> Defaults</button>
        </div>
        <div className="weights-grid">
          {WEIGHT_META.map((m) => (
            <div className="weight-row" key={m.key}>
              <label>{m.label} <span>{w[m.key]} {m.unit}</span></label>
              <input
                type="range"
                min={m.min}
                max={m.max}
                step={m.step}
                value={w[m.key]}
                onChange={(e) => onSetWeights({ [m.key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="brain-card">
        <div className="brain-card-title"><span>URGENT ORDERS (click to toggle)</span></div>
        <div className="chip-grid">
          {state.machines.map((m) => (
            <button key={m.id} className={`chip ${m.urgent ? 'on' : ''}`} onClick={() => onToggleUrgent(m.id)} title={variant(m.variantId)?.name}>
              {m.urgent ? '★ ' : ''}{m.id}
            </button>
          ))}
        </div>
      </div>

      <div className="brain-card">
        <div className="brain-card-title"><span>FAILURE TEST</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5 }}>
          <button className={`brain-btn ${brainOnline ? 'danger' : 'primary'}`} onClick={() => onSetBrainOnline(!brainOnline)}>
            <HeartPulse size={13} /> {brainOnline ? 'Simulate brain PC failure' : 'Restore brain heartbeat'}
          </button>
          <span style={{ color: 'var(--text-secondary)' }}>
            Shows the watchdog: when the heartbeat is lost the PLC keeps production running on plain FIFO.
          </span>
        </div>
      </div>
    </>
  );
}

function gainText(fifo, brain, lowerIsBetter) {
  if (!fifo && !brain) return '—';
  if (!fifo) return lowerIsBetter ? '—' : '+∞';
  const pct = ((brain - fifo) / fifo) * 100;
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return <span style={{ color: good ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{pct > 0 ? '+' : ''}{pct.toFixed(0)}%</span>;
}

function KpiTable({ fifo, brain }) {
  const fifoRan = fifo.simSec > 0;
  const brainRan = brain.simSec > 0;
  const rows = [
    { label: 'Baskets loaded per hour', k: 'loadsPerHour', lower: false },
    { label: 'Average wait after doff (s)', k: 'avgWait', lower: true },
    { label: 'Longest wait (s)', k: 'maxWait', lower: true },
    { label: 'Machine stop time (min)', k: 'stopMin', lower: true },
    { label: 'Machine stop time (% of capacity)', k: 'stopPct', lower: true },
    { label: 'Machine stop events', k: 'stopEvents', lower: true },
    { label: 'Cones loaded', k: 'cones', lower: false },
    { label: 'Loaded baskets recirculated (no unloader free)', k: 'recirc', lower: true },
  ];
  return (
    <table className="kpi-table">
      <thead>
        <tr><th>KPI</th><th>FIFO (SPEC)</th><th>MASTER MIND</th><th>CHANGE</th><th style={{ textAlign: 'left' }}></th></tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const a = fifoRan ? fifo[r.k] : null;
          const b = brainRan ? brain[r.k] : null;
          const max = Math.max(a || 0, b || 0, 0.0001);
          return (
            <tr key={r.k}>
              <td>{r.label}</td>
              <td className="fifo">{fifoRan ? a : 'not run'}</td>
              <td className="brain">{brainRan ? b : 'not run'}</td>
              <td className="gain">{fifoRan && brainRan ? gainText(a, b, r.lower) : '—'}</td>
              <td>
                <div className="cmp-bars">
                  <div style={{ width: `${((a || 0) / max) * 100}%`, background: 'var(--accent-amber)' }} />
                  <div style={{ width: `${((b || 0) / max) * 100}%`, background: '#a855f7' }} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PerformanceTab({ state, onRunComparison }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const live = { FIFO: summarizeKpi(state.kpi.FIFO), BRAIN: summarizeKpi(state.kpi.BRAIN) };

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      setResult(onRunComparison(3600));
      setBusy(false);
    }, 30);
  };

  return (
    <>
      <div className="brain-card">
        <div className="brain-card-title">
          <span>HEAD-TO-HEAD · 1 SIMULATED HOUR, SAME STARTING PLANT</span>
          <button className="brain-btn primary" onClick={run} disabled={busy}>
            <Trophy size={12} /> {busy ? 'Running both strategies…' : result ? 'Run again' : 'Run comparison'}
          </button>
        </div>
        {result ? (
          <>
            <KpiTable fifo={result.FIFO} brain={result.BRAIN} />
            <div className="brain-callout info" style={{ marginTop: 8 }}>
              Both strategies obey the same limits (4Q, 4 variants) on the same plant. The difference comes only from <b>who</b> the brain lets load and <b>when</b>.
              Uses the current scoring weights — change them in “Rules & weights” and run again.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Runs FIFO and Master Mind separately for one simulated hour from the reset state and compares the results. Takes about a second.
          </div>
        )}
      </div>

      <div className="brain-card">
        <div className="brain-card-title">
          <span>THIS SESSION (LIVE) · FIFO {live.FIFO.simSec}s · MASTER MIND {live.BRAIN.simSec}s</span>
        </div>
        <KpiTable fifo={live.FIFO} brain={live.BRAIN} />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          Switch between FIFO (SPEC) and MASTER MIND on the plant floor to fill both columns. Time counts toward whichever strategy is in control (fallback FIFO counts as FIFO). Rates are normalised per hour; totals are not.
        </div>
      </div>
    </>
  );
}

export default function BrainPanel({ isOpen, onClose, state, mode, brainOnline, onSetWeights, onToggleUrgent, onSetBrainOnline, onRunComparison }) {
  const [tab, setTab] = useState('live');
  if (!isOpen) return null;

  const tabs = [
    { id: 'live', label: 'LIVE THINKING' },
    { id: 'log', label: `DECISION LOG (${state.brain.decisions.length})` },
    { id: 'rules', label: 'RULES & WEIGHTS' },
    { id: 'perf', label: 'PERFORMANCE' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="brain-window" onClick={(e) => e.stopPropagation()}>
        <div className="brain-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={`brain-orb ${mode !== 'BRAIN' ? 'fifo' : !brainOnline ? 'offline' : ''}`} style={{ width: 36, height: 36, flexBasis: 36 }}>
              <Brain size={20} />
            </div>
            <div>
              <h2>MASTER MIND · DECISION ENGINE</h2>
              <div className="sub">
                <Activity size={10} style={{ verticalAlign: -1 }} />{' '}
                {mode === 'BRAIN' ? (brainOnline ? 'In control of loading' : 'OFFLINE — PLC fallback FIFO') : 'Standby — plant on FIFO (customer spec)'}
                {' · '}4Q {state.fifoQueue.length}/4 · variant slots {state.activeVariantIds.length}/4 · {state.stats?.waitingMachines ?? 0} waiting · {state.stats?.stoppedMachines ?? 0} stopped
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="brain-tabs">
          {tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="brain-body">
          {tab === 'live' && <LiveTab state={state} mode={mode} brainOnline={brainOnline} />}
          {tab === 'log' && <LogTab decisions={state.brain.decisions} />}
          {tab === 'rules' && (
            <RulesTab state={state} brainOnline={brainOnline} onSetWeights={onSetWeights} onToggleUrgent={onToggleUrgent} onSetBrainOnline={onSetBrainOnline} />
          )}
          {tab === 'perf' && <PerformanceTab state={state} onRunComparison={onRunComparison} />}
        </div>
      </div>
    </div>
  );
}
