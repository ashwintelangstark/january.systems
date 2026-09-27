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
} from 'lucide-react';
import { AgentState } from '../../types';

interface FloatingPromptBarProps {
  agentState: AgentState;
  isMicMuted: boolean;
  isAudioMuted: boolean;
  isEyesOpen: boolean;
  onSendText: (text: string) => void;
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 select-none">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-1.5 p-1.5 rounded-2xl liquid-glass-bar transition-all focus-within:border-white/80 focus-within:shadow-[0_20px_45px_rgba(0,30,60,0.15),0_0_20px_rgba(255,255,255,0.45)]"
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,.blend,.obj,.glb,.stl,.step,.pdf,.txt,.py,.cpp,.c"
        />

        {/* Camera Eyes Quick Toggle */}
        <button
          type="button"
          onClick={onToggleEyes}
          className={`w-9 h-9 rounded-xl glass-btn flex items-center justify-center transition-all cursor-pointer ${
            isEyesOpen
              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-800 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'text-slate-700 hover:text-slate-950'
          }`}
          title={isEyesOpen ? 'Camera Eyes: OPEN (60 FPS)' : 'Click to open camera eyes'}
        >
          {isEyesOpen ? (
            <Eye className="w-4 h-4 text-emerald-700 animate-pulse" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>

        {/* File Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-9 h-9 rounded-xl glass-btn flex items-center justify-center text-slate-700 hover:text-slate-950 transition-all cursor-pointer"
          title="Attach blueprint, 3D CAD, image, or code file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Subtle Vertical Hairline Separator */}
        <div className="w-px h-5 bg-white/40 mx-0.5" />

        {/* Main Text Input Field */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask January anything, engineer 3D scenes, or speak..."
          className="flex-1 bg-transparent px-2.5 py-2 text-xs md:text-[13px] font-sans text-slate-900 placeholder-slate-500/80 focus:outline-none tracking-normal font-medium"
        />

        {/* Action Controls: Interrupt, Speaker Toggle, Mic Toggle, Send */}
        <div className="flex items-center gap-1.5 pr-0.5">
          {/* Interrupt Button (When speaking) */}
          {agentState === 'speaking' && (
            <button
              type="button"
              onClick={onInterrupt}
              className="w-9 h-9 rounded-xl glass-btn bg-rose-500/25 hover:bg-rose-500/35 border-rose-400 text-rose-700 flex items-center justify-center transition-all shadow-[0_0_12px_rgba(244,63,94,0.25)] animate-pulse cursor-pointer"
              title="Interrupt January Speech"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {/* Speaker On / Off Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            className={`w-9 h-9 rounded-xl glass-btn flex items-center justify-center transition-all cursor-pointer ${
              isAudioMuted
                ? 'bg-rose-500/20 border-rose-400 text-rose-700'
                : 'text-slate-700 hover:text-slate-950'
            }`}
            title={isAudioMuted ? 'Speaker is OFF (Click to turn ON)' : 'Speaker is ON (Click to turn OFF)'}
          >
            {isAudioMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Microphone On / Off Toggle */}
          <button
            type="button"
            onClick={onToggleMic}
            className={`w-9 h-9 rounded-xl glass-btn flex items-center justify-center transition-all cursor-pointer ${
              isMicMuted
                ? 'bg-rose-500/20 border-rose-400 text-rose-700'
                : 'bg-cyan-500/25 border-cyan-400 text-cyan-800 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
            }`}
            title={isMicMuted ? 'Microphone is OFF (Click to turn ON)' : 'Microphone is ON (Click to turn OFF)'}
          >
            {isMicMuted ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4 text-cyan-800" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`w-9 h-9 rounded-xl glass-btn flex items-center justify-center transition-all ${
              inputText.trim()
                ? 'bg-white/70 hover:bg-white/90 text-slate-950 border-white/80 shadow-md cursor-pointer'
                : 'text-slate-400 opacity-40 cursor-not-allowed border-white/20'
            }`}
            title="Send Command (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default FloatingPromptBar;
