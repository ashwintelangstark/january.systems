import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { AgentState, EmotionState } from '../../types';

interface TopStatusBarProps {
  agentState: AgentState;
  emotionState?: EmotionState;
  onToggleListening?: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  agentState,
  emotionState,
  onToggleListening,
}) => {
  const [shiningBtn, setShiningBtn] = useState<'status' | 'emotion' | null>(null);

  const triggerShine = (btn: 'status' | 'emotion') => {
    setShiningBtn(btn);
    setTimeout(() => {
      setShiningBtn((curr) => (curr === btn ? null : curr));
    }, 650);
  };

  const handleStatusClick = () => {
    triggerShine('status');
    if (onToggleListening) {
      onToggleListening();
    }
  };

  const handleEmotionClick = () => {
    triggerShine('emotion');
  };

  const getStatusBadge = () => {
    switch (agentState) {
      case 'listening':
        return {
          label: 'January is listening...',
          dot: 'bg-cyan-500 animate-ping',
          textColor: 'text-cyan-950',
          borderColor: 'border-cyan-400/60 shadow-[0_0_16px_rgba(6,182,212,0.3)]',
        };
      case 'speaking':
        return {
          label: 'January is speaking...',
          dot: 'bg-purple-500 animate-bounce',
          textColor: 'text-purple-950',
          borderColor: 'border-purple-400/60 shadow-[0_0_16px_rgba(168,85,247,0.3)]',
        };
      case 'working':
        return {
          label: 'Synthesizing...',
          dot: 'bg-emerald-500 animate-spin',
          textColor: 'text-emerald-950',
          borderColor: 'border-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.3)]',
        };
      case 'sleeping':
        return {
          label: 'Deep Sleep',
          dot: 'bg-indigo-500 opacity-70',
          textColor: 'text-indigo-950',
          borderColor: 'border-indigo-400/60 shadow-[0_0_14px_rgba(99,102,241,0.25)]',
        };
      case 'passive':
      default:
        return {
          label: 'Standby',
          dot: 'bg-amber-500',
          textColor: 'text-slate-800',
          borderColor: 'border-white/50 shadow-sm',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <div className="fixed top-6 right-6 z-30 flex items-center gap-2.5 select-none font-mono text-xs">
      {/* 1. January Listening / Sleeping Interactive Button (100% Transparent Glass + Shine Effect) */}
      <button
        type="button"
        onClick={handleStatusClick}
        className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-shine-btn ${
          shiningBtn === 'status' ? 'is-shining' : ''
        } border ${status.borderColor} shadow-lg transition-all cursor-pointer`}
        title={agentState === 'sleeping' ? 'Click to Wake January' : 'Click to Toggle Sleep Mode'}
      >
        <span className="glass-glare" />
        <span className="glass-click-flash" />
        <span className={`w-2 h-2 rounded-full ${status.dot}`} />
        <span className={`font-semibold ${status.textColor}`}>{status.label}</span>
      </button>

      {/* 2. Emotion Attunement Interactive Pill Button (100% Transparent Glass + Shine Effect) */}
      {emotionState && (
        <button
          type="button"
          onClick={handleEmotionClick}
          className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-shine-btn ${
            shiningBtn === 'emotion' ? 'is-shining' : ''
          } border border-white/50 shadow-lg text-slate-800 transition-all cursor-pointer`}
          title={`Emotional Attunement: ${emotionState.emotion.toUpperCase()} | Valence: ${Math.round(
            emotionState.valence * 100
          )}% | Arousal: ${Math.round(emotionState.arousal * 100)}% (Click for glass shine)`}
        >
          <span className="glass-glare" />
          <span className="glass-click-flash" />
          <Heart className="w-3.5 h-3.5 animate-pulse" style={{ color: emotionState.color }} />
          <span className="text-slate-600 text-[11px] font-medium">Emotion:</span>
          <span
            className="font-bold uppercase tracking-wider text-[11px]"
            style={{ color: emotionState.color }}
          >
            {emotionState.emotion}
          </span>
        </button>
      )}
    </div>
  );
};

export default TopStatusBar;
