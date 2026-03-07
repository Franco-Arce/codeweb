/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        codeflow: {
          dark: '#050508',
          base: '#0A0A0F',
          card: '#12121A',
          border: '#241f3d',
          accent: '#A855F7',
          accentHover: '#c084fc',
          accentGlow: 'rgba(168, 85, 247, 0.4)',
          text: '#F3F4F6',
          muted: '#9CA3AF',
        },
        f1: {
          red: '#E10600',
          redDark: '#9B0400',
          redSoft: 'rgba(225,6,0,0.12)',
          gold: '#F5C518',
          silver: '#A8A9AD',
          bronze: '#CD7F32',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        racing: ['"Orbitron"', '"Share Tech Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'subtle-grid': 'linear-gradient(to right, #ffffff05 1px, transparent 1px), linear-gradient(to bottom, #ffffff05 1px, transparent 1px)',
      },
      animation: {
        'glow-pulse': 'glow 3s ease-in-out infinite',
        'blob': 'blob 7s infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.35s ease-out forwards',
        'count-up': 'countUp 0.6s ease-out forwards',
        'shimmer-slow': 'shimmer 2s infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        countUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'premium-purple': '0 0 20px rgba(168, 85, 247, 0.4)',
        'premium-purple-hover': '0 0 30px rgba(168, 85, 247, 0.6)',
        'glow-red': '0 0 24px rgba(225, 6, 0, 0.25)',
        'glow-gold': '0 0 20px rgba(245, 197, 24, 0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
}
