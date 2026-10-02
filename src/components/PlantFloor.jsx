import React, { useRef } from 'react';
import { VARIANTS } from '../constants/simulationConstants';
import { pointAtProgress, TRACK_PATH_D } from '../simulation/trackGeometry';

export default function PlantFloor({
  machines,
  loaders,
  baskets,
  unloaders,
  palletStations,
  storyActiveTarget,
  onSelectEntity,
  onTriggerManualDoff,
  children,
}) {
  const pathRef = useRef(null);

  // SVG 1440 x 680. The closed OHC loop is defined once in trackGeometry.js so the
  // simulation and the drawing use exactly the same rail. Baskets are placed with
  // pointAtProgress(); 0…1 runs L01 → L16 → right leg → U01 → U04 → return leg.
  const trackPathD = TRACK_PATH_D;

  return (
    <div className="plant-floor-container">
      <svg
        viewBox="0 0 1440 680"
        className="plant-floor-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Rail linear gradient */}
          <linearGradient id="mainRailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="50%" stopColor="#00f0ff" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>

          {/* Scanner laser beam gradient */}
          <linearGradient id="laserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>

          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* FACTORY CEILING TRUSSES & STRUCTURAL GRID */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <g stroke="#141f38" strokeWidth="1.5" opacity="0.5">
          {/* Vertical columns */}
          {[120, 280, 440, 600, 760, 920, 1080, 1240].map((cx) => (
            <line key={`truss-${cx}`} x1={cx} y1="0" x2={cx} y2="680" strokeDasharray="6 8" />
          ))}
          {/* Horizontal crane rails */}
          <line x1="0" y1="200" x2="1440" y2="200" />
          <line x1="0" y1="480" x2="1440" y2="480" />
        </g>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* OHC CONTINUOUS CLOSED-LOOP OVERHEAD RAIL TRACK */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* Rail Base Steel I-Beam */}
        <path
          d={trackPathD}
          fill="none"
          stroke="#0f192e"
          strokeWidth="24"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={trackPathD}
          fill="none"
          stroke="#1e3256"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Electric Power Bus Bar with animated dash translation */}
        <path
          ref={pathRef}
          d={trackPathD}
          fill="none"
          stroke="url(#mainRailGrad)"
          strokeWidth="3.5"
          strokeDasharray="10 8"
          filter="url(#cyanGlow)"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-72"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </path>

        {/* Directional Flow Chevrons */}
        <g fill="#0284c7" opacity="0.7">
          <polygon points="380,136 392,140 380,144" />
          <polygon points="760,136 772,140 760,144" />
          <polygon points="1140,136 1152,140 1140,144" />
          <polygon points="1406,300 1410,314 1414,300" />
          <polygon points="1060,536 1048,540 1060,544" />
          <polygon points="680,536 668,540 680,544" />
          <polygon points="300,536 288,540 300,544" />
          <polygon points="16,360 20,346 24,360" />
        </g>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* OPTICAL PROXIMITY SENSORS & BARCODE SCANNER (RIGHT TRANSIT LEG) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* Optical Barcode Scanner Station */}
        <g transform="translate(1395, 340)">
          <rect x="-18" y="-20" width="36" height="40" rx="3" fill="#0d182e" stroke="#2d4370" strokeWidth="1.5" />
          <circle cx="0" cy="-6" r="4" fill="var(--accent-rose)" />
          {/* Laser scan beam */}
          <polygon points="-12,-6 12,-6 30,30 -30,30" fill="url(#laserGrad)">
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.2s" repeatCount="indefinite" />
          </polygon>
          <text x="0" y="14" textAnchor="middle" fill="#94a3b8" fontSize="7" fontFamily="JetBrains Mono" fontWeight="bold">
            SCANNER
          </text>
        </g>

        {/* Optical proximity sensors on track */}
        {[
          { x: 300, y: 126, id: 'S1' },
          { x: 700, y: 126, id: 'S2' },
          { x: 1100, y: 126, id: 'S3' },
          { x: 1416, y: 240, id: 'S4' },
          { x: 1416, y: 440, id: 'S5' },
          { x: 900, y: 554, id: 'S6' },
          { x: 500, y: 554, id: 'S7' },
        ].map((s) => (
          <g key={s.id} transform={`translate(${s.x}, ${s.y})`}>
            <circle cx="0" cy="0" r="3" fill="#10b981" filter="url(#cyanGlow)">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* TOP LEG: 16 RING FRAMES (M01-M16) INLINE WITH 16 LOADERS (L01-L16) */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {machines.map((machine, i) => {
          const x = 75 + i * 78;
          const variant = VARIANTS.find((v) => v.id === machine.variantId);
          const loader = loaders[i] || loaders[0];
          const isStory = storyActiveTarget === machine.id || storyActiveTarget === loader.id;
          const isDoffFinished = machine.doffCount >= machine.targetDoff;
          const isLoading = loader.status === 'LOADING' || loader.status === 'READY'; // filling magazine or waiting for its basket

          return (
            <g key={machine.id} transform={`translate(${x}, 20)`}>
              {/* Vertical Structural Feeder Chute from Machine down to Loader */}
              <rect
                x="32"
                y="65"
                width="6"
                height="36"
                fill="#16223b"
                stroke="#25385e"
                strokeWidth="1"
              />

              {/* Animated feeder drop action when loading */}
              {isLoading && (
                <circle cx="35" cy="90" r="4" fill={variant?.color || '#00f0ff'} filter="url(#cyanGlow)">
                  <animate attributeName="cy" from="65" to="100" dur="0.8s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Loader Spur Dock on the Rail */}
              <g
                transform="translate(18, 100)"
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectEntity({ type: 'loader', data: loader, variant })}
              >
                <rect
                  x="0"
                  y="0"
                  width="34"
                  height="16"
                  rx="2"
                  fill="#0b1324"
                  stroke={isLoading ? 'var(--accent-amber)' : '#1e3357'}
                  strokeWidth="1.2"
                />
                <text x="17" y="11" textAnchor="middle" fill={isLoading ? '#fbbf24' : '#94a3b8'} fontSize="8" fontFamily="JetBrains Mono" fontWeight="bold">
                  {loader.id}
                </text>
                {/* Loader status LED */}
                <circle
                  cx="28"
                  cy="4"
                  r="2"
                  fill={isLoading ? 'var(--accent-amber)' : loader.status === 'AVAILABLE' ? 'var(--accent-emerald)' : '#64748b'}
                />
              </g>

              {/* Ring Frame Machine Node */}
              <g
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectEntity({ type: 'machine', data: machine, variant })}
              >
                {/* Machine housing box */}
                <rect
                  x="0"
                  y="0"
                  width="70"
                  height="65"
                  rx="4"
                  fill="#0a1224"
                  stroke={isStory ? 'var(--accent-purple)' : machine.status === 'BUFFER_FULL' ? 'var(--accent-rose)' : isDoffFinished ? 'var(--accent-amber)' : '#1a2b4c'}
                  strokeWidth={isStory ? 2 : 1.2}
                  filter={isDoffFinished ? 'url(#amberGlow)' : undefined}
                />

                {/* Header ID + Variant Swatch */}
                <rect x="2" y="2" width="66" height="14" rx="2" fill="#131e36" />
                <text x="6" y="12" fill="#ffffff" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
                  {machine.id}
                </text>
                <circle cx="58" cy="9" r="4" fill={variant?.color || '#00f0ff'} />

                {/* Animated Spindle Bar / Doff Counter */}
                <text x="6" y="27" fill="var(--text-secondary)" fontSize="7.5" fontFamily="JetBrains Mono">
                  DOFF {Math.round(machine.doffCount)}%
                </text>
                {/* Spindle meter */}
                <rect x="6" y="30" width="58" height="5" rx="2" fill="#111b30" stroke="#1c2c4d" strokeWidth="0.5" />
                <rect
                  x="6"
                  y="30"
                  width={Math.min(58, (machine.doffCount / 100) * 58)}
                  height="5"
                  rx="2"
                  fill={isDoffFinished ? 'var(--accent-amber)' : 'linear-gradient(90deg, #0284c7, var(--accent-cyan))'}
                />

                {/* Machine Status line */}
                <text
                  x="6"
                  y="46"
                  fill={machine.status === 'BUFFER_FULL' ? 'var(--accent-rose)' : isDoffFinished ? 'var(--accent-amber)' : '#94a3b8'}
                  fontSize="7.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  {machine.status === 'BUFFER_FULL'
                    ? '● STOPPED'
                    : machine.status === 'WAITING'
                    ? '● WAIT LOAD'
                    : isDoffFinished
                    ? '● DOFF READY'
                    : machine.status === 'QUEUED'
                    ? '● IN FIFO'
                    : '● RUNNING'}
                  {machine.urgent ? ' ★' : ''}
                </text>

                {/* Quick Doff trigger button */}
                <g
                  transform="translate(6, 50)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTriggerManualDoff(machine.id);
                  }}
                >
                  <rect x="0" y="0" width="58" height="11" rx="2" fill="#152445" stroke="#253a6e" strokeWidth="0.8" />
                  <text x="29" y="8" textAnchor="middle" fill="var(--accent-cyan)" fontSize="7" fontFamily="JetBrains Mono">
                    FORCE DOFF
                  </text>
                </g>
              </g>
            </g>
          );
        })}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* BOTTOM RIGHT LEG: 4 DYNAMIC UNLOADERS (U01-U04) & 8 PALLET BINS */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {unloaders.map((unloader, i) => {
          // Positions along bottom rail from right to left:
          // x = 1220, 1070, 920, 770
          const ux = 1220 - i * 150;
          const uy = 480;
          const isStory = storyActiveTarget === unloader.id;
          const isUnloading = unloader.status === 'UNLOADING' || unloader.status === 'ASSIGNED';
          const variant = VARIANTS.find((v) => v.id === unloader.variantId);

          // Corresponding pallet bays (2 pallets per unloader)
          const pLeft = palletStations[i * 2];
          const pRight = palletStations[i * 2 + 1];

          return (
            <g key={unloader.id} transform={`translate(${ux}, ${uy})`}>
              {/* Dynamic Unloader Station Housing */}
              <g
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectEntity({ type: 'unloader', data: unloader, variant })}
              >
                {/* Station Frame */}
                <rect
                  x="0"
                  y="0"
                  width="110"
                  height="55"
                  rx="4"
                  fill="#0b1324"
                  stroke={isStory ? 'var(--accent-purple)' : isUnloading ? 'var(--accent-cyan)' : '#1d3054'}
                  strokeWidth={isStory ? 2 : 1.2}
                />

                {/* Station Header */}
                <rect x="2" y="2" width="106" height="14" rx="2" fill="#131e36" />
                <text x="8" y="12" fill="#ffffff" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
                  {unloader.id} DYNAMIC UNLOADER
                </text>
                <circle cx="98" cy="9" r="3" fill={isUnloading ? 'var(--accent-purple)' : 'var(--accent-emerald)'} />

                <text x="8" y="26" fill="var(--text-secondary)" fontSize="7.5" fontFamily="JetBrains Mono">
                  Carrier: {unloader.assignedBasketId || 'Waiting'}
                </text>

                {/* Progress bar */}
                <rect x="8" y="32" width="94" height="4" rx="2" fill="#111c33" />
                <rect
                  x="8"
                  y="32"
                  width={Math.min(94, (unloader.progress / 100) * 94)}
                  height="4"
                  rx="2"
                  fill="linear-gradient(90deg, #a855f7, #c084fc)"
                />

                <text x="8" y="48" fill={isUnloading ? 'var(--accent-purple)' : '#64748b'} fontSize="7.5" fontFamily="JetBrains Mono" fontWeight="bold">
                  {unloader.status === 'ASSIGNED'
                    ? `RESERVED → ${unloader.assignedBasketId}`
                    : unloader.status === 'STACKING'
                    ? `STACKING ON ${unloader.targetPalletId || ''}`
                    : isUnloading
                    ? `UNLOADING ${unloader.progress}% → ${unloader.targetPalletId || ''}`
                    : 'BAY AVAILABLE'}
                </text>
              </g>

              {/* Pneumatic Gripper Clamping Arms */}
              <g transform="translate(0, 55)">
                {/* Left clamp */}
                <line
                  x1={isUnloading ? "35" : "25"}
                  y1="5"
                  x2={isUnloading ? "45" : "25"}
                  y2="20"
                  stroke="var(--accent-cyan)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Right clamp */}
                <line
                  x1={isUnloading ? "75" : "85"}
                  y1="5"
                  x2={isUnloading ? "65" : "85"}
                  y2="20"
                  stroke="var(--accent-cyan)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Discharge Chute funneling into pallet bins */}
                <polygon points="40,20 70,20 60,35 50,35" fill="#162647" stroke="#253c6e" strokeWidth="1" />
              </g>

              {/* Dual Pallet Discharge Bins (Beneath Unloader) */}
              <g transform="translate(0, 95)">
                {/* Pallet 1 */}
                {pLeft && (
                  <g
                    transform="translate(0, 0)"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectEntity({ type: 'pallet', data: pLeft, variant: VARIANTS.find((v) => v.id === pLeft.variantId) })}
                  >
                    <rect x="0" y="0" width="52" height="40" rx="3" fill="#091021" stroke="#1b2a47" strokeWidth="1" />
                    {/* Wooden Euro-pallet base */}
                    <rect x="2" y="32" width="48" height="6" rx="1" fill="#78350f" />
                    <text x="5" y="10" fill="#fff" fontSize="7.5" fontFamily="JetBrains Mono" fontWeight="bold">
                      {pLeft.id}
                    </text>
                    <text x="5" y="20" fill="var(--accent-emerald)" fontSize="7" fontFamily="JetBrains Mono">
                      {pLeft.coneCount}c
                    </text>
                  </g>
                )}

                {/* Pallet 2 */}
                {pRight && (
                  <g
                    transform="translate(56, 0)"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectEntity({ type: 'pallet', data: pRight, variant: VARIANTS.find((v) => v.id === pRight.variantId) })}
                  >
                    <rect x="0" y="0" width="52" height="40" rx="3" fill="#091021" stroke="#1b2a47" strokeWidth="1" />
                    <rect x="2" y="32" width="48" height="6" rx="1" fill="#78350f" />
                    <text x="5" y="10" fill="#fff" fontSize="7.5" fontFamily="JetBrains Mono" fontWeight="bold">
                      {pRight.id}
                    </text>
                    <text x="5" y="20" fill="var(--accent-emerald)" fontSize="7" fontFamily="JetBrains Mono">
                      {pRight.coneCount}c
                    </text>
                  </g>
                )}
              </g>
            </g>
          );
        })}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* BOTTOM LEFT: OHC FLEET SUMMARY (all baskets are on the loop)       */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <g transform="translate(100, 560)">
          {/* Fleet summary: every basket is on the loop */}
          <rect x="0" y="0" width="520" height="75" rx="4" fill="#070c18" stroke="#162442" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="12" y="18" fill="var(--accent-emerald)" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
            ◄ OHC CHAIN: ALL {baskets.length} CONE BASKETS ON ONE LOOP, ALWAYS IN SEQUENCE
          </text>
          <text x="12" y="34" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono">
            • Empty baskets return along this leg to the 16 loaders; loaded baskets go to the 4 unloaders
          </text>
          <text x="12" y="48" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono">
            • No basket can pass another — loading and unloading happen as baskets move past
          </text>
          {[
            { label: 'EMPTY', n: baskets.filter((b) => b.coneQuantity === 0 && !b.reservedFor).length, c: '#94a3b8' },
            { label: 'RESERVED', n: baskets.filter((b) => b.coneQuantity === 0 && b.reservedFor).length, c: 'var(--accent-amber)' },
            { label: 'LOADED', n: baskets.filter((b) => b.coneQuantity > 0).length, c: 'var(--accent-cyan)' },
            { label: 'RECIRCULATING', n: baskets.filter((b) => b.coneQuantity > 0 && b.recirculations > 0).length, c: 'var(--accent-rose)' },
          ].map((k, i) => (
            <text key={k.label} x={12 + i * 125} y="66" fill={k.c} fontSize="8.5" fontFamily="JetBrains Mono" fontWeight="bold">
              {k.label}: {k.n}
            </text>
          ))}
        </g>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ALL 280 CONE BASKETS HANGING ON THE OHC CHAIN (always in sequence)     */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {baskets.map((basket) => {
          const { x, y } = pointAtProgress(basket.progressOnTrack || 0);
          const variant = VARIANTS.find((v) => v.id === basket.variantId);
          const loaded = basket.coneQuantity > 0;
          const isUnloading = basket.status === 'UNLOADING';
          const isReserved = basket.status === 'EMPTY' && basket.reservedFor;
          const isRecirc = loaded && basket.recirculations > 0;
          const isStory = storyActiveTarget === basket.id;
          const stroke = isStory ? '#c084fc' : isRecirc ? 'var(--accent-rose)' : isUnloading ? '#c084fc' : isReserved ? 'var(--accent-amber)' : loaded ? '#e2e8f0' : '#3b4a63';
          const fill = loaded ? variant?.color || '#00f0ff' : '#0b1222';
          const fillOpacity = loaded ? Math.max(0.25, basket.coneQuantity / 32) : 1;
          return (
            <g
              key={basket.id}
              transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectEntity({ type: 'basket', data: basket, variant })}
            >
              <title>
                {`${basket.id} · ${loaded ? `${variant?.name} · ${basket.coneQuantity} cones` : isReserved ? `empty · reserved for ${basket.reservedFor}` : 'empty'}${basket.assignedUnloader ? ` · to ${basket.assignedUnloader}` : ''}${isRecirc ? ` · recirculating (${basket.recirculations})` : ''}`}
              </title>
              <line x1="0" y1="0" x2="0" y2="4" stroke="#64748b" strokeWidth="1" />
              <rect x="-4.5" y="4" width="9" height="10" rx="1.5" fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={isReserved || isUnloading || isStory ? 1.6 : 1} />
              {(isUnloading || isStory) && (
                <text x="0" y="24" textAnchor="middle" fill="#e9d5ff" fontSize="7" fontFamily="JetBrains Mono" fontWeight="bold">
                  {basket.id}
                </text>
              )}
            </g>
          );
        })}

        {/* Spatial Zone Labels */}
        <g fill="#475569" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
          <text x="110" y="180">ZONE A: 16-SPUR AUTOMATED LOADING LINE</text>
          <text x="1170" y="320">ZONE B: POWER-AND-FREE IN-TRANSIT RAIL</text>
          <text x="780" y="525">ZONE C: 4 DYNAMIC UNLOADERS & PALLET DISCHARGE</text>
        </g>
      </svg>
      {children}
    </div>
  );
}
