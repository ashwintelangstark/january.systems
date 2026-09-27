/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        january: {
          dark: '#030509',
          glass: 'rgba(12, 17, 30, 0.65)',
          border: 'rgba(255, 255, 255, 0.12)',
          cyan: '#00F5FF',
          magenta: '#EC4899',
          purple: '#8B5CF6',
          orange: '#FF7B00',
          blue: '#3B82F6',
        }
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          'SF Pro Text',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        display: [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'JetBrains Mono',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px rgba(0, 245, 255, 0.35)',
        'glow-magenta': '0 0 25px rgba(236, 72, 153, 0.35)',
        'glow-blue': '0 0 25px rgba(59, 130, 246, 0.45)',
        'glass-card': '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
      },
    },
  },
  plugins: [],
};
