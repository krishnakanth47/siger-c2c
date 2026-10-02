import React, { useState } from 'react';
import { Terminal, Trash2, Filter } from 'lucide-react';

export default function LiveEventLog({ events, onClearEvents }) {
  const [filterLevel, setFilterLevel] = useState('ALL');

  const filteredEvents = events.filter((e) => {
    if (filterLevel === 'ALL') return true;
    return e.level === filterLevel;
  });

  return (
    <div className="industrial-card">
      <div className="panel-header">
        <div className="panel-title">
          <Terminal size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>LIVE EVENT CONSOLE & PLC AUDIT LOG</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Level Filter */}
          <div style={{ display: 'flex', gap: '3px' }}>
            {['ALL', 'INFO', 'SUCCESS', 'WARNING'].map((lvl) => (
              <button
                key={lvl}
                className={`speed-btn ${filterLevel === lvl ? 'active' : ''}`}
                onClick={() => setFilterLevel(lvl)}
                style={{ fontSize: '9px', padding: '2px 6px' }}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={onClearEvents}
            title="Clear Event Log"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="event-log-container">
        {filteredEvents.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px' }}>
            No log events recorded yet.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div key={evt.id} className={`event-log-item level-${evt.level}`}>
              <span className="event-time">[{evt.time}]</span>
              <span className={`event-badge badge-${evt.level}`}>{evt.level}</span>
              <span className="event-text">{evt.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
