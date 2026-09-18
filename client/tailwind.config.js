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
          dark: '#07090E',
          surface: '#0E131F',
          card: '#141B2D',
          border: 'rgba(255, 255, 255, 0.08)',
          cyan: '#00F0FF',
          magenta: '#FF0055',
          purple: '#8B5CF6',
          emerald: '#10B981',
          amber: '#F59E0B',
        },
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow 3s ease-in-out infinite alternate',
        'spin-slow': 'spin 12s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { filter: 'drop-shadow(0 0 15px rgba(0, 240, 255, 0.4))' },
          '100%': { filter: 'drop-shadow(0 0 35px rgba(139, 92, 246, 0.8))' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 25px rgba(0, 240, 255, 0.35)',
        'glow-purple': '0 0 30px rgba(139, 92, 246, 0.4)',
        'glow-amber': '0 0 25px rgba(245, 158, 11, 0.35)',
        'glow-emerald': '0 0 25px rgba(16, 185, 129, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
    },
  },
  plugins: [],
};
