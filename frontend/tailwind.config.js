/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sniper: {
          dark: '#0f172a',
          card: '#1e293b',
          accent: '#10b981', // Emerald Green
          danger: '#ef4444', // Red
          text: '#f8fafc'
        }
      }
    },
  },
  plugins: [],
}