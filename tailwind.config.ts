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
      },
      fontFamily: {
        'dm-serif': ['"DM Serif Display"', 'serif'],
        'dm-sans': ['"DM Sans"', 'sans-serif'],
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
