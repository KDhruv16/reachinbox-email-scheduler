/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00a63e',
          dark: '#008a33',
          soft: '#e6f4ea',
          50: '#e6f4ea',
          100: '#cce9d4',
          500: '#00a63e',
          600: '#008a33',
          700: '#006e28',
        },
        field: '#f4f5f4',
        line: '#ececec',
        ink: '#1f1f1f',
        muted: '#8a8f98',
        warn: {
          bg: '#fff3e6',
          line: '#f8cfa4',
          ink: '#c2410c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        pixel: ['Silkscreen', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
