/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    "text-indigo-600",
    "text-green-600",
    "text-red-600",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
