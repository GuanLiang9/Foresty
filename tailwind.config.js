export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      screens: { short: { raw: '(max-height: 720px)' } },
      colors: { ink: '#060a09' },
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
