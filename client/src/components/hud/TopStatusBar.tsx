import React from 'react';
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
  const getStatusBadge = () => {
    switch (agentState) {
      case 'listening':
        return {
          label: 'January is listening...',
          dot: 'bg-cyan-500 animate-ping',
          textColor: 'text-cyan-950',
          borderColor: 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.3)]',
        };
      case 'speaking':
        return {
          label: 'January is speaking...',
          dot: 'bg-purple-500 animate-bounce',
          textColor: 'text-purple-950',
          borderColor: 'border-purple-400 bg-purple-500/20 shadow-sm',
        };
      case 'working':
        return {
          label: 'Synthesizing...',
          dot: 'bg-emerald-500 animate-spin',
          textColor: 'text-emerald-950',
          borderColor: 'border-emerald-400 bg-emerald-500/20 shadow-sm',
        };
      case 'sleeping':
        return {
          label: 'Deep Sleep',
          dot: 'bg-indigo-500 opacity-70',
          textColor: 'text-indigo-950',
          borderColor: 'border-indigo-400 bg-indigo-500/20 shadow-sm',
        };
      case 'passive':
      default:
        return {
          label: 'Standby',
          dot: 'bg-amber-500',
          textColor: 'text-slate-800',
          borderColor: 'border-white/50',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <div className="fixed top-6 right-6 z-30 flex items-center gap-2.5 select-none font-mono text-xs">
      {/* 1. January Listening / Sleeping Interactive Button */}
      <button
        type="button"
        onClick={onToggleListening}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-btn border ${status.borderColor} shadow-md transition-all cursor-pointer`}
        title={agentState === 'sleeping' ? 'Click to Wake January' : 'Click to Toggle Sleep Mode'}
      >
        <span className={`w-2 h-2 rounded-full ${status.dot}`} />
        <span className={`font-semibold ${status.textColor}`}>{status.label}</span>
      </button>

      {/* 2. Emotion Attunement Pill */}
      {emotionState && (
        <div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-btn border border-white/50 shadow-md text-slate-800"
          title={`Emotional Valence: ${Math.round(emotionState.valence * 100)}% | Arousal: ${Math.round(
            emotionState.arousal * 100
          )}%`}
        >
          <Heart className="w-3.5 h-3.5" style={{ color: emotionState.color }} />
          <span className="text-slate-600 text-[11px] font-medium">Emotion:</span>
          <span
            className="font-bold uppercase tracking-wider text-[11px]"
            style={{ color: emotionState.color }}
          >
            {emotionState.emotion}
          </span>
        </div>
      )}
    </div>
  );
};

export default TopStatusBar;
