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
          dot: 'bg-cyan-400 animate-ping',
          textColor: 'text-cyan-300',
          borderColor: 'border-cyan-500/40 shadow-glow-cyan',
        };
      case 'speaking':
        return {
          label: 'January is speaking...',
          dot: 'bg-purple-400 animate-bounce',
          textColor: 'text-purple-300',
          borderColor: 'border-purple-500/30',
        };
      case 'working':
        return {
          label: 'Synthesizing...',
          dot: 'bg-emerald-400 animate-spin',
          textColor: 'text-emerald-300',
          borderColor: 'border-emerald-500/30',
        };
      case 'sleeping':
        return {
          label: 'Deep Sleep',
          dot: 'bg-indigo-400 opacity-60',
          textColor: 'text-indigo-300',
          borderColor: 'border-indigo-500/30',
        };
      case 'passive':
      default:
        return {
          label: 'Standby',
          dot: 'bg-amber-400',
          textColor: 'text-amber-300',
          borderColor: 'border-amber-500/30',
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
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-bar border ${status.borderColor} shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer`}
        title={agentState === 'sleeping' ? 'Click to Wake January' : 'Click to Toggle Sleep Mode'}
      >
        <span className={`w-2 h-2 rounded-full ${status.dot}`} />
        <span className={`font-medium ${status.textColor}`}>{status.label}</span>
      </button>

      {/* 2. Emotion Attunement Pill */}
      {emotionState && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass-bar border border-white/10 shadow-lg"
          title={`Emotional Valence: ${Math.round(emotionState.valence * 100)}% | Arousal: ${Math.round(
            emotionState.arousal * 100
          )}%`}
        >
          <Heart className="w-3.5 h-3.5" style={{ color: emotionState.color }} />
          <span className="text-slate-400 text-[11px]">Emotion:</span>
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
