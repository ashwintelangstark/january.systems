import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Sparkles, Square } from 'lucide-react';
import { AgentState } from '../types';

interface DualInputBarProps {
  agentState: AgentState;
  isMicMuted: boolean;
  isAudioMuted: boolean;
  onSendText: (text: string) => void;
  onTriggerWake: () => void;
  onInterrupt: () => void;
  onToggleMic: () => void;
  onToggleAudio: () => void;
}

export const DualInputBar: React.FC<DualInputBarProps> = ({
  agentState,
  isMicMuted,
  isAudioMuted,
  onSendText,
  onTriggerWake,
  onInterrupt,
  onToggleMic,
  onToggleAudio,
}) => {
  const [inputText, setInputText] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendText(trimmed);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputText(history[nextIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInputText('');
      } else {
        setHistoryIndex(nextIndex);
        setInputText(history[nextIndex]);
      }
    }
  };

  return (
    <div className="w-full glass-panel border-t border-white/10 px-6 py-4 z-20 select-none">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        {/* Quick Wake Button ("Arise") */}
        <button
          onClick={onTriggerWake}
          title='Trigger wake phrase "Arise"'
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold tracking-wide transition-all shadow-sm ${
            agentState === 'passive'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Arise</span>
        </button>

        {/* Text Input Bar with History Navigation */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Type a command for January or press "Arise" to speak...'
              className="w-full h-11 px-4 pr-12 rounded-xl glass-input text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all font-sans"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="absolute right-1.5 top-1.5 h-8 w-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:hover:bg-cyan-500 text-black flex items-center justify-center transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Interrupt Speech Button (Visible while speaking) */}
        {agentState === 'speaking' && (
          <button
            onClick={onInterrupt}
            title="Interrupt current speech"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono transition-all animate-pulse"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Interrupt</span>
          </button>
        )}

        {/* Audio Output Mute Toggle */}
        <button
          onClick={onToggleAudio}
          title={isAudioMuted ? 'Unmute January Audio' : 'Mute January Audio'}
          className={`p-2.5 rounded-xl border text-xs transition-colors ${
            isAudioMuted
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'glass-card text-slate-400 hover:text-slate-200 border-white/5'
          }`}
        >
          {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Microphone Mute Toggle */}
        <button
          onClick={onToggleMic}
          title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          className={`p-2.5 rounded-xl border text-xs transition-colors ${
            isMicMuted
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'glass-card text-slate-400 hover:text-slate-200 border-white/5'
          }`}
        >
          {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
