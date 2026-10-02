import React, { useRef, useEffect, useState } from 'react';
import { VARIANTS } from '../constants/simulationConstants';

export default function PlantFloor({
  machines,
  loaders,
  baskets,
  unloaders,
  palletStations,
  storyActiveTarget,
  onSelectEntity,
  onTriggerManualDoff,
}) {
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);
  const [activeSensors, setActiveSensors] = useState({});

  // SVG dimensions: 1440 x 680
  // Closed loop rail path:
  // Top: (100, 140) to (1320, 140)
  // Right: curve down to (1320, 540)
  // Bottom: (1320, 540) to (100, 540)
  // Left: curve up to (100, 140)
  const trackPathD = "M 110 140 L 1320 140 C 1390 140, 1410 200, 1410 340 C 1410 480, 1390 540, 1320 540 L 110 540 C 40 540, 20 480, 20 340 C 20 200, 40 140, 110 140 Z";

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  // Compute position (x, y) along track
  const getCoordinatesForProgress = (progress) => {
    if (!pathRef.current || pathLength === 0) {
      return { x: 110, y: 140 };
    }
    const clamped = Math.max(0, Math.min(0.999, progress || 0));
    const point = pathRef.current.getPointAtLength(clamped * pathLength);
    return { x: point.x, y: point.y };
  };

  // Filter visible baskets on track
  const visibleBaskets = baskets.filter(
    (b) =>
      b.status === 'IN_TRANSIT' ||
      b.status === 'LOADING' ||
      b.status === 'UNLOADING' ||
      b.id === 'B152' ||
      (b.status === 'EMPTY' && b.location === 'Empty Return Rail')
  );

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
          const isLoading = loader.status === 'LOADING';

          return (
            <g key={machine.id} transform={`translate(${x}, 20)`}>
              {/* Vertical Structural Feeder Chute from Machine down to Loader */}
              <rect
                x="32"
                y="65"
                width="6"
                height="55"
                fill="#16223b"
                stroke="#25385e"
                strokeWidth="1"
              />

              {/* Animated feeder drop action when loading */}
              {isLoading && (
                <circle cx="35" cy="90" r="4" fill={variant?.color || '#00f0ff'} filter="url(#cyanGlow)">
                  <animate attributeName="cy" from="65" to="115" dur="0.8s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Loader Spur Dock on the Rail */}
              <g
                transform="translate(18, 115)"
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
                  stroke={isStory ? 'var(--accent-purple)' : isDoffFinished ? 'var(--accent-amber)' : '#1a2b4c'}
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
                  fill={isDoffFinished ? 'var(--accent-amber)' : '#94a3b8'}
                  fontSize="7.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  {isDoffFinished ? '● DOFF READY' : machine.status === 'QUEUED' ? '● IN FIFO' : '● RUNNING'}
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
                  {isUnloading ? `UNLOADING ${unloader.progress}%` : 'BAY AVAILABLE'}
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
        {/* BOTTOM LEFT LEG: EMPTY RETURN BUFFER & READY CARRIER RESERVOIR */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <g transform="translate(100, 560)">
          {/* Overhead Ready Buffer Storage Rack */}
          <rect x="0" y="0" width="520" height="75" rx="4" fill="#070c18" stroke="#162442" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="12" y="18" fill="var(--accent-emerald)" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
            ◄ EMPTY CARRIER RETURN LOOP & STANDBY BUFFER POOL (280 TOTAL FLEET)
          </text>
          <text x="12" y="32" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono">
            • Automatic carrier de-latching & cone verification (Zero cone return rule)
          </text>
          <text x="12" y="44" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono">
            • Empty carriers enter queue-ready buffer to service incoming ring-frame doff triggers
          </text>

          {/* Render 8 standby empty baskets stored in overhead buffer */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((bidx) => (
            <g key={`buffer-basket-${bidx}`} transform={`translate(${20 + bidx * 62}, 50)`}>
              <rect x="0" y="0" width="28" height="18" rx="2" fill="#0e172a" stroke="#334155" strokeWidth="1" />
              <text x="14" y="11" textAnchor="middle" fill="#64748b" fontSize="6.5" fontFamily="JetBrains Mono">
                EMPTY
              </text>
            </g>
          ))}
        </g>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ACTIVE MOVING CARRIERS ALONG THE OHC CLOSED RAIL */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {visibleBaskets.map((basket) => {
          const { x, y } = getCoordinatesForProgress(basket.progressOnTrack);
          const variant = VARIANTS.find((v) => v.id === basket.variantId);
          const isStory = storyActiveTarget === basket.id || basket.id === 'B152';
          const hasCones = basket.coneQuantity > 0;
          const isUnloading = basket.status === 'UNLOADING';
          const isLoading = basket.status === 'LOADING';
          const coneColor = variant?.color || '#00f0ff';

          return (
            <g
              key={basket.id}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: 'pointer', transition: 'transform 0.1s linear' }}
              onClick={() => onSelectEntity({ type: 'basket', data: basket, variant })}
            >
              {/* Story Glowing Halo */}
              {isStory && (
                <circle r="30" cy="18" fill="none" stroke="var(--accent-purple)" strokeWidth="2" strokeDasharray="5 3">
                  <animate attributeName="transform" type="rotate" from="0 0 18" to="360 0 18" dur="3s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Overhead Trolley on Rail (Twin Steel Wheels) */}
              <circle cx="-6" cy="-2" r="3.5" fill="#cbd5e1" />
              <circle cx="6" cy="-2" r="3.5" fill="#cbd5e1" />
              <rect x="-8" y="-5" width="16" height="3" rx="1" fill="#475569" />

              {/* Suspension Rod */}
              <line x1="0" y1="-2" x2="0" y2="10" stroke="#94a3b8" strokeWidth="2" />

              {/* Two-Tier Wire Basket Carrier Body */}
              <rect
                x="-16"
                y="10"
                width="32"
                height="22"
                rx="3"
                fill="#080e1c"
                stroke={isStory ? 'var(--accent-purple)' : hasCones ? '#38bdf8' : '#475569'}
                strokeWidth="1.4"
              />

              {/* Carrier Wireframe Ribs */}
              <line x1="-16" y1="17" x2="16" y2="17" stroke="#1e293b" strokeWidth="1" />
              <line x1="-16" y1="24" x2="16" y2="24" stroke="#1e293b" strokeWidth="1" />
              <line x1="-5" y1="10" x2="-5" y2="32" stroke="#1e293b" strokeWidth="1" />
              <line x1="5" y1="10" x2="5" y2="32" stroke="#1e293b" strokeWidth="1" />

              {/* Yarn Cones inside carrier */}
              {hasCones ? (
                <g>
                  {/* Left cone */}
                  <polygon points="-11,28 -6,14 -2,28" fill={coneColor} opacity={isUnloading ? 0.6 : 1} />
                  {/* Center cone */}
                  <polygon points="-4,28 0,13 4,28" fill={coneColor} opacity={isUnloading ? 0.7 : 1} />
                  {/* Right cone */}
                  <polygon points="2,28 6,14 11,28" fill={coneColor} opacity={isUnloading ? 0.6 : 1} />
                </g>
              ) : (
                <text x="0" y="23" textAnchor="middle" fill="#64748b" fontSize="6.5" fontFamily="JetBrains Mono" fontWeight="bold">
                  EMPTY
                </text>
              )}

              {/* Basket ID Callout Tag */}
              <rect x="-18" y="-17" width="36" height="11" rx="2" fill="#0d172e" stroke="#334155" strokeWidth="0.8" />
              <text x="0" y="-9" textAnchor="middle" fill={isStory ? '#c084fc' : '#ffffff'} fontSize="7.5" fontFamily="JetBrains Mono" fontWeight="bold">
                {basket.id}
              </text>

              {/* Variant Code below carrier */}
              {variant && (
                <text x="0" y="39" textAnchor="middle" fill={variant.color} fontSize="6.5" fontFamily="JetBrains Mono" fontWeight="bold">
                  {variant.code} • {basket.coneQuantity}c
                </text>
              )}

              {/* Status LED Dot */}
              <circle
                cx="15"
                cy="10"
                r="2.5"
                fill={isLoading ? 'var(--accent-amber)' : isUnloading ? 'var(--accent-purple)' : hasCones ? 'var(--accent-cyan)' : '#64748b'}
              />
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
    </div>
  );
}
