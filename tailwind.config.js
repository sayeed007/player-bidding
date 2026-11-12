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
        accent: c('accent'), cyan: c('cyan'), violet: c('violet'), success: c('success'), danger: c('danger'), warning: c('warning'),
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'] },
      borderRadius: { xl: '14px', '2xl': '20px' },
      boxShadow: { card: '0 1px 0 rgb(255 255 255 / .04) inset, 0 8px 30px rgb(0 0 0 / .35)' },
    },
  },
  plugins: [],
};
