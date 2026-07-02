/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      keyframes: {
        'brand-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shine: {
          '0%': { left: '-100%' },
          '100%': { left: '120%' },
        },
      },
      animation: {
        'brand-scroll': 'brand-scroll 30s linear infinite',
        shine: 'shine 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
