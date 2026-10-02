import React, { useState, useEffect } from 'react';
import { Activity, Clock, Cpu, ShieldCheck } from 'lucide-react';

export default function Header({ simulatedTimeSeconds, isRunning, totalCycles, totalCones }) {
  const [realClock, setRealClock] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setRealClock(now.toLocaleTimeString('en-GB', { hour12: false }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format simulated elapsed time
  const simMinutes = String(Math.floor(simulatedTimeSeconds / 60)).padStart(2, '0');
  const simSeconds = String(simulatedTimeSeconds % 60).padStart(2, '0');

  return (
    <header className="top-header corner-brackets">
      <div className="header-brand">
        <div className="brand-badge">SIEGER</div>
        <div className="header-titles">
          <h1>
            SIEGER OHC SIMULATION
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>|</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
              DIGITAL TWIN
            </span>
          </h1>
          <div className="header-subtitle">
            REAL-TIME MATERIAL FLOW VISUALIZATION • OVERHEAD CONVEYOR SYSTEM
          </div>
        </div>
      </div>

      <div className="header-telemetry">
        <div className={`system-pill ${isRunning ? '' : 'warning'}`}>
          <span className={`led-indicator ${isRunning ? 'led-running pulse-animation' : 'led-warning'}`} />
          {isRunning ? '[ SYSTEM ONLINE ]' : '[ SIMULATION PAUSED ]'}
        </div>

        <div className="system-pill" style={{ borderColor: 'rgba(0, 240, 255, 0.3)', color: 'var(--accent-cyan)' }}>
          <Cpu size={13} />
          <span>[ 280 BASKETS TRACKED ]</span>
        </div>

        <div className="system-pill" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-dim)' }}>
          <Clock size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>SIM T+{simMinutes}:{simSeconds}</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>|</span>
          <span style={{ color: 'var(--text-secondary)' }}>RTC {realClock}</span>
        </div>
      </div>
    </header>
  );
}
