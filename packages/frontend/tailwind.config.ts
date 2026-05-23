import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        mission: {
          bg: '#0a0e1a',
          panel: '#111827',
          edge: '#1f2937',
          accent: '#38bdf8',
          warn: '#f59e0b',
          danger: '#ef4444',
          live: '#22c55e',
          realtime: '#3b82f6',
          snapshot: '#6b7280',
        },
      },
    },
  },
  plugins: [],
};

export default config;
