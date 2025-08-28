/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",         // root pages
    "./app/web/src/**/*.{js,ts,jsx,tsx}",   // everything in app/web/src
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
