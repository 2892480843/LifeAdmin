/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        route: {
          50: '#eef6ff',
          100: '#d9ecff',
          500: '#2f7df4',
          600: '#2466dc',
          700: '#1d4fb6',
        },
        locate: {
          50: '#ecfdf8',
          100: '#ccfbef',
          500: '#11bfae',
          600: '#0b978e',
          700: '#0f766e',
        },
        notice: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        risk: {
          50: '#fff1f5',
          100: '#ffe4ec',
          500: '#e11d48',
          600: '#be123c',
        },
        command: {
          900: '#101827',
          950: '#07111f',
        },
        canvas: '#f6f9fc',
        panel: 'rgba(255,255,255,.82)',
        ink: '#0f172a',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.05), 0 12px 32px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 18px 48px rgba(15, 23, 42, 0.10)',
        panel: '0 22px 70px rgba(15, 23, 42, 0.12)',
        glow: '0 0 0 1px rgba(37,99,235,.08), 0 18px 50px rgba(37,99,235,.16)',
        command: '0 18px 60px rgba(7, 17, 31, 0.18)',
      },
      borderRadius: {
        card: '8px',
        panel: '10px',
        control: '8px',
      },
      transitionDuration: {
        soft: '180ms',
        panel: '240ms',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei',
          'Segoe UI',
          'sans-serif',
        ],
      },
      keyframes: {
        'route-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37,99,235,.22)' },
          '50%': { boxShadow: '0 0 0 8px rgba(37,99,235,0)' },
        },
        'scan-line': {
          '0%': { transform: 'translateX(-20%)', opacity: '.15' },
          '50%': { opacity: '.75' },
          '100%': { transform: 'translateX(120%)', opacity: '.15' },
        },
        'float-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'route-flow': {
          to: { strokeDashoffset: '-22' },
        },
        'node-ping': {
          '0%': { transform: 'scale(0.55)', opacity: '0.55' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        'radar-sweep': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'route-pulse': 'route-pulse 1.8s ease-in-out infinite',
        'scan-line': 'scan-line 3.6s ease-in-out infinite',
        'float-soft': 'float-soft 4s ease-in-out infinite',
        'route-flow': 'route-flow 1.6s linear infinite',
        'node-ping': 'node-ping 1.9s ease-out infinite',
        'radar-sweep': 'radar-sweep 6s linear infinite',
      },
    },
  },
  plugins: [],
}
