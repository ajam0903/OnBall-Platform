/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeInOut: {
          '0%, 100%': { opacity: '0' },
          '10%, 90%': { opacity: '1' },
        },
      },
      animation: {
        fadeInOut: 'fadeInOut 3s ease-in-out',
      },
    },
  },
  plugins: [],
}
