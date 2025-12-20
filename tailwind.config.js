/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",         // root pages
    "./app/**/*.{ts,tsx,js,jsx}",
    "./app/web/src/**/*.{js,ts,jsx,tsx}",   // everything in app/web/src
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
