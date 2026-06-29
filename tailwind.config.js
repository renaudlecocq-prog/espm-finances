/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2D1B2E', light: '#4A2D4F', lighter: '#6B4A73' },
        accent:  { DEFAULT: '#F16410', light: '#F5894A', dark:  '#C44E08' },
        surface: '#FAFAF9',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
