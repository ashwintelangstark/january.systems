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
  isListening?: boolean;
  interimTranscript?: string;
  inputLevel?: number;
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
  isListening = false,
  interimTranscript = '',
  inputLevel = 0,
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
  const isSubmittingRef = useRef<boolean>(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    onSendText(text);
    setInputText('');

    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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
      {/* Pop-Up Stop Speaking Pill Button (When January is Responding Verbally) */}
      {agentState === 'speaking' && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center animate-bounce">
          <button
            type="button"
            onClick={onInterrupt}
            className="relative flex items-center gap-2 px-4 py-1.5 rounded-full glass-shine-btn bg-white/30 border border-rose-400/80 shadow-[0_8px_24px_rgba(244,63,94,0.35)] text-rose-950 text-xs font-semibold tracking-wide backdrop-blur-xl hover:bg-rose-50/60 hover:scale-105 active:scale-95 transition-all cursor-pointer select-none"
            title="Stop January from Speaking"
          >
            <span className="glass-glare" />
            <span className="glass-click-flash" />
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <Square className="w-3 h-3 fill-rose-600 text-rose-600" />
            <span>Stop Speaking</span>
          </button>
        </div>
      )}

      {/* Live In-Flight Speech Recognition Feedback Pill */}
      {interimTranscript && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-400/80 shadow-[0_8px_24px_rgba(6,182,212,0.4)] text-cyan-200 text-xs font-medium tracking-wide backdrop-blur-xl animate-in fade-in select-none">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
          </span>
          <Mic className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
          <span className="italic max-w-sm md:max-w-md truncate">"{interimTranscript}"</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-1.5 p-1.5 rounded-2xl liquid-glass-bar transition-all focus-within:border-white/80 focus-within:shadow-[0_20px_45px_rgba(0,30,60,0.12),inset_0_1.5px_2px_rgba(255,255,255,0.9),0_0_25px_rgba(255,255,255,0.35)]"
      >
        {/* Subtle Top Specular Glass Refraction Edge */}
        <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none" />


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
          className={`relative w-9 h-9 rounded-xl glass-shine-btn flex items-center justify-center transition-all cursor-pointer ${
            isEyesOpen
              ? 'border-emerald-400 text-emerald-800 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'text-slate-700 hover:text-slate-950'
          }`}
          title={isEyesOpen ? 'Camera Eyes: OPEN (60 FPS)' : 'Click to open camera eyes'}
        >
          <span className="glass-glare" />
          <span className="glass-click-flash" />
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
          className="relative w-9 h-9 rounded-xl glass-shine-btn flex items-center justify-center text-slate-700 hover:text-slate-950 transition-all cursor-pointer"
          title="Attach blueprint, 3D CAD, image, or code file"
        >
          <span className="glass-glare" />
          <span className="glass-click-flash" />
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Subtle Vertical Hairline Separator */}
        <div className="w-px h-5 bg-white/40 mx-0.5 pointer-events-none" />

        {/* Main Text Input Field (100% Transparent Glass Interface) */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            interimTranscript
              ? `Listening: "${interimTranscript}"`
              : isListening
              ? 'Listening 24/7... Speak your prompt aloud to January or type...'
              : 'Ask January anything, engineer 3D scenes, or speak...'
          }
          className="flex-1 bg-transparent px-2.5 py-2 text-xs md:text-[13px] font-sans text-slate-900 placeholder-slate-500/80 focus:outline-none tracking-normal font-medium"
        />

        {/* Action Controls: Interrupt, Speaker Toggle, Mic Toggle, Send */}
        <div className="flex items-center gap-1.5 pr-0.5">
          {/* Interrupt Button (When speaking) */}
          {agentState === 'speaking' && (
            <button
              type="button"
              onClick={onInterrupt}
              className="relative w-9 h-9 rounded-xl glass-shine-btn border-rose-400 text-rose-700 flex items-center justify-center transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse cursor-pointer"
              title="Interrupt January Speech"
            >
              <span className="glass-glare" />
              <span className="glass-click-flash" />
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {/* Speaker On / Off Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            className={`relative w-9 h-9 rounded-xl glass-shine-btn flex items-center justify-center transition-all cursor-pointer ${
              isAudioMuted
                ? 'border-rose-400 text-rose-700'
                : 'text-slate-700 hover:text-slate-950'
            }`}
            title={isAudioMuted ? 'Speaker is OFF (Click to turn ON)' : 'Speaker is ON (Click to turn OFF)'}
          >
            <span className="glass-glare" />
            <span className="glass-click-flash" />
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
            className={`relative w-9 h-9 rounded-xl glass-shine-btn flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? 'border-cyan-400 text-cyan-900 bg-cyan-100/40 shadow-[0_0_16px_rgba(6,182,212,0.5)] animate-pulse'
                : isMicMuted
                ? 'border-rose-400/80 text-rose-700 bg-rose-50/20'
                : 'text-slate-700 hover:text-slate-950'
            }`}
            title={
              isListening
                ? 'Microphone is Active (Listening 24/7) - Click to Mute'
                : isMicMuted
                ? 'Microphone is Muted - Click to Resume 24/7 Listening'
                : 'Click to Speak (Microphone)'
            }
          >
            <span className="glass-glare" />
            <span className="glass-click-flash" />
            {isListening ? (
              <span className="relative flex items-center justify-center">
                <Mic className="w-4 h-4 text-cyan-700 animate-pulse" />
                {inputLevel > 0.05 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                )}
              </span>
            ) : isMicMuted ? (
              <MicOff className="w-4 h-4 text-rose-600" />
            ) : (
              <Mic className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`relative w-9 h-9 rounded-xl glass-shine-btn flex items-center justify-center transition-all ${
              inputText.trim()
                ? 'text-slate-950 border-white/80 shadow-md cursor-pointer'
                : 'text-slate-400 opacity-40 cursor-not-allowed border-white/20'
            }`}
            title="Send Command (Enter)"
          >
            <span className="glass-glare" />
            <span className="glass-click-flash" />
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default FloatingPromptBar;
