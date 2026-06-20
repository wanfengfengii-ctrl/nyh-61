/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,vue}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
    },
    extend: {
      colors: {
        paper: {
          50: '#FBF7EE',
          100: '#F5F0E6',
          200: '#EBE3D1',
          300: '#DCCAB0',
          400: '#C7AB84',
        },
        ink: {
          DEFAULT: '#1C1C1C',
          soft: '#3A3A3A',
          muted: '#5E5E5E',
          pale: '#8A8A8A',
        },
        vermilion: {
          DEFAULT: '#8B2500',
          hover: '#A72F06',
          soft: '#B85B3C',
          pale: '#F2DFD7',
        },
        rattan: {
          DEFAULT: '#E8C84A',
          soft: '#F3DE8D',
        },
        azure: {
          DEFAULT: '#2E5E8A',
          soft: '#79A3C7',
        },
        carmine: {
          DEFAULT: '#B8336A',
          soft: '#E193AF',
        },
        moss: {
          DEFAULT: '#7A8B6E',
          soft: '#B7C2AD',
        },
        purple: {
          DEFAULT: '#7B4E9E',
          soft: '#B59AD1',
        },
        amber: {
          DEFAULT: '#B8860B',
          soft: '#E6C878',
        },
        indigo: {
          DEFAULT: '#4B5B9C',
          soft: '#9AA8D4',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        title: ['"ZCOOL XiaoWei"', '"Noto Serif SC"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        scroll: '0 4px 24px -4px rgba(28,28,28,0.12), inset 0 0 0 1px rgba(28,28,28,0.06)',
        seal: '0 2px 8px rgba(139,37,0,0.3)',
      },
      backgroundImage: {
        'paper-texture':
          "radial-gradient(circle at 20% 20%, rgba(220,202,176,0.35) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(199,171,132,0.2) 0%, transparent 45%), linear-gradient(180deg, #F5F0E6 0%, #EFE7D4 100%)",
      },
    },
  },
  plugins: [],
};
