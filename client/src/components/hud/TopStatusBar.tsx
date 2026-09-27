import React from 'react';
import { Cpu, Heart, Terminal } from 'lucide-react';
import { AgentState, EmotionState, ClientConfig } from '../../types';

interface TopStatusBarProps {
  agentState: AgentState;
  emotionState?: EmotionState;
  isConnected: boolean;
  config: ClientConfig | null;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  agentState,
  emotionState,
  isConnected,
  config,
}) => {
  const getStatusBadge = () => {
    switch (agentState) {
      case 'passive':
        return {
          label: 'Standby ("Rise")',
          dot: 'bg-amber-400',
          textColor: 'text-amber-300',
        };
      case 'listening':
        return {
          label: 'January is listening...',
          dot: 'bg-cyan-400 animate-ping',
          textColor: 'text-cyan-300',
        };
      case 'speaking':
        return {
          label: 'January is speaking...',
          dot: 'bg-purple-400 animate-bounce',
          textColor: 'text-purple-300',
        };
      case 'working':
        return {
          label: 'Synthesizing...',
          dot: 'bg-emerald-400 animate-spin',
          textColor: 'text-emerald-300',
        };
      case 'sleeping':
        return {
          label: 'Deep Sleep',
          dot: 'bg-indigo-400 opacity-60',
          textColor: 'text-indigo-300',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <div className="fixed top-6 right-6 z-30 flex items-center gap-2.5 select-none font-mono text-xs">
      {/* Agent Live State Pill */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-bar border border-white/10 shadow-lg">
        <span className={`w-2 h-2 rounded-full ${status.dot}`} />
        <span className={`font-medium ${status.textColor}`}>{status.label}</span>
      </div>

      {/* Emotion Attunement Pill */}
      {emotionState && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass-bar border border-white/10 shadow-lg">
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

      {/* AI Model Badge */}
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-bar border border-white/10 text-slate-300 shadow-lg">
        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[11px] text-slate-200">
          {config?.activeModel || 'Gemini 2.0 Flash'}
        </span>
      </div>

      {/* Localhost Host Link */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-bar border border-white/10 text-slate-400 shadow-lg">
        <Terminal className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden lg:inline text-[11px]">Localhost</span>
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
          }`}
        />
      </div>
    </div>
  );
};
