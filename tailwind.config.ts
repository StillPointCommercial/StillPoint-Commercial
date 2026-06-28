import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: '#2C2C2C',
          light: '#4A4A4A',
        },
        text: {
          DEFAULT: '#3A3632',
          light: '#7A746D',
        },
        'warm-white': '#FAF8F5',
        cream: '#F5F2ED',
        sand: {
          DEFAULT: '#E8E0D4',
          light: '#F3EFE9',
        },
        stone: {
          DEFAULT: '#C4B5A2',
          light: '#D9CFC3',
        },
        terracotta: {
          DEFAULT: '#B5876B',
          muted: '#C9A88E',
        },
        'muted-bronze': '#A08B6D',
        'warm-gray': '#8A8279',
        border: '#DDD6CC',
        'attention-red': '#C0392B',
        'success-green': '#27AE60',
        'caution-amber': '#E67E22',
        // --- Suite (cool, minimalist) theme — used by the launcher, shared shell and Business Case Model ---
        suite: {
          ink: '#0f172a',
          'ink-2': '#64748b',
          'ink-3': '#94a3b8',
          bg: '#ffffff',
          subtle: '#f8fafc',
          panel: '#f1f5f9',
          hover: '#e8edf2',
          border: '#e2e8f0',
          'border-2': '#e6e8ec',
          grid: '#eef1f4',
          slate: '#1e293b',
          accent: '#2a7d72',
          'accent-dark': '#155e54',
          'accent-mid': '#6aa39a',
          'accent-light': '#9cc4bd',
          'accent-tint': '#e7f0ee',
          'accent-tint-2': '#e9f3ef',
          'accent-tint-3': '#cfe3df',
          pos: '#2a7d72',
          neg: '#c2554d',
          'neg-bg': '#fbeeec',
          warm: '#b08968',
          neutral: '#cbd5e1',
        },
      },
      fontFamily: {
        'dm-serif': ['"DM Serif Display"', 'serif'],
        'dm-sans': ['"DM Sans"', 'sans-serif'],
        suite: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '8px',
        input: '6px',
        badge: '4px',
      },
    },
  },
  plugins: [],
}

export default config
