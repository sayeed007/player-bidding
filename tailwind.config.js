const c = (n) => `rgb(var(--${n}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), surface2: c('surface2'), line: c('line'),
        fg: c('fg'), muted: c('muted'),
        primary: c('primary'), 'primary-fg': c('primary-fg'),
        accent: c('accent'), success: c('success'), danger: c('danger'), warning: c('warning'),
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'] },
      borderRadius: { xl: '14px', '2xl': '20px' },
      boxShadow: { card: '0 1px 2px rgb(0 0 0 / .05), 0 4px 16px rgb(0 0 0 / .05)' },
    },
  },
  plugins: [],
};
