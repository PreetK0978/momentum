/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        elevated: v('elevated'),
        line: v('line'),
        fg: v('fg'),
        muted: v('muted'),
        subtle: v('subtle'),
        accent: v('accent'),
        accent2: v('accent2'),
        accentfg: v('accentfg'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        card: '0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 1px 2px rgb(0 0 0 / 0.2)',
        pop: '0 20px 50px -12px rgb(0 0 0 / 0.5)',
      },
    },
  },
  plugins: [],
};
