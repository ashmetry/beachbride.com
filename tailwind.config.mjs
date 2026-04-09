/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#1C2B4A',
          light: '#E8ECF4',
          dark: '#111B30',
          accent: '#C9974A',
          'accent-dark': '#A67A35',
        },
        neutral: {
          DEFAULT: '#F9F5F0',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
