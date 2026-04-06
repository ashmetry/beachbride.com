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
          DEFAULT: '#2A7F8F',
          light: '#E8F4F6',
          dark: '#1A5F6F',
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
