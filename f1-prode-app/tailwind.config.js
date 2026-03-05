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
          dark: '#050508', // Deepest background
          base: '#0A0A0F', // Standard base
          card: '#12121A', // Card/Surface
          border: '#241f3d',
          accent: '#A855F7', // Primary purple
          accentHover: '#c084fc',
          accentGlow: 'rgba(168, 85, 247, 0.4)',
          text: '#F3F4F6', // Light gray text
          muted: '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'subtle-grid': 'linear-gradient(to right, #ffffff05 1px, transparent 1px), linear-gradient(to bottom, #ffffff05 1px, transparent 1px)',
      },
      animation: {
        'glow-pulse': 'glow 3s ease-in-out infinite',
        'blob': 'blob 7s infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: 0.5 },
          '50%': { opacity: 1 },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        boxShadow: {
          'premium-purple': '0 0 20px rgba(168, 85, 247, 0.4)',
          'premium-purple-hover': '0 0 30px rgba(168, 85, 247, 0.6)',
        }
      }
    },
  },
  plugins: [],
}
