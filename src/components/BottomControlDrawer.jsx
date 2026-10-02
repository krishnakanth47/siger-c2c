import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Sparkles, Grid, Terminal, AlertTriangle, X, Trash2 } from 'lucide-react';

export default function BottomControlDrawer({
  isRunning,
  onStart,
  onPause,
  onReset,
  onPlayStory,
  speed,
  onSetSpeed,
  systemWarning,
  events,
  onClearEvents,
  onOpenFleetModal,
}) {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState('ALL');

  const filteredEvents = events.filter((e) => {
    if (filterLevel === 'ALL') return true;
    return e.level === filterLevel;
  });

  return (
    <div className="bottom-dock">
      {/* Collapsible Live Event Terminal Drawer */}
      {isTerminalOpen && (
        <div className="audit-drawer-pane">
          <div className="drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span>LIVE SCADA AUDIT TERMINAL ({events.length} LOGS)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {['ALL', 'INFO', 'SUCCESS', 'WARNING'].map((lvl) => (
                  <button
                    key={lvl}
                    className={`speed-btn ${filterLevel === lvl ? 'active' : ''}`}
                    onClick={() => setFilterLevel(lvl)}
                    style={{ fontSize: '9px', padding: '2px 5px' }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <button
                onClick={onClearEvents}
                title="Clear Logs"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <Trash2 size={12} />
              </button>

              <button
                onClick={() => setIsTerminalOpen(false)}
                title="Close Terminal"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="event-log-container">
            {filteredEvents.map((evt) => (
              <div key={evt.id} className={`event-log-item level-${evt.level}`}>
                <span className="event-time">[{evt.time}]</span>
                <span className={`event-badge badge-${evt.level}`}>{evt.level}</span>
                <span className="event-text">{evt.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Bottom Control Bar */}
      <div className="bottom-control-bar">
        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRunning ? (
            <button
              className="btn-industrial"
              onClick={onPause}
              style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
            >
              <Pause size={13} />
              PAUSE
            </button>
          ) : (
            <button
              className="btn-industrial btn-primary-action"
              onClick={onStart}
            >
              <Play size={13} fill="currentColor" />
              START
            </button>
          )}

          <button className="btn-industrial" onClick={onReset} title="Reset simulation">
            <RotateCcw size={12} />
            RESET
          </button>

          <button className="btn-industrial btn-story-mode" onClick={onPlayStory} title="Guided 10-step tour">
            <Sparkles size={13} />
            PLAY STORY
          </button>

          {/* Speed Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              SPEED:
            </span>
            <div className="speed-selector">
              {[0.5, 1.0, 2.0, 4.0].map((s) => (
                <button
                  key={s}
                  className={`speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => onSetSpeed(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Warning Alert if any */}
        {systemWarning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
            <AlertTriangle size={13} />
            <span>ALERT: {systemWarning}</span>
          </div>
        )}

        {/* Material Flow Breadcrumb Text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--accent-cyan)' }}>FLOW:</span>
          <span>16 Frames</span>
          <span>→</span>
          <span>FIFO Queue</span>
          <span>→</span>
          <span>16 Loaders</span>
          <span>→</span>
          <span>OHC Rail</span>
          <span>→</span>
          <span>4 Unloaders</span>
          <span>→</span>
          <span>8 Pallets</span>
          <span>→</span>
          <span style={{ color: 'var(--accent-emerald)' }}>Reuse</span>
        </div>

        {/* Right Tools (280 Matrix & Terminal Drawer toggles) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-industrial"
            onClick={onOpenFleetModal}
            title="Open 280-Basket Digital Twin Matrix"
            style={{ fontSize: '10.5px' }}
          >
            <Grid size={12} />
            280 FLEET MATRIX
          </button>

          <button
            className={`btn-industrial ${isTerminalOpen ? 'btn-primary-action' : ''}`}
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            title="Toggle Live Event Terminal Drawer"
            style={{ fontSize: '10.5px' }}
          >
            <Terminal size={12} />
            TERMINAL ({events.length})
          </button>
        </div>
      </div>
    </div>
  );
}
