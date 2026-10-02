import React, { useRef, useEffect, useState } from 'react';
import { VARIANTS } from '../constants/simulationConstants';

export default function ConveyorRail({ baskets, storyActiveTarget, onSelectBasket }) {
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);

  // Define closed-loop overhead rail path
  // Dimensions: 900 x 320
  // Left: Loaders infeed -> Top: High-speed rail traverse -> Right: Unloaders zone -> Bottom: Empty return loop
  const trackPathD = "M 80 230 C 80 130, 110 60, 200 60 L 700 60 C 800 60, 840 120, 840 210 C 840 280, 780 290, 700 290 L 220 290 C 130 290, 80 280, 80 230 Z";

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  // Filter visible baskets for high-performance rendering:
  // Show all baskets that are currently IN_TRANSIT, LOADING, or UNLOADING, plus the story highlight basket B152
  const visibleBaskets = baskets.filter(
    (b) =>
      b.status === 'IN_TRANSIT' ||
      b.status === 'LOADING' ||
      b.status === 'UNLOADING' ||
      b.id === 'B152' ||
      (b.status === 'EMPTY' && b.location === 'Empty Return Rail')
  );

  // Compute position (x, y) along SVG track for given progress (0.0 to 1.0)
  const getCoordinatesForProgress = (progress) => {
    if (!pathRef.current || pathLength === 0) {
      return { x: 100, y: 60 };
    }
    const clamped = Math.max(0, Math.min(0.999, progress || 0));
    const point = pathRef.current.getPointAtLength(clamped * pathLength);
    return { x: point.x, y: point.y };
  };

  return (
    <div className="industrial-card conveyor-stage corner-brackets">
      <div className="panel-header">
        <div className="panel-title">
          <span style={{ display: 'inline-block', width: '10px', height: '10px', background: 'var(--accent-cyan)', borderRadius: '2px', boxShadow: '0 0 8px var(--accent-cyan)' }} />
          <span>OHC OVERHEAD CONVEYOR RAIL SYSTEM (280 CARRIERS)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="panel-badge" style={{ color: 'var(--accent-cyan)' }}>
            ACTIVE ON TRACK: {visibleBaskets.length} BASKETS
          </span>
          <span className="panel-badge" style={{ color: 'var(--accent-emerald)' }}>
            RAIL SPEED: 45 M/MIN
          </span>
        </div>
      </div>

      <div className="conveyor-svg-container">
        <svg
          ref={svgRef}
          viewBox="0 0 920 340"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            {/* Linear gradients for rail styling */}
            <linearGradient id="railGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="50%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>

            <linearGradient id="glowLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.8" />
            </linearGradient>

            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Overhead Ceiling Trusses & Suspension Rods */}
          <g stroke="#1a2744" strokeWidth="2" opacity="0.6">
            <line x1="140" y1="0" x2="140" y2="60" />
            <line x1="260" y1="0" x2="260" y2="60" />
            <line x1="380" y1="0" x2="380" y2="60" />
            <line x1="500" y1="0" x2="500" y2="60" />
            <line x1="620" y1="0" x2="620" y2="60" />
            <line x1="740" y1="0" x2="740" y2="60" />
            {/* Lower floor support pillars */}
            <line x1="200" y1="290" x2="200" y2="340" stroke="#13203b" strokeWidth="3" />
            <line x1="450" y1="290" x2="450" y2="340" stroke="#13203b" strokeWidth="3" />
            <line x1="700" y1="290" x2="700" y2="340" stroke="#13203b" strokeWidth="3" />
          </g>

          {/* Heavy Steel Track Bed (Back Layer) */}
          <path
            d={trackPathD}
            fill="none"
            stroke="#15213b"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Steel Rail Channel */}
          <path
            d={trackPathD}
            fill="none"
            stroke="#1f3460"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Main Electric Power Rail (Active animated dash pulse) */}
          <path
            ref={pathRef}
            d={trackPathD}
            fill="none"
            stroke="url(#railGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="8 6"
            filter="url(#glowEffect)"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-56"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>

          {/* Rail Directional Arrows */}
          <g fill="#0284c7" opacity="0.6">
            <polygon points="340,56 350,60 340,64" />
            <polygon points="560,56 570,60 560,64" />
            <polygon points="844,140 840,150 836,140" />
            <polygon points="520,286 510,290 520,294" />
            <polygon points="300,286 290,290 300,294" />
            <polygon points="76,170 80,160 84,170" />
          </g>

          {/* Visual Sector Labels on the Factory Floor */}
          <text x="90" y="42" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
            ZONE 1: LOADER INFEED
          </text>
          <text x="380" y="42" fill="#38bdf8" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">
            OHC MAIN OVERHEAD TRANSIT RAIL ════════════►
          </text>
          <text x="730" y="42" fill="#a855f7" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
            ZONE 2: UNLOADER APPROACH
          </text>
          <text x="360" y="318" fill="#10b981" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
            ◄════════ EMPTY BASKET RETURN RAIL TO BUFFER POOL
          </text>

          {/* Render Active Baskets on the Rail */}
          {visibleBaskets.map((basket) => {
            const { x, y } = getCoordinatesForProgress(basket.progressOnTrack);
            const variant = VARIANTS.find((v) => v.id === basket.variantId);
            const isStory = storyActiveTarget === basket.id || basket.isStoryHighlight;
            const hasCones = basket.coneQuantity > 0;
            const isUnloading = basket.status === 'UNLOADING';
            const isLoading = basket.status === 'LOADING';

            // Distinct cone color based on variant
            const coneColor = variant?.color || '#00f0ff';

            return (
              <g
                key={basket.id}
                transform={`translate(${x}, ${y})`}
                style={{ cursor: 'pointer', transition: 'transform 0.1s linear' }}
                onClick={() => onSelectBasket({ type: 'basket', data: basket, variant })}
              >
                {/* Story Glow Aura */}
                {isStory && (
                  <circle
                    r="28"
                    cy="20"
                    fill="none"
                    stroke="var(--accent-purple)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    opacity="0.8"
                  >
                    <animate
                      attributeName="transform"
                      type="rotate"
                      from="0 0 20"
                      to="360 0 20"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Overhead Trolley Assembly */}
                {/* Twin Rollers running on track */}
                <circle cx="-6" cy="-2" r="3" fill="#94a3b8" />
                <circle cx="6" cy="-2" r="3" fill="#94a3b8" />
                {/* Trolley cross-bar */}
                <rect x="-8" y="-4" width="16" height="3" fill="#334155" rx="1" />
                {/* Suspension Rod */}
                <line x1="0" y1="-1" x2="0" y2="10" stroke="#64748b" strokeWidth="2" />
                {/* Swivel Hanger Hook */}
                <path d="M 0 10 L 0 14" stroke="#94a3b8" strokeWidth="2" />

                {/* Basket Wireframe Body */}
                <rect
                  x="-16"
                  y="14"
                  width="32"
                  height="22"
                  rx="3"
                  fill="#0a1224"
                  stroke={isStory ? 'var(--accent-purple)' : hasCones ? '#38bdf8' : '#475569'}
                  strokeWidth="1.5"
                />

                {/* Wireframe Grid details on basket */}
                <line x1="-16" y1="21" x2="16" y2="21" stroke="#1e293b" strokeWidth="1" />
                <line x1="-16" y1="28" x2="16" y2="28" stroke="#1e293b" strokeWidth="1" />
                <line x1="-6" y1="14" x2="-6" y2="36" stroke="#1e293b" strokeWidth="1" />
                <line x1="6" y1="14" x2="6" y2="36" stroke="#1e293b" strokeWidth="1" />

                {/* Yarn Cones inside basket */}
                {hasCones ? (
                  <g>
                    {/* Left cone */}
                    <polygon
                      points="-11,32 -6,17 -2,32"
                      fill={coneColor}
                      opacity={isUnloading ? '0.6' : '1'}
                    />
                    {/* Center cone */}
                    <polygon
                      points="-4,32 0,16 4,32"
                      fill={coneColor}
                      opacity={isUnloading ? '0.7' : '1'}
                    />
                    {/* Right cone */}
                    <polygon
                      points="2,32 6,17 11,32"
                      fill={coneColor}
                      opacity={isUnloading ? '0.6' : '1'}
                    />
                  </g>
                ) : (
                  // Empty basket indicator
                  <text
                    x="0"
                    y="27"
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="7"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                  >
                    EMPTY
                  </text>
                )}

                {/* Basket ID Callout Pill */}
                <rect
                  x="-20"
                  y="-18"
                  width="40"
                  height="12"
                  rx="2"
                  fill="#0d172e"
                  stroke={isStory ? 'var(--accent-purple)' : '#334155'}
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="-9"
                  textAnchor="middle"
                  fill={isStory ? '#c084fc' : '#ffffff'}
                  fontSize="8"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  {basket.id}
                </text>

                {/* Status / Variant Subtitle */}
                {variant && (
                  <text
                    x="0"
                    y="43"
                    textAnchor="middle"
                    fill={variant.color}
                    fontSize="7"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                  >
                    {variant.code} • {basket.coneQuantity}c
                  </text>
                )}

                {/* Status Dot */}
                <circle
                  cx="16"
                  cy="14"
                  r="3"
                  fill={
                    isLoading
                      ? 'var(--accent-amber)'
                      : isUnloading
                      ? 'var(--accent-purple)'
                      : hasCones
                      ? 'var(--accent-cyan)'
                      : '#64748b'
                  }
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>● Closed-Loop Return: Once unloaded, empty baskets cycle back to infeed pool</span>
          <span>● Zero cone return: All yarn cones deposit into pallet bays</span>
        </div>
        <span style={{ color: 'var(--accent-cyan)' }}>BASKET B152: DEMO LEADER</span>
      </div>
    </div>
  );
}
