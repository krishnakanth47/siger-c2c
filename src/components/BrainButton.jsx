import React from 'react';
import { Brain } from 'lucide-react';
import './brain.css';

// Floating Master Mind orb + strategy switch. Click the orb to open the decision panel.
export default function BrainButton({ brain, mode, brainOnline, simTime, onOpen, onSetMode }) {
  const firing = mode === 'BRAIN' && brainOnline && brain && simTime - brain.pulse <= 2;
  const orbClass = mode !== 'BRAIN' ? 'fifo' : !brainOnline ? 'offline' : firing ? 'firing' : '';
  const cycle = brain?.lastCycle;

  let sub;
  if (mode !== 'BRAIN') sub = 'Brain on standby — plant running strict FIFO (customer spec).';
  else if (!brainOnline) sub = 'Heartbeat lost — PLC running fallback FIFO. Production continues.';
  else sub = cycle ? cycle.summary : 'Waiting for the first decision cycle…';

  return (
    <div className="brain-dock">
      <div className="brain-mode-switch" role="group" aria-label="Loading strategy">
        <button className={mode === 'FIFO' ? 'active-fifo' : ''} onClick={() => onSetMode('FIFO')}>
          FIFO (SPEC)
        </button>
        <button className={mode === 'BRAIN' ? 'active-brain' : ''} onClick={() => onSetMode('BRAIN')}>
          MASTER MIND
        </button>
      </div>

      <button
        className={`brain-orb-card ${mode !== 'BRAIN' ? 'fifo' : !brainOnline ? 'offline' : ''}`}
        onClick={onOpen}
        title="Open the Master Mind decision panel"
      >
        <div className={`brain-orb ${orbClass}`}>
          <Brain size={26} />
        </div>
        <div className="brain-orb-text">
          <span className="brain-orb-title">MASTER MIND</span>
          <span className="brain-orb-sub">{sub}</span>
          <span className="brain-orb-hint">▸ click the brain to see how it decides</span>
        </div>
      </button>
    </div>
  );
}
