import React, { useEffect, useRef } from 'react';
import { AgentState, EmotionState } from '../types';
import { Mic, Volume2, Cpu, Power, Moon } from 'lucide-react';

interface OrbVisualizerProps {
  agentState: AgentState;
  emotionState?: EmotionState;
  inputLevel: number;
  outputLevel: number;
  onActivate: () => void;
}

export const OrbVisualizer: React.FC<OrbVisualizerProps> = ({
  agentState,
  emotionState,
  inputLevel,
  outputLevel,
  onActivate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Dynamic state & emotion styling
  const getOrbTheme = () => {
    const emotionColor = emotionState?.color || '#00F5FF';

    switch (agentState) {
      case 'passive':
        return {
          primary: 'rgba(245, 158, 11, 0.8)',   // Amber
          secondary: 'rgba(0, 240, 255, 0.4)', // Cyan accent
          glowClass: 'shadow-glow-amber',
          icon: <Power className="w-8 h-8 text-amber-300 transition-transform group-hover:scale-110" />,
          statusText: 'CLICK OR SAY "ARISE"',
        };
      case 'listening':
        return {
          primary: emotionColor,
          secondary: 'rgba(59, 130, 246, 0.6)',
          glowClass: 'shadow-glow-cyan animate-pulse',
          icon: <Mic className="w-8 h-8 text-cyan-300 animate-pulse" />,
          statusText: 'JANUARY IS LISTENING...',
        };
      case 'speaking':
        return {
          primary: emotionColor,
          secondary: 'rgba(236, 72, 153, 0.6)',
          glowClass: 'shadow-glow-purple',
          icon: <Volume2 className="w-8 h-8 text-purple-200 animate-bounce" />,
          statusText: 'JANUARY IS SPEAKING...',
        };
      case 'working':
        return {
          primary: emotionColor,
          secondary: 'rgba(6, 182, 212, 0.6)',
          glowClass: 'shadow-glow-emerald',
          icon: <Cpu className="w-8 h-8 text-emerald-300 animate-spin" />,
          statusText: 'EXECUTING / SYNTHESIZING...',
        };
      case 'sleeping':
        return {
          primary: 'rgba(99, 102, 241, 0.5)',  // Deep Indigo
          secondary: 'rgba(147, 197, 253, 0.2)',
          glowClass: 'shadow-none opacity-60',
          icon: <Moon className="w-8 h-8 text-indigo-300 transition-transform group-hover:scale-110" />,
          statusText: 'SLEEPING — SAY "ARISE" TO WAKE',
        };
    }
  };

  const theme = getOrbTheme();

  // Canvas wave animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Current amplitude modulation
      const currentLevel =
        agentState === 'listening'
          ? Math.max(0.15, inputLevel)
          : agentState === 'speaking'
          ? Math.max(0.2, outputLevel * 1.5)
          : agentState === 'working'
          ? 0.35
          : 0.1;

      // Draw multi-layered orbital ripples
      const numRings = 3;
      for (let ring = 1; ring <= numRings; ring++) {
        const baseRadius = 80 + ring * 22;
        const radius = baseRadius + currentLevel * (30 * ring);

        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(10, radius), 0, Math.PI * 2);
        ctx.strokeStyle = ring === 1 ? theme.primary : theme.secondary;
        ctx.lineWidth = ring === 1 ? 2.5 : 1.2;
        ctx.globalAlpha = 0.4 / ring;
        ctx.stroke();
      }

      // Draw rotating particle orbit
      const numParticles = 12;
      for (let i = 0; i < numParticles; i++) {
        const pAngle = angle + (i * (Math.PI * 2)) / numParticles;
        const orbitRadius = 140 + Math.sin(angle * 2 + i) * 12 + currentLevel * 25;
        const px = centerX + Math.cos(pAngle) * orbitRadius;
        const py = centerY + Math.sin(pAngle) * orbitRadius;

        ctx.beginPath();
        ctx.arc(px, py, 2.5 + currentLevel * 3, 0, Math.PI * 2);
        ctx.fillStyle = theme.primary;
        ctx.globalAlpha = 0.6;
        ctx.fill();
      }

      angle += agentState === 'working' ? 0.05 : 0.02;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [agentState, inputLevel, outputLevel, theme]);

  return (
    <div className="relative flex flex-col items-center justify-center py-6 select-none">
      {/* Background radial glow */}
      <div
        className="absolute w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${theme.primary} 0%, transparent 70%)`,
        }}
      />

      {/* Canvas for reactive particle rings */}
      <div className="relative w-[360px] h-[360px] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          className="absolute inset-0 pointer-events-none z-0"
        />

        {/* Central Interactive Orb Button */}
        <button
          onClick={onActivate}
          title={agentState === 'passive' ? 'Activate January (or say "Arise")' : 'Active'}
          className={`group relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-500 cursor-pointer ${theme.glowClass} active:scale-95`}
          style={{
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.15), rgba(14,19,31,0.9) 70%)',
            border: `1.5px solid ${theme.primary}`,
          }}
        >
          {/* Inner pulsating core */}
          <div
            className="absolute inset-2 rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-300"
            style={{ backgroundColor: theme.primary }}
          />

          {/* Center Icon */}
          <div className="relative z-20 flex flex-col items-center">
            {theme.icon}
          </div>
        </button>
      </div>

      {/* Mode & Emotion Subtitle */}
      <div className="mt-2 flex flex-col items-center gap-1.5 z-10">
        <span className="text-[11px] font-mono tracking-widest text-slate-300 font-semibold px-3 py-1 rounded-full bg-white/5 border border-white/10">
          {theme.statusText}
        </span>
        {agentState !== 'sleeping' && emotionState && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/5 text-[10px] font-mono">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: emotionState.color }}
            />
            <span className="text-slate-400 capitalize">
              Mood: <span className="font-semibold" style={{ color: emotionState.color }}>{emotionState.emotion}</span> ({emotionState.tone})
            </span>
          </div>
        )}
        {agentState === 'passive' && (
          <span className="text-[11px] text-slate-500 font-mono">
            Passive background mic monitoring is active
          </span>
        )}
      </div>
    </div>
  );
};
