/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2D1B2E', light: '#4A2D4F', lighter: '#6B4A73' },
        accent:  { DEFAULT: '#B89AAB', light: '#D4C0C9', dark:  '#9A7D8D' },
        surface: '#FAFAF9',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
