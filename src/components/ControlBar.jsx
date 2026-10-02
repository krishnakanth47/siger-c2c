import React from 'react';
import { Play, Pause, RotateCcw, Sparkles, FastForward, Grid, AlertTriangle } from 'lucide-react';

export default function ControlBar({
  isRunning,
  onStart,
  onPause,
  onReset,
  onPlayStory,
  speed,
  onSetSpeed,
  systemWarning,
  showMatrix,
  onToggleMatrix,
}) {
  return (
    <div className="control-bar corner-brackets">
      <div className="control-actions">
        {isRunning ? (
          <button
            className="btn-industrial"
            onClick={onPause}
            title="Pause Simulation Engine"
            style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
          >
            <Pause size={15} />
            PAUSE
          </button>
        ) : (
          <button
            className="btn-industrial btn-primary-action"
            onClick={onStart}
            title="Start Simulation Engine"
          >
            <Play size={15} fill="currentColor" />
            START
          </button>
        )}

        <button
          className="btn-industrial"
          onClick={onReset}
          title="Reset Simulation to Initial State"
        >
          <RotateCcw size={14} />
          RESET
        </button>

        <button
          className="btn-industrial btn-story-mode"
          onClick={onPlayStory}
          title="Play 10-step guided story of basket B152 journey"
        >
          <Sparkles size={15} />
          PLAY STORY
        </button>
      </div>

      {systemWarning && (
        <div className="warning-alert-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={15} style={{ color: 'var(--accent-amber)' }} />
            <span>SYSTEM ALERT: {systemWarning}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          className={`btn-industrial ${showMatrix ? 'btn-primary-action' : ''}`}
          onClick={onToggleMatrix}
          title="Toggle 280 OHC Basket Matrix View"
          style={{ fontSize: '11px', padding: '5px 12px' }}
        >
          <Grid size={13} />
          280 BASKET FLEET
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
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
    </div>
  );
}
