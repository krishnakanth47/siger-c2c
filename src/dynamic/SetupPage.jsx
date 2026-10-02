import React, { useEffect, useMemo, useState } from 'react';
import SetupTabs from './SetupTabs';
import { Play, RotateCcw, Settings2, AlertTriangle, XCircle, CheckCircle2, History, FileSpreadsheet, Layers, Activity } from 'lucide-react';
import { DEFAULT_CONFIG, REQUIREMENT_ROWS, EXTRA_FIELDS, ALL_FIELDS, derive, normaliseConfig, varietyInfo, fmtDuration, defaultLoaderVarieties, setVarietyNames, spacingPositions } from './config';
import './dynamic.css';

function Field({ f, value, onChange, compact }) {
  if (f.type === 'select') {
    return (
      <label className="dyn-field">
        {!compact && <span>{f.label}</span>}
        <select value={value} onChange={(e) => onChange(typeof f.options[0][0] === 'number' ? Number(e.target.value) : e.target.value)}>
          {f.options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
    );
  }
  const bad = value === '' || Number(value) < f.min || Number(value) > f.max;
  return (
    <label className="dyn-field">
      {!compact && <span>{f.label}</span>}
      <div className={`dyn-input ${bad ? 'bad' : ''}`}>
        <input type="number" min={f.min} max={f.max} step={f.step} value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
        {f.unit && <em>{f.unit}</em>}
      </div>
      {f.hint && <small>{f.hint}</small>}
    </label>
  );
}

const INFO_OUTPUTS = [
  ['Category-wise packages in OHC conveyor', 'live count and bar per variant of cones riding the loop'],
  ['No of packages returned after unloader', 'per variant, plus total and baskets going round right now'],
  ['Lot change remaining cones', 'old-lot cones still at loaders, on the loop and in the accumulator'],
];

export default function SetupPage({ initial, onStart, onClassic, onDraft, onTab }) {
  const [cfg, setCfg] = useState(() => normaliseConfig(initial || DEFAULT_CONFIG));
  const set = (key, value) => setCfg((c) => {
    const next = { ...c, [key]: value };
    // "Cones per hour per variant" is the value for all variants
    if (key === 'conesPerHourPerVariety' && value !== '') next.varietyRate = c.varietyRate.map(() => value);
    // Switching to layout positions starts from the positions the spacing rule gives now
    if (key === 'positionMode' && value === 'LAYOUT') { const sp = spacingPositions(c); next.loaderPosM = sp.loaders; next.unloaderPosM = sp.unloaders; }
    return normaliseConfig(next);
  });
  const setArr = (key, i, value) => setCfg((c) => {
    const arr = [...c[key]];
    arr[i] = value;
    return normaliseConfig({ ...c, [key]: arr });
  });
  setVarietyNames(cfg.varietyName);
  useEffect(() => { if (onDraft) onDraft(cfg); }, [cfg, onDraft]);

  const badRate = cfg.varietyRate.some((r) => r === '' || Number(r) < 0 || Number(r) > 1000);
  const badLot = cfg.varietyLot.some((r) => r === '' || Number(r) < 1);
  const invalid = ALL_FIELDS.filter((f) => f.type !== 'select' && (!f.showIf || f.showIf(cfg)) && (cfg[f.key] === '' || Number(cfg[f.key]) < f.min || Number(cfg[f.key]) > f.max));
  const invalidNames = [...invalid.map((f) => f.label), ...(badRate ? ['cones/h in the variant table'] : []), ...(badLot ? ['lot numbers in the variant table'] : [])];
  const d = useMemo(() => (invalidNames.length ? null : derive(cfg)), [cfg, invalidNames.length]);
  const canStart = d && !d.errors.length;
  const loadersOf = (v) => cfg.loaderVariety.filter((x) => x === v).length;
  const mixedRates = new Set(cfg.varietyRate.map(Number)).size > 1;

  const defaults = () => setCfg(normaliseConfig({ ...DEFAULT_CONFIG, loaderVariety: defaultLoaderVarieties(DEFAULT_CONFIG.loaderCount, DEFAULT_CONFIG.varieties) }));

  return (
    <div className="dyn-page">
      <header className="dyn-top">
        <div className="dyn-brand">
          <div className="brand-badge">SIEGER</div>
          <div>
            <h1>OHC dynamic simulation — plant setup</h1>
            <p>Every entry of Requirements.xlsx, in the sheet's order. Defaults are the customer values; change any of them and build the plant.</p>
          </div>
        </div>
        <div className="dyn-top-actions">
          <button className="dyn-btn ghost" onClick={onClassic} title="The earlier fixed 280-basket demo"><History size={14} /> Classic demo</button>
          <button className="dyn-btn" onClick={defaults}><RotateCcw size={14} /> Customer defaults</button>
          <button className="dyn-btn primary" disabled={!canStart} onClick={() => onStart(cfg)}><Play size={14} /> Build plant &amp; start</button>
        </div>
      </header>
      {onTab && <SetupTabs tab="setup" onTab={onTab} />}

      <div className="dyn-setup-grid">
        <div className="dyn-setup-forms">
          <section className="dyn-card">
            <h2><FileSpreadsheet size={15} /> Requirements.xlsx — plant entries</h2>
            <div className="req-head"><span>#</span><span>Requirement</span><span>Entry</span></div>
            {REQUIREMENT_ROWS.map((r) => (
              <div className="req-row" key={r.no}>
                <b className="req-no">{r.no}</b>
                <div className="req-text">
                  {r.req}
                  <small>Sheet: {r.sheet}</small>
                </div>
                <div className="req-entry">
                  {r.fields && r.fields.filter((f) => !f.showIf || f.showIf(cfg)).map((f, i) => (
                    <Field key={f.key} f={f} value={cfg[f.key]} onChange={(v) => set(f.key, v)} compact={i === 0} />
                  ))}
                  {r.no === 11 && mixedRates && <small className="req-link">Variants have different rates — see the variant table</small>}
                  {r.no === 14 && <small className="req-link">Current lot no. of each variant → variant table · the lot change itself is done live with ↻ in the simulation</small>}
                  {r.no === 16 && <small className="req-link">High-demand variants → variant table</small>}
                  {r.special === 'loaders' && (
                    <div className="req-summary">
                      {cfg.loaderCount} loaders assigned →{' '}
                      {Array.from({ length: cfg.varieties }, (_, v) => loadersOf(v) ? `${varietyInfo(v).name} ×${loadersOf(v)}` : null).filter(Boolean).join(' · ')}
                      <small className="req-link">Edit per loader in "Loader → variant" below</small>
                    </div>
                  )}
                  {r.special === 'info' && (
                    <ul className="req-info">
                      {INFO_OUTPUTS.map(([t, s]) => <li key={t}><Activity size={11} /> <b>{t}</b> — {s}</li>)}
                      <small className="req-link">Shown live on the simulation page, side panel "Information (dynamic)"</small>
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </section>

          <section className="dyn-card">
            <h2><Layers size={15} /> Variant table <em className="dyn-h2note">rows 2 · 11 · 14 · 16</em></h2>
            <div className="var-table">
              <div className="var-th"><span /><span>Variant name</span><span>Cones / h</span><span>Loaders</span><span>Current lot no.</span><span>High demand</span></div>
              {Array.from({ length: cfg.varieties }, (_, v) => (
                <div className="var-tr" key={v}>
                  <i style={{ background: varietyInfo(v).color }} />
                  <input type="text" value={cfg.varietyName[v]} onChange={(e) => setArr('varietyName', v, e.target.value)} />
                  <input type="number" min={0} max={1000} value={cfg.varietyRate[v]} onChange={(e) => setArr('varietyRate', v, e.target.value === '' ? '' : Number(e.target.value))} />
                  <span className={loadersOf(v) ? '' : 'none'}>{loadersOf(v) || 'none'}</span>
                  <input type="number" min={1} value={cfg.varietyLot[v]} onChange={(e) => setArr('varietyLot', v, e.target.value === '' ? '' : Number(e.target.value))} />
                  <label className="var-chk"><input type="checkbox" checked={cfg.varietyDemand[v]} onChange={(e) => setArr('varietyDemand', v, e.target.checked)} /> ★</label>
                </div>
              ))}
            </div>
            <p className="dyn-note">
              A variant's cones/h is shared between its loaders. High demand gives the variant priority when the loader-start rule includes demand; it can also be switched live with ★ in the simulation.
            </p>
          </section>

          <section className="dyn-card">
            <h2><Settings2 size={15} /> Loader → variant <em className="dyn-h2note">row 12 · entry for all loaders</em></h2>
            <div className="dyn-loader-grid">
              {cfg.loaderVariety.map((v, i) => (
                <label key={i} className="dyn-loader-cell">
                  <span><i style={{ background: varietyInfo(v).color }} />L{String(i + 1).padStart(2, '0')}</span>
                  <select value={v} onChange={(e) => setArr('loaderVariety', i, Number(e.target.value))}>
                    {Array.from({ length: cfg.varieties }, (_, k) => <option key={k} value={k}>{varietyInfo(k).name}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="dyn-card">
            <h2><Settings2 size={15} /> Other settings <em className="dyn-h2note">not in the sheet — assumed, change to the real values</em></h2>
            <div className="dyn-fields">
              {EXTRA_FIELDS.map((f) => <Field key={f.key} f={f} value={cfg[f.key]} onChange={(v) => set(f.key, v)} />)}
            </div>
          </section>
        </div>

        <aside className="dyn-card dyn-derived">
          <h2><CheckCircle2 size={15} /> What these values give</h2>
          {!d ? (
            <div className="dyn-msg error"><XCircle size={14} /> Fill every field with a value in range: {invalidNames.join(', ')}.</div>
          ) : (
            <>
              <table className="dyn-kv">
                <tbody>
                  <tr><td>OHC loop length</td><td>{d.loopLength.toFixed(1)} m ({d.slots} basket positions)</td></tr>
                  <tr><td>A basket passes a station every</td><td>{d.slotTime.toFixed(1)} s</td></tr>
                  <tr><td>One full loop</td><td>{fmtDuration(d.loopSeconds)}</td></tr>
                  <tr><td>Distance to first unloader</td><td>{d.distToUnloader.toFixed(1)} m · {fmtDuration(d.travelToUnloaderSec)}</td></tr>
                  <tr><td>Autoconer output</td><td>{d.productionPerHour} cones/h</td></tr>
                  <tr><td>Design throughput</td><td>{cfg.packagesPerHour} packages/h</td></tr>
                  <tr><td>Basket passes per hour</td><td>{Math.round(d.basketPassesPerHour)}</td></tr>
                  <tr><td>Loader cycle on the moving chain</td><td>every {d.loadSlots}th basket = {d.loadCycleSec.toFixed(1)} s</td></tr>
                  <tr><td>Unloader cycle on the moving chain</td><td>every {d.unloadSlots}th basket = {d.unloadCycleSec.toFixed(1)} s</td></tr>
                  <tr><td>Loader capacity</td><td>{Math.round(3600 / d.loadCycleSec)} /h each · {Math.round(d.loaderCapacity)} /h all</td></tr>
                  <tr><td>Unloader capacity</td><td>{Math.round(3600 / d.unloadCycleSec)} /h each · {Math.round(d.unloaderCapacity)} /h all</td></tr>
                  <tr><td>Loading streams one unloader can take</td><td>{d.streamCapacity.toFixed(2)} ({d.loadCycleSec.toFixed(1)} ÷ {d.unloadCycleSec.toFixed(1)} s)</td></tr>
                  <tr><td>Loader → unloader travel</td><td>{fmtDuration(d.travelMinSec)} – {fmtDuration(d.travelMaxSec)}</td></tr>
                  <tr><td>Empty return (last unloader → R0)</td><td>{fmtDuration(d.returnSec)}</td></tr>
                  <tr><td>Variety slots needed (estimate)</td><td>{d.slotsNeeded} of {cfg.varietyLimitMode === 'AUTO' ? `auto ≤ ${cfg.palletStations} (stations)` : cfg.maxVarietiesOnLoop}</td></tr>
                  <tr><td>Pallet stations per unloader</td><td>{Array.from({ length: cfg.unloaderCount }, (_, j) => d.stationUnloader.filter((u) => u === j).length).join(' · ')}</td></tr>
                  <tr><td>Loader start rule</td><td>{{ BOTH: 'demand + unloader', DEMAND: 'demand', UNLOADER: 'unloader requirement' }[cfg.loaderStartRule]}</td></tr>
                  <tr><td>Lot change</td><td>{cfg.lotChangePriority === 'HIGH' ? 'high priority' : 'normal priority'}</td></tr>
                </tbody>
              </table>
              {d.errors.map((m) => <div key={m} className="dyn-msg error"><XCircle size={14} /> {m}</div>)}
              {d.warnings.map((m) => <div key={m} className="dyn-msg warn"><AlertTriangle size={14} /> {m}</div>)}
              {!d.errors.length && !d.warnings.length && <div className="dyn-msg ok"><CheckCircle2 size={14} /> Values are consistent — ready to build.</div>}
              <h3 style={{ marginTop: 12 }}>Positions measured from origin R0 <span>0 m = {d.loopLength.toFixed(1)} m</span></h3>
              <table className="dyn-kv pos-table">
                <thead><tr><td>Point</td><td>From R0</td><td>Pitch</td></tr></thead>
                <tbody>
                  {d.stationTable.map((p) => {
                    const editable = cfg.positionMode === 'LAYOUT' && (p.kind === 'loader' || p.kind === 'unloader');
                    const key = p.kind === 'loader' ? 'loaderPosM' : 'unloaderPosM';
                    const i = Number(p.id.slice(1)) - 1;
                    return (
                      <tr key={p.id}>
                        <td>{p.id === 'END' ? 'Loop end (= R0)' : p.id === 'R0' ? 'R0 origin reader' : p.id}</td>
                        <td>{editable
                          ? <input className="pos-in" type="number" step="0.1" min="0" value={cfg[key][i]} onChange={(e) => setArr(key, i, e.target.value === '' ? '' : Number(e.target.value))} />
                          : `${p.m.toFixed(1)} m`}</td>
                        <td>{p.slot}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="dyn-note">
                Every basket carries an RFID tag. R0 is the origin: at commissioning one loop is run and R0 records the order of all tags (B001, B002 …).
                Then position = (places ahead of the basket last read at R0 + pitch pulses since) × pitch, and the distance to a station = (station − basket) mod loop length.
                {cfg.positionMode === 'LAYOUT' ? 'Layout mode: type each station position (m from R0) from the layout drawing; it is placed on the nearest basket pitch.' : 'To enter the real positions from the layout drawing, set "Station positions" to "From the layout" under Other settings.'}
              </p>
              <p className="dyn-note">
                Loading / unloading time is the station cycle time when the chain runs continuously, or the stop time when "chain stops" is chosen.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
