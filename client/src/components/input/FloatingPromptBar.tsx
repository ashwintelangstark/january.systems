import React, { useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Paperclip,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Square,
  Sparkles,
} from 'lucide-react';
import { AgentState } from '../../types';

interface FloatingPromptBarProps {
  agentState: AgentState;
  isMicMuted: boolean;
  isAudioMuted: boolean;
  isEyesOpen: boolean;
  onSendText: (text: string) => void;
  onTriggerWake: () => void;
  onInterrupt: () => void;
  onToggleMic: () => void;
  onToggleAudio: () => void;
  onToggleEyes: () => void;
  onFileUpload?: (file: File) => void;
}

export const FloatingPromptBar: React.FC<FloatingPromptBarProps> = ({
  agentState,
  isMicMuted,
  isAudioMuted,
  isEyesOpen,
  onSendText,
  onTriggerWake,
  onInterrupt,
  onToggleMic,
  onToggleAudio,
  onToggleEyes,
  onFileUpload,
}) => {
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4 select-none">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-2 p-2 rounded-2xl liquid-glass-bar liquid-glass-glow-border shadow-2xl backdrop-blur-2xl"
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,.blend,.obj,.glb,.stl,.step,.pdf,.txt,.py,.cpp,.c"
        />

        {/* Quick Wake Button ("Rise") */}
        <button
          type="button"
          onClick={onTriggerWake}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/30 text-cyan-300 text-xs font-mono font-bold tracking-wider transition-all shadow-glow-cyan"
          title="Wake January (Voice / Manual)"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>RISE</span>
        </button>

        {/* Camera Eyes Quick Toggle */}
        <button
          type="button"
          onClick={onToggleEyes}
          className={`p-2 rounded-xl border transition-all ${
            isEyesOpen
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white'
          }`}
          title={isEyesOpen ? 'Camera Eyes Open (60 FPS)' : 'Click to Open Camera Eyes'}
        >
          {isEyesOpen ? (
            <Eye className="w-4 h-4 text-emerald-400 animate-pulse" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>

        {/* File Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-400 hover:text-white transition-colors"
          title="Upload Reference Blueprint, 3D CAD, Image, or Code"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Main Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask January anything, engineer 3D scenes, or press 'Rise' to speak..."
          className="flex-1 bg-transparent px-3 py-2 text-xs md:text-sm font-sans text-slate-100 placeholder-slate-400/80 focus:outline-none"
        />

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 pr-1">
          {/* Interrupt Button (When speaking) */}
          {agentState === 'speaking' && (
            <button
              type="button"
              onClick={onInterrupt}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse"
              title="Interrupt January Speech"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {/* Audio Speaker Mute Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            className={`p-2 rounded-xl border transition-colors ${
              isAudioMuted
                ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white'
            }`}
            title={isAudioMuted ? 'Unmute Audio Playback' : 'Mute Audio Playback'}
          >
            {isAudioMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Microphone Toggle */}
          <button
            type="button"
            onClick={onToggleMic}
            className={`p-2 rounded-xl border transition-all ${
              isMicMuted
                ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-cyan-300'
            }`}
            title={isMicMuted ? 'Unmute Physical Microphone' : 'Mute Microphone'}
          >
            {isMicMuted ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-glow-blue transition-all"
            title="Send Command (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
