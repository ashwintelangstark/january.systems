import React, { useEffect, useRef } from 'react';
import { AgentState } from '../types';

interface WaveformVisualizerProps {
  agentState: AgentState;
  inputLevel: number;
  outputLevel: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  agentState,
  inputLevel,
  outputLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Determine active amplitude
      const level =
        agentState === 'listening'
          ? Math.max(0.1, inputLevel)
          : agentState === 'speaking'
          ? Math.max(0.15, outputLevel * 1.6)
          : 0.05;

      const strokeColor =
        agentState === 'listening'
          ? '#00F0FF'
          : agentState === 'speaking'
          ? '#A855F7'
          : agentState === 'working'
          ? '#10B981'
          : '#475569';

      // Draw horizontal baseline
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw multi-frequency sine wave
      const lines = 3;
      for (let l = 0; l < lines; l++) {
        ctx.beginPath();
        const amp = (height * 0.45 * level) / (l + 1);
        const freq = 0.02 + l * 0.01;
        const linePhase = phase * (l + 1) * 0.8;

        for (let x = 0; x < width; x++) {
          const envelope = Math.sin((x / width) * Math.PI); // Taper edges
          const y = centerY + Math.sin(x * freq + linePhase) * amp * envelope;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = l === 0 ? 2 : 1;
        ctx.globalAlpha = 0.8 / (l + 1);
        ctx.stroke();
      }

      phase += 0.08;
      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [agentState, inputLevel, outputLevel]);

  return (
    <div className="w-full max-w-md h-12 glass-card rounded-xl px-4 py-1 flex items-center justify-between border border-white/5">
      <canvas
        ref={canvasRef}
        width={400}
        height={48}
        className="w-full h-full"
      />
    </div>
  );
};
