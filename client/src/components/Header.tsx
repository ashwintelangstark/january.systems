import React from 'react';
import { AgentState, ClientConfig, EmotionState } from '../types';
import { Sparkles, Radio, Cpu, Terminal, Heart } from 'lucide-react';

interface HeaderProps {
  agentState: AgentState;
  emotionState?: EmotionState;
  isConnected: boolean;
  config: ClientConfig | null;
}

export const Header: React.FC<HeaderProps> = ({ agentState, emotionState, isConnected, config }) => {
  const wakeWord = config?.wakePhrase ? config.wakePhrase.charAt(0).toUpperCase() + config.wakePhrase.slice(1) : 'Rise';

  const getStatusBadge = () => {
    switch (agentState) {
      case 'passive':
        return {
          label: `Listening for "${wakeWord}"`,
          color: 'text-amber-400 bg-amber-950/40 border-amber-500/30',
          dot: 'bg-amber-400 animate-pulse',
        };
      case 'listening':
        return {
          label: 'January is listening...',
          color: 'text-cyan-400 bg-cyan-950/50 border-cyan-500/50 shadow-glow-cyan',
          dot: 'bg-cyan-400 animate-ping',
        };
      case 'speaking':
        return {
          label: 'January is speaking...',
          color: 'text-purple-300 bg-purple-950/50 border-purple-500/50 shadow-glow-purple',
          dot: 'bg-purple-400 animate-bounce',
        };
      case 'working':
        return {
          label: 'Working...',
          color: 'text-emerald-400 bg-emerald-950/50 border-emerald-500/50 shadow-glow-emerald',
          dot: 'bg-emerald-400 animate-spin',
        };
      case 'sleeping':
        return {
          label: `Sleeping (Say "${wakeWord}")`,
          color: 'text-indigo-400 bg-indigo-950/40 border-indigo-500/30',
          dot: 'bg-indigo-400 opacity-60',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <header className="w-full h-16 border-b border-white/10 glass-panel flex items-center justify-between px-6 z-20 select-none">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-600 p-[1px] shadow-glow-cyan">
          <div className="w-full h-full bg-[#0E131F] rounded-[11px] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-widest text-lg bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              JANUARY
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 border border-cyan-500/20">
              v1.0 Local Core
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono tracking-wide">
            Wake: "{config?.wakePhrase || 'rise'}" • Autonomous Multimodal OS
          </p>
        </div>
      </div>

      {/* Main Agent State & Emotion Badges */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2.5 px-4 py-1.5 rounded-full border text-xs font-medium tracking-wide transition-all duration-300 ${status.color}`}>
          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span>{status.label}</span>
        </div>

        {/* Dynamic Emotion Badge */}
        {emotionState && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-xs font-mono">
            <Heart className="w-3.5 h-3.5" style={{ color: emotionState.color }} />
            <span className="text-slate-400">Emotion:</span>
            <span className="font-semibold uppercase tracking-wider text-[11px]" style={{ color: emotionState.color }}>
              {emotionState.emotion}
            </span>
          </div>
        )}
      </div>

      {/* Engine Status Indicators */}
      <div className="flex items-center gap-2 text-xs font-mono">
        {/* Gemini Live */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-300">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Gemini Live</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        </div>

        {/* Claude 3.7 Sonnet */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden md:inline">Claude 3.7</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        </div>

        {/* Host Connection */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Localhost</span>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
        </div>
      </div>
    </header>
  );
};
