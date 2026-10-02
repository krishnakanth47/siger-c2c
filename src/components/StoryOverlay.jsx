import React, { useState, useEffect } from 'react';
import { Play, Pause, ChevronRight, ChevronLeft, X, Sparkles, CheckCircle } from 'lucide-react';
import { STORY_STEPS } from '../simulation/storySequence';

export default function StoryOverlay({
  currentStep,
  onStepChange,
  onCloseStory,
}) {
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const stepData = STORY_STEPS.find((s) => s.step === currentStep) || STORY_STEPS[0];

  useEffect(() => {
    if (!isAutoPlaying) return;

    const timer = setTimeout(() => {
      if (currentStep < 10) {
        onStepChange(currentStep + 1);
      } else {
        setIsAutoPlaying(false);
      }
    }, 4500);

    return () => clearTimeout(timer);
  }, [currentStep, isAutoPlaying, onStepChange]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    if (currentStep > 1) onStepChange(currentStep - 1);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    if (currentStep < 10) onStepChange(currentStep + 1);
  };

  return (
    <div className="story-overlay-banner">
      <div className="story-header">
        <div className="story-title-group">
          <Sparkles size={18} style={{ color: 'var(--accent-purple)' }} />
          <span className="story-step-badge">STEP {currentStep} / 10</span>
          <span className="story-step-title">{stepData.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--accent-cyan)',
              background: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid var(--accent-cyan)',
              padding: '3px 8px',
              borderRadius: '3px',
            }}
          >
            {stepData.badge}
          </span>

          <button
            onClick={onCloseStory}
            title="Exit Story Mode"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
            onMouseEnter={(e) => (e.target.style.color = '#fff')}
            onMouseLeave={(e) => (e.target.style.color = 'var(--text-muted)')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="story-description">{stepData.description}</div>

      <div className="story-details">
        {stepData.details}
      </div>

      <div className="story-footer-controls">
        {/* Step dots */}
        <div className="story-progress-dots">
          {STORY_STEPS.map((s) => (
            <div
              key={s.step}
              className={`story-dot ${s.step === currentStep ? 'active' : s.step < currentStep ? 'past' : ''}`}
              onClick={() => {
                setIsAutoPlaying(false);
                onStepChange(s.step);
              }}
              style={{ cursor: 'pointer' }}
              title={`Jump to Step ${s.step}: ${s.title}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-industrial"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            style={{ fontSize: '11px', padding: '5px 10px' }}
          >
            {isAutoPlaying ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
            {isAutoPlaying ? 'PAUSE STORY' : 'AUTO PLAY'}
          </button>

          <button
            className="btn-industrial"
            onClick={handlePrev}
            disabled={currentStep === 1}
            style={{ fontSize: '11px', padding: '5px 8px', opacity: currentStep === 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} />
          </button>

          <button
            className="btn-industrial btn-story-mode"
            onClick={handleNext}
            disabled={currentStep === 10}
            style={{ fontSize: '11px', padding: '5px 12px', opacity: currentStep === 10 ? 0.4 : 1 }}
          >
            NEXT STEP
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
