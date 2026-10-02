import React, { useMemo } from 'react';
import { TRACK_PATH_D, pointAtProgress } from '../simulation/trackGeometry';

const CENTER = { x: 720, y: 340 };

// Unit vector pointing away from the middle of the loop at a given progress
function outward(p) {
  const a = pointAtProgress(p - 0.002);
  const b = pointAtProgress(p + 0.002);
  let nx = -(b.y - a.y);
  let ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;
  const pt = pointAtProgress(p);
  if ((pt.x - CENTER.x) * nx + (pt.y - CENTER.y) * ny < 0) { nx = -nx; ny = -ny; }
  return { nx, ny };
}

const LOADER_STATE = (l, buffer) => {
  if (l.stopped) return { label: 'STOPPED', color: 'var(--accent-rose)' };
  if (l.permit) return { label: 'LOADING', color: 'var(--accent-amber)' };
  if (l.eligibleSince !== null) return { label: 'WAITING', color: '#fbbf24' };
  return { label: l.count >= buffer * 0.7 ? 'FILLING' : 'RUNNING', color: '#94a3b8' };
};

export default function DynamicPlant({ view, d, onSelect, sel, children }) {
  const { cfg } = d;

  // Static layout from the configuration
  const layout = useMemo(() => {
    const prog = (slot) => slot / d.slots;
    const loaders = d.loaderSlots.map((slot, i) => {
      const p = prog(slot);
      const pt = pointAtProgress(p);
      const n = outward(p);
      return { i, p, pt, n };
    });
    const spacingPx = loaders.length > 1
      ? Math.min(...loaders.slice(1).map((l, i) => Math.hypot(l.pt.x - loaders[i].pt.x, l.pt.y - loaders[i].pt.y)))
      : 80;
    const cardW = Math.max(24, Math.min(66, spacingPx - 6));
    const unloaders = d.unloaderSlots.map((slot, j) => {
      const p = prog(slot);
      return { j, p, pt: pointAtProgress(p), n: outward(p) };
    });
    const uSpacing = unloaders.length > 1
      ? Math.min(...unloaders.slice(1).map((u, i) => Math.hypot(u.pt.x - unloaders[i].pt.x, u.pt.y - unloaders[i].pt.y)))
      : 90;
    const uW = Math.max(34, Math.min(84, uSpacing - 8));
    const nSt = cfg.palletStations;
    const xs = unloaders.map((u) => u.pt.x);
    let lo = Math.max(40, Math.min(...xs) - 380);
    let hi = Math.min(1410, Math.max(...xs) + 90);
    if (hi - lo < nSt * 40) { lo = Math.max(30, hi - nSt * 60); }
    const stW = Math.min(74, (hi - lo) / nSt - 6);
    const stations = Array.from({ length: nSt }, (_, k) => ({ k, x: lo + k * ((hi - lo) / nSt), y: 606, w: stW }));
    const r0 = { p: 0, pt: pointAtProgress(0), n: outward(0.0005) };
    const lastU = Math.max(...d.unloaderSlots);
    const ret = { p: (lastU + 1.5) / d.slots };
    ret.pt = pointAtProgress(ret.p); ret.n = outward(ret.p);
    return { loaders, cardW, unloaders, uW, stations, r0, ret };
  }, [d, cfg.palletStations]);

  const posOf = (b) => ((b.chainSlot + view.chainIdx + view.chainFrac) % d.slots) / d.slots;
  const vColor = (v) => view.varieties[v]?.color || '#64748b';

  return (
    <div className="dyn-plant">
      <svg viewBox="0 0 1440 680" preserveAspectRatio="xMidYMid meet" className="dyn-plant-svg">
        <path d={TRACK_PATH_D} fill="none" stroke="#0f192e" strokeWidth="22" />
        <path d={TRACK_PATH_D} fill="none" stroke="#1e3256" strokeWidth="12" />
        <path d={TRACK_PATH_D} fill="none" stroke="#2563eb" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="10 8">
          {!view.stats.chainStopped && <animate attributeName="stroke-dashoffset" from="0" to="-72" dur="3s" repeatCount="indefinite" />}
        </path>

        {/* Pallet stations (dynamic assignment) */}
        {layout.stations.map(({ k, x, y, w }) => {
          const st = view.stations[k];
          const u = layout.unloaders[st.unloader];
          const color = st.variety >= 0 ? vColor(st.variety) : '#334155';
          const fill = Math.min(1, st.pallet / cfg.conesPerPallet);
          return (
            <g key={st.id} style={{ cursor: 'pointer' }} onClick={() => onSelect({ type: 'station', id: st.id })}>
              {u && <line x1={x + w / 2} y1={y} x2={u.pt.x} y2={u.pt.y + u.n.ny * (40 + 17)} stroke="#1e3a5f" strokeWidth="1" strokeDasharray="3 3" />}
              <rect x={x} y={y} width={w} height="60" rx="4" fill="#0a1224" stroke={st.status === 'ACTIVE' ? color : st.status === 'HELD' ? '#64748b' : '#1e293b'} strokeWidth={st.status === 'ACTIVE' ? 1.6 : 1} />
              <rect x={x} y={y} width={w} height="12" rx="3" fill={st.variety >= 0 ? color : '#1e293b'} fillOpacity={st.status === 'ACTIVE' ? 0.9 : 0.35} />
              <text x={x + 4} y={y + 9} fontSize="8" fill="#0b1020" fontFamily="JetBrains Mono" fontWeight="bold">{st.id}</text>
              <text x={x + 4} y={y + 23} fontSize="7" fill="#94a3b8" fontFamily="JetBrains Mono">{st.status === 'FREE' ? 'free' : `${st.status === 'HELD' ? 'held' : 'lot'} ${st.lot}`}</text>
              {Array.from({ length: cfg.conesPerAccumulator }, (_, i) => (
                <circle key={i} cx={x + 7 + i * Math.min(10, (w - 10) / cfg.conesPerAccumulator)} cy={y + 33} r="3" fill={i < st.acc ? color : '#1e293b'} />
              ))}
              <rect x={x + 4} y={y + 42} width={w - 8} height="6" rx="2" fill="#111b30" />
              <rect x={x + 4} y={y + 42} width={(w - 8) * fill} height="6" rx="2" fill={color} />
              <text x={x + 4} y={y + 58} fontSize="7" fill="#cbd5e1" fontFamily="JetBrains Mono">{st.pallet}/{cfg.conesPerPallet}</text>
            </g>
          );
        })}

        {/* Unloaders */}
        {layout.unloaders.map(({ j, pt, n }) => {
          const u = view.unloaders[j];
          const busy = u.cooldown > 0;
          const cx = pt.x + n.nx * 40;
          const cy = pt.y + n.ny * 40;
          const w = layout.uW;
          return (
            <g key={u.id} style={{ cursor: 'pointer' }} onClick={() => onSelect({ type: 'unloader', id: u.id })}>
              <line x1={pt.x} y1={pt.y} x2={cx} y2={cy} stroke="#334155" strokeWidth="2" />
              <rect x={cx - w / 2} y={cy - 17} width={w} height="34" rx="4" fill="#0b1324" stroke={busy ? '#c084fc' : '#1d3054'} strokeWidth="1.4" />
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="#fff" fontFamily="JetBrains Mono" fontWeight="bold">{u.id}</text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7" fill={busy ? '#d8b4fe' : '#64748b'} fontFamily="JetBrains Mono">{busy ? `busy ${u.cooldown}s` : 'ready'}</text>
            </g>
          );
        })}

        {/* Loaders with their autoconers */}
        {layout.loaders.map(({ i, pt, n }) => {
          const l = view.loaders[i];
          const st = LOADER_STATE(l, cfg.loaderBufferCones);
          const w = layout.cardW;
          const h = 48;
          const cx = pt.x + n.nx * (h / 2 + 22);
          const cy = pt.y + n.ny * (h / 2 + 22);
          const fill = Math.min(1, l.count / cfg.loaderBufferCones);
          const color = vColor(l.variety);
          return (
            <g key={l.id} style={{ cursor: 'pointer' }} onClick={() => onSelect({ type: 'loader', id: l.id })}>
              <line x1={pt.x} y1={pt.y} x2={cx - n.nx * (h / 2)} y2={cy - n.ny * (h / 2)} stroke={l.permit ? 'var(--accent-amber)' : '#25385e'} strokeWidth={l.permit ? 2.5 : 1.5} />
              <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="4" fill="#0a1224" stroke={l.stopped ? 'var(--accent-rose)' : l.permit ? 'var(--accent-amber)' : '#1a2b4c'} strokeWidth={l.permit || l.stopped ? 1.6 : 1} />
              <rect x={cx - w / 2} y={cy - h / 2} width={w} height="12" rx="3" fill={color} fillOpacity="0.85" />
              <text x={cx} y={cy - h / 2 + 9} textAnchor="middle" fontSize="8" fill="#0b1020" fontFamily="JetBrains Mono" fontWeight="bold">{l.id}</text>
              <text x={cx} y={cy + 2} textAnchor="middle" fontSize="8" fill="#e2e8f0" fontFamily="JetBrains Mono">{l.count}/{cfg.loaderBufferCones}</text>
              <rect x={cx - w / 2 + 4} y={cy + 7} width={w - 8} height="5" rx="2" fill="#111b30" />
              <rect x={cx - w / 2 + 4} y={cy + 7} width={(w - 8) * fill} height="5" rx="2" fill={fill >= 1 ? 'var(--accent-rose)' : fill >= 0.7 ? 'var(--accent-amber)' : color} />
              {w >= 44 && <text x={cx} y={cy + 20} textAnchor="middle" fontSize="6.5" fill={st.color} fontFamily="JetBrains Mono" fontWeight="bold">{st.label}</text>}
            </g>
          );
        })}

        {/* Origin reader R0 and the return point */}
        {(() => {
          const { pt, n } = layout.r0;
          const tx = pt.x - n.nx * 30;
          const ty = pt.y - n.ny * 30;
          return (
            <g>
              <line x1={pt.x + n.nx * 12} y1={pt.y + n.ny * 12} x2={pt.x - n.nx * 14} y2={pt.y - n.ny * 14} stroke="#22d3ee" strokeWidth="3" />
              <circle cx={pt.x} cy={pt.y} r="5" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
              <text x={tx} y={ty} textAnchor="middle" fontSize="9" fill="#22d3ee" fontFamily="JetBrains Mono" fontWeight="bold">R0 · 0 m</text>
              <text x={tx} y={ty + 10} textAnchor="middle" fontSize="7" fill="#67e8f9" fontFamily="JetBrains Mono">= {d.loopLength.toFixed(0)} m end · reads {view.rfid.lastR0.id}</text>
            </g>
          );
        })()}
        {(() => {
          const { pt, n } = layout.ret;
          return (
            <g>
              <line x1={pt.x + n.nx * 10} y1={pt.y + n.ny * 10} x2={pt.x - n.nx * 10} y2={pt.y - n.ny * 10} stroke="#f43f5e" strokeWidth="2" strokeDasharray="2 2" />
              <text x={pt.x - n.nx * 22} y={pt.y - n.ny * 22 + 3} textAnchor="middle" fontSize="7" fill="#fb7185" fontFamily="JetBrains Mono">return point</text>
            </g>
          );
        })()}

        {/* All baskets on the chain */}
        {view.baskets.map((b) => {
          const { x, y } = pointAtProgress(posOf(b));
          const loaded = b.variety >= 0;
          return (
            <g key={b.id} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} style={{ cursor: 'pointer' }} onClick={() => onSelect({ type: 'basket', id: b.id })}>
              <rect x="-3" y="2" width="6" height="8" rx="1" fill={loaded ? vColor(b.variety) : '#0b1222'} stroke={loaded && b.laps > 0 ? 'var(--accent-rose)' : loaded ? '#e2e8f0' : '#334155'} strokeWidth={loaded && b.laps > 0 ? 1.4 : 0.6} />
              {sel?.type === 'basket' && sel.id === b.id && (
                <>
                  <circle cx="0" cy="6" r="9" fill="none" stroke="#fde047" strokeWidth="1.8" />
                  <text x="0" y="-6" textAnchor="middle" fontSize="8" fill="#fde047" fontFamily="JetBrains Mono" fontWeight="bold">{b.id}</text>
                </>
              )}
            </g>
          );
        })}

        <g fontFamily="JetBrains Mono" fontSize="9" fill="#475569" fontWeight="bold">
          <text x="40" y="24">{cfg.basketCount} baskets · {d.loopLength.toFixed(0)} m loop · {cfg.speedMPerMin} m/min · {cfg.stationMode === 'ON_THE_FLY' ? 'loading on the move' : 'chain stops at stations'}</text>
          {view.stats.chainStopped && <text x="1400" y="24" textAnchor="end" fill="var(--accent-amber)">CHAIN STOPPED {view.dwell}s</text>}
        </g>
      </svg>
      {children}
    </div>
  );
}
