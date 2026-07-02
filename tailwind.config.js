/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral ink scale — light workspace text & hairlines
        ink: {
          50: '#f5f7fa',
          100: '#e9edf3',
          200: '#cdd5e0',
          300: '#a6b3c7',
          400: '#7689a6',
          500: '#566a89',
          600: '#42546f',
          700: '#33425a',
          800: '#1f2a3c',
          900: '#131c2b',
          950: '#0b111c',
        },
        // Straive deep-navy application chrome (top bar, left rail, dark panels)
        navy: {
          50: '#f4f6fa',
          100: '#e4e9f2',
          200: '#c2cee0',
          300: '#90a6c6',
          400: '#5b769e',
          500: '#3a567a',
          600: '#26405f',
          700: '#1b2e4a',
          800: '#122139',
          900: '#0d1b2e',
          950: '#081320',
        },
        // Straive Aerospace Orange — the single brand accent
        straive: {
          50: '#fff4ef',
          100: '#ffe6da',
          200: '#ffc7ad',
          300: '#ff9e75',
          400: '#ff7438',
          500: '#ff5000',
          600: '#e84600',
          700: '#c03700',
          800: '#992d05',
          900: '#7c2809',
          950: '#431105',
        },
        // Semantic brand aliases (re-themes existing markup to Straive at once)
        brand: {
          navy: '#0d1b2e',
          DEFAULT: '#0d1b2e',
          accent: '#ff5000',
          accentSoft: '#fff1ea',
        },
        ok: '#1f9d61',
        warn: '#e0901a',
        crit: '#d23b34',
        info: '#2a7fd0',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(13, 27, 46, 0.04), 0 1px 3px rgba(13, 27, 46, 0.08)',
        cardHover: '0 6px 16px rgba(13, 27, 46, 0.10), 0 2px 6px rgba(13, 27, 46, 0.06)',
        pop: '0 12px 34px rgba(8, 19, 32, 0.22)',
        glow: '0 0 0 3px rgba(255, 80, 0, 0.15)',
        // Layered depth for "3D" tiles / floating chrome elements
        '3d': '0 20px 45px -18px rgba(8, 19, 32, 0.45), 0 8px 18px -12px rgba(8, 19, 32, 0.35)',
        'inner-top': 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        'brand-glow': '0 10px 30px -8px rgba(255, 80, 0, 0.45)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.82)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(6deg)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(18px) rotate(-8deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.25s ease-out',
        shimmer: 'shimmer 1.4s infinite linear',
        'pulse-dot': 'pulse-dot 1.8s ease-in-out infinite',
        float: 'float 9s ease-in-out infinite',
        'float-slow': 'float-slow 12s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
