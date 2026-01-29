/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(210, 95%, 55%)',
        'brand-2': 'hsl(260, 85%, 60%)',
        'brand-3': 'hsl(330, 80%, 65%)',
      },
    },
  },
  plugins: [],
}
